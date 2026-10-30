#!/usr/bin/env python3
"""Move a rewritten Markdown text back into Confluence storage format.

Two steps:

  python3 confluence.py extract PAGE.xml MACRO_DIR
      Copies every macro and image of the page byte for byte into MACRO_DIR
      (macro-01.xml, macro-02.xml, ...), writes MACRO_DIR/index.txt and
      MACRO_DIR/page-with-placeholders.xml. In the Markdown text, the placeholder
      {{macro:N}} stands for macro N.

  python3 confluence.py build TEXT.md MACRO_DIR -o BODY.xml [--original PAGE.xml]
      Converts the Markdown into storage format, puts every macro back unchanged
      and checks the result: all placeholders known, every macro used, every
      ac:macro-id of the original still there, well-formed XML.

The script never talks to Confluence. Uploading is a separate, confirmed step.
Standard library only.
"""

import argparse
import html
import os
import re
import sys
import xml.etree.ElementTree as ET

PLACEHOLDER = re.compile(r"\{\{macro:(\d+)\}\}")
# Confluence elements that go back into the page unchanged. Layout elements are
# missing on purpose: they wrap whole sections of text.
KEPT = ("structured-macro", "image", "link", "emoticon", "task-list")
OPEN_TAG = re.compile(r"<ac:(" + "|".join(KEPT) + r")\b[^>]*?(/?)>")


def find_macros(page):
    """Top-level macros, images, page links etc. as (start, end) spans, in page order."""
    spans, pos = [], 0
    while True:
        first = OPEN_TAG.search(page, pos)
        if first is None:
            return spans
        end = first.end()
        if not first.group(2):
            depth, end = 0, None
            for tag in re.finditer(r"<(/?)ac:" + first.group(1) + r"\b[^>]*?(/?)>", page[first.start():]):
                if tag.group(2):
                    continue
                depth += -1 if tag.group(1) else 1
                if depth == 0:
                    end = first.start() + tag.end()
                    break
            if end is None:
                sys.exit(f"Unvollständiges <ac:{first.group(1)}> an Position {first.start()}")
        spans.append((first.start(), end))
        pos = end


def describe(snippet):
    """One line that tells which macro this is."""
    element = re.match(r"<ac:([\w-]+)", snippet).group(1)
    if element == "image":
        name = re.search(r'ri:filename="([^"]+)"', snippet) or re.search(r'ri:value="([^"]+)"', snippet)
        return "image", "-", name.group(1) if name else ""
    if element != "structured-macro":
        target = re.search(r'ri:(?:content-title|filename|value|username|userkey)="([^"]+)"', snippet)
        return element, "-", html.unescape(target.group(1)) if target else ""
    kind = re.search(r'ac:name="([^"]+)"', snippet)
    macro_id = re.search(r'ac:macro-id="([^"]+)"', snippet)
    body = re.search(r"<!\[CDATA\[(.*?)\]\]>", snippet, re.S)
    if body:
        hint = body.group(1).strip().splitlines()[0] if body.group(1).strip() else ""
    else:
        hint = html.unescape(re.sub(r"<[^>]+>", " ", snippet))
    hint = " ".join(hint.split())[:70]
    return (kind.group(1) if kind else "?"), (macro_id.group(1) if macro_id else "-"), hint


def extract(args):
    with open(args.page, encoding="utf-8", newline="") as handle:
        page = handle.read()
    os.makedirs(args.macro_dir, exist_ok=True)
    pieces, index, last = [], [], 0
    for number, (start, end) in enumerate(find_macros(page), 1):
        snippet = page[start:end]
        with open(os.path.join(args.macro_dir, f"macro-{number:02d}.xml"), "w", encoding="utf-8", newline="") as handle:
            handle.write(snippet)
        kind, macro_id, hint = describe(snippet)
        index.append(f"{{{{macro:{number}}}}}\t{kind}\t{macro_id}\t{hint}")
        pieces += [page[last:start], f"{{{{macro:{number}}}}}"]
        last = end
    pieces.append(page[last:])
    with open(os.path.join(args.macro_dir, "index.txt"), "w", encoding="utf-8") as handle:
        handle.write("Platzhalter\tMakro\tmacro-id\tInhalt\n" + "\n".join(index) + "\n")
    with open(os.path.join(args.macro_dir, "page-with-placeholders.xml"), "w", encoding="utf-8", newline="") as handle:
        handle.write("".join(pieces))
    print(f"{len(index)} Makros und Bilder nach {args.macro_dir} kopiert:")
    print("\n".join(index))


def escape(text):
    return html.escape(text, quote=False)


def inline(text):
    """Markdown inline markup to storage format. Code spans are escaped verbatim."""
    out = []
    for part in re.split(r"(`+[^`]*?`+)", text):
        span = re.fullmatch(r"(`+)(.*?)\1", part, re.S)
        if span:
            out.append("<code>" + escape(span.group(2).strip()) + "</code>")
            continue
        part = escape(part.replace("\\|", "|"))
        part = re.sub(r"!\[[^\]]*\]\(([^)\s]+)\)",
                      lambda m: '<ac:image><ri:attachment ri:filename="' + m.group(1).replace('"', "&quot;") + '" /></ac:image>', part)
        part = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)",
                      lambda m: '<a href="' + m.group(2).replace('"', "&quot;") + '">' + m.group(1) + "</a>", part)
        part = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", part)
        part = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", part)
        out.append(part)
    return "".join(out)


def cdata(text):
    return "<![CDATA[" + text.replace("]]>", "]]]]><![CDATA[>") + "]]>"


def code_macro(language, body):
    parameter = f'<ac:parameter ac:name="language">{escape(language)}</ac:parameter>' if language else ""
    return ('<ac:structured-macro ac:name="code" ac:schema-version="1">' + parameter
            + "<ac:plain-text-body>" + cdata(body) + "</ac:plain-text-body></ac:structured-macro>")


LIST_ITEM = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$")


def indent_of(line):
    return len(line) - len(line.lstrip(" \t"))


def build_list(lines, i):
    """A list with everything indented below its items: paragraphs, code blocks,
    nested lists. Returns (storage, next index)."""
    first = LIST_ITEM.match(lines[i])
    indent, ordered = len(first.group(1)), first.group(2)[0].isdigit()
    items = []
    while i < len(lines):
        # A blank line between two items keeps the list going ("loose" list).
        following = i
        while following < len(lines) and not lines[following].strip():
            following += 1
        item = LIST_ITEM.match(lines[following]) if following < len(lines) else None
        if not item or len(item.group(1)) != indent or item.group(2)[0].isdigit() != ordered:
            break
        i = following
        width = len(item.group(1)) + len(item.group(2)) + 1
        block, i = [item.group(3)], i + 1
        while i < len(lines):
            line = lines[i]
            if not line.strip():
                following = i
                while following < len(lines) and not lines[following].strip():
                    following += 1
                if following < len(lines) and indent_of(lines[following]) > indent:
                    block += [""] * (following - i)
                    i = following
                    continue
                break
            if indent_of(line) > indent:
                block.append(line[min(width, indent_of(line)):])
            elif LIST_ITEM.match(line) or block[-1] == "":
                break
            else:
                block.append(line.strip())
            i += 1
        body = markdown_to_storage("\n".join(block))
        lead = re.match(r"<p>(.*?)</p>", body, re.S)
        if lead and "<p>" not in body[lead.end():]:
            body = lead.group(1) + body[lead.end():]
        items.append(body)
    tag = "ol" if ordered else "ul"
    return f"<{tag}>" + "".join(f"<li>{item}</li>" for item in items) + f"</{tag}>", i


def table_cells(row):
    return [cell.strip() for cell in re.split(r"(?<!\\)\|", row.strip().strip("|"))]


def markdown_to_storage(source):
    lines, out, i = source.splitlines(), [], 0
    while i < len(lines):
        line, stripped = lines[i], lines[i].strip()
        fence = re.match(r"^\s*(```+|~~~+)\s*([\w+-]*)", line)
        if fence:
            body, i = [], i + 1
            while i < len(lines) and not lines[i].strip().startswith(fence.group(1)):
                body.append(lines[i])
                i += 1
            out.append(code_macro(fence.group(2), "\n".join(body)))
            i += 1
        elif not stripped:
            i += 1
        elif stripped.startswith("<!--"):
            while i < len(lines) and "-->" not in lines[i]:
                i += 1
            i += 1
        elif PLACEHOLDER.fullmatch(stripped):
            out.append(stripped)
            i += 1
        elif re.match(r"#{1,6}\s", stripped):
            level = len(stripped) - len(stripped.lstrip("#"))
            out.append(f"<h{level}>" + inline(stripped[level:].strip()) + f"</h{level}>")
            i += 1
        elif re.fullmatch(r"[-*_]{3,}", stripped):
            out.append("<hr />")
            i += 1
        elif stripped.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(table_cells(lines[i]))
                i += 1
            has_header = len(rows) > 1 and all(re.fullmatch(r":?-{2,}:?", c) for c in rows[1])
            header, body = (rows[0], rows[2:]) if has_header else (None, rows)
            width = len(rows[0])
            table = '<table class="wrapped"><colgroup>' + "<col />" * width + "</colgroup><tbody>"
            if header:
                table += "<tr>" + "".join(f"<th>{inline(c)}</th>" for c in header) + "</tr>"
            for row in body:
                if len(row) != width:
                    sys.exit(f"Tabellenzeile mit {len(row)} statt {width} Spalten: {'|'.join(row)}")
                table += "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in row) + "</tr>"
            out.append(table + "</tbody></table>")
        elif LIST_ITEM.match(line):
            storage, i = build_list(lines, i)
            out.append(storage)
        elif stripped.startswith(">"):
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip().lstrip(">").strip())
                i += 1
            out.append("<blockquote><p>" + inline(" ".join(q for q in quote if q)) + "</p></blockquote>")
        else:
            paragraph = []
            while i < len(lines) and lines[i].strip() and not re.match(r"\s*(#{1,6}\s|\||>|```|~~~|<!--)", lines[i]) \
                    and not LIST_ITEM.match(lines[i]) and not PLACEHOLDER.fullmatch(lines[i].strip()):
                paragraph.append(lines[i].strip())
                i += 1
            out.append("<p>" + inline(" ".join(paragraph)) + "</p>")
    return "".join(out)


def well_formed(body):
    """Parse check with the Confluence namespaces declared; HTML entities do not count."""
    probe = re.sub(r"&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)\w+;", "", body)
    root = ('<root xmlns:ac="http://atlassian.com/content" xmlns:ri="http://atlassian.com/resource/identifier">'
            + probe + "</root>")
    try:
        ET.fromstring(root)
        return None
    except ET.ParseError as error:
        return str(error)


def build(args):
    with open(args.text, encoding="utf-8") as handle:
        body = markdown_to_storage(handle.read())
    macros = {}
    for name in sorted(os.listdir(args.macro_dir)):
        found = re.fullmatch(r"macro-(\d+)\.xml", name)
        if found:
            with open(os.path.join(args.macro_dir, name), encoding="utf-8", newline="") as handle:
                macros[int(found.group(1))] = handle.read()
    problems, used = [], set()

    def put_back(match):
        number = int(match.group(1))
        if number not in macros:
            problems.append(f"Platzhalter {match.group(0)} hat keine Datei macro-{number:02d}.xml")
            return match.group(0)
        used.add(number)
        return macros[number]

    body = PLACEHOLDER.sub(put_back, body)
    for number in sorted(set(macros) - used):
        problems.append(f"Makro {{{{macro:{number}}}}} fehlt im Text ({describe(macros[number])[0]})")
    if args.original:
        with open(args.original, encoding="utf-8", newline="") as handle:
            original = handle.read()
        for macro_id in sorted(set(re.findall(r'ac:macro-id="([^"]+)"', original))):
            before = original.count(f'ac:macro-id="{macro_id}"')
            after = body.count(f'ac:macro-id="{macro_id}"')
            if before != after:
                problems.append(f"macro-id {macro_id}: {before}× im Original, {after}× im Ergebnis")
    error = well_formed(body)
    if error:
        problems.append(f"Kein gültiges XML: {error}")
    with open(args.output, "w", encoding="utf-8", newline="") as handle:
        handle.write(body)
    print(f"{args.output}: {len(body)} Zeichen, {len(used)} von {len(macros)} Makros eingesetzt")
    for problem in problems:
        print("FEHLER  " + problem)
    sys.exit(1 if problems else 0)


def main():
    parser = argparse.ArgumentParser(description="Markdown ↔ Confluence-Storage für clear-docs-de, Makros unverändert.")
    commands = parser.add_subparsers(dest="command", required=True)
    one = commands.add_parser("extract", help="Makros und Bilder einer Seite sichern, Platzhalter setzen")
    one.add_argument("page", help="Seite im Storage-Format (.xml)")
    one.add_argument("macro_dir", help="Ordner für die gesicherten Makros")
    one.set_defaults(run=extract)
    two = commands.add_parser("build", help="Markdown in Storage-Format umwandeln und Makros einsetzen")
    two.add_argument("text", help="umgeschriebener Text (Markdown mit {{macro:N}})")
    two.add_argument("macro_dir", help="Ordner aus dem Schritt extract")
    two.add_argument("-o", "--output", required=True, help="Zieldatei für den Storage-Inhalt")
    two.add_argument("--original", help="Original-Seite: prüft, dass jede ac:macro-id erhalten ist")
    two.set_defaults(run=build)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
