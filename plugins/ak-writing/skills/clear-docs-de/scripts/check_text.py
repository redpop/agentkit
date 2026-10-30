#!/usr/bin/env python3
"""Check a German Markdown text against the writing rules of the clear-docs-de skill.

Usage:
  python3 check_text.py NEW.md                      # write mode: rules only
  python3 check_text.py NEW.md --original OLD.md    # rewrite mode: rules + content kept
  python3 check_text.py NEW.md --original page.xml  # original as Confluence storage format

Exit code 1 when at least one FEHLER was found, 0 otherwise.
Standard library only, so it runs wherever python3 runs.
"""

import argparse
import html
import re
import sys
from collections import Counter

MAX_INSTRUCTION = 20
MAX_DESCRIPTION = 25
MAX_PARAGRAPH_SENTENCES = 6

# Abbreviations whose dots do not end a sentence. Spaces inside them become
# non-breaking spaces so that "z. B." counts as one word.
ABBREVIATIONS = [
    "z. B.", "z.B.", "d. h.", "d.h.", "u. a.", "u.a.", "o. Ä.", "o. ä.", "i. d. R.", "u. U.",
    "bzw.", "ggf.", "vs.", "usw.", "etc.", "evtl.", "inkl.", "exkl.", "zzgl.", "bspw.", "sog.",
    "vgl.", "ca.", "Nr.", "Abb.", "Kap.", "Tab.", "Dr.", "Prof.", "max.", "min.", "Mio.", "Mrd.",
    "Std.", "Min.", "Sek.", "S.", "Jan.", "Feb.", "Apr.", "Jun.", "Jul.", "Aug.", "Sep.", "Sept.",
    "Okt.", "Nov.", "Dez.",
]

# Abbreviations the rules want replaced or explained. "z. B." and "d. h." are
# left out on purpose: readers know them.
FLAGGED_ABBREVIATIONS = [
    "ggf.", "bzw.", "vs.", "u. a.", "u.a.", "usw.", "etc.", "evtl.", "i. d. R.", "o. Ä.", "o. ä.",
    "u. U.", "bspw.", "sog.", "inkl.", "zzgl.",
]

# Acronyms most readers of technical documentation know. Everything else in
# capitals should be explained or listed in the term table.
KNOWN_ACRONYMS = {
    "API", "CLI", "CSS", "CSV", "DB", "DNS", "HTML", "HTTP", "HTTPS", "ID", "IDE", "IT", "JSON",
    "JS", "KI", "MCP", "MR", "OK", "PDF", "PHP", "PNG", "PR", "SQL", "SSH", "SSO", "SVG", "UI",
    "URL", "USB", "UTF", "XML", "YAML", "CI", "CD", "VPN", "TLS", "SSL", "IP", "OS", "PC", "GB",
    "MB", "KB", "TB", "SVN", "NPM", "AI", "UX", "FAQ", "GPU", "CPU", "RAM", "ASD", "STE", "README",
    "TODO",
}

MONTHS = ("Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember")

NOMINAL_SUFFIX = re.compile(r"\w{3,}(ung|heit|keit|ion|ität|nis|ierung)(en|se)?\b", re.IGNORECASE)
PASSIVE_AUX = re.compile(r"\b(wird|werden|wurde|wurden|worden)\b", re.IGNORECASE)
PARTICIPLE = re.compile(r"\b(ge\w{2,}(t|en)|\w{3,}iert)\b")

CODE_SPAN = re.compile(r"(`+)(.+?)\1")
PLACEHOLDER = re.compile(r"\{\{macro:\d+\}\}")
URL = re.compile(r"https?://[^\s)>\]]+")
DATE = re.compile(r"\b(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4})\b")
VERSION = re.compile(r"(?<![\w.])v?\d+\.\d+(?:\.\d+)+(?:-[\w.]+)?(?![\w.]*\d)|(?<![\w.])v\d+(?:\.\d+)?\b")
NUMBER = re.compile(r"(?<![\w.,])\d+(?:[.,]\d+)*(?![\w])")
TICKET = re.compile(r"\b[A-Z][A-Z0-9]+-\d+\b")
IMAGE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)[^)]*\)")
LINK = re.compile(r"\[([^\]]*)\]\(([^)\s]+)[^)]*\)")
LIST_ITEM = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$")
FENCE = re.compile(r"^\s*(```+|~~~+)")


class Unit:
    """A piece of running text: a paragraph, a list item or a table cell."""

    def __init__(self, kind, line, text):
        self.kind = kind
        self.line = line
        self.text = text


def parse_markdown(source):
    """Split Markdown into text units, fenced blocks and table cells."""
    units, fences, tables = [], [], []
    lines = source.splitlines()
    buffer, buffer_line, buffer_kind = [], 0, None
    i = 0

    def flush():
        nonlocal buffer, buffer_kind
        if buffer:
            units.append(Unit(buffer_kind, buffer_line, " ".join(buffer)))
        buffer, buffer_kind = [], None

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        fence = FENCE.match(line)
        if fence:
            flush()
            marker = fence.group(1)
            block, i = [], i + 1
            while i < len(lines) and not lines[i].strip().startswith(marker):
                block.append(lines[i].rstrip())
                i += 1
            fences.append("\n".join(block).strip("\n"))
            i += 1
            continue
        if stripped.startswith("<!--"):
            flush()
            while i < len(lines) and "-->" not in lines[i]:
                i += 1
            i += 1
            continue
        if re.match(r"#{1,6}\s", stripped):
            flush()
            units.append(Unit("heading", i + 1, stripped.lstrip("#").strip()))
            i += 1
            continue
        if not stripped or re.fullmatch(r"[-*_]{3,}", stripped):
            flush()
            i += 1
            continue
        if stripped.startswith("|"):
            flush()
            row = [c.strip() for c in re.split(r"(?<!\\)\|", stripped.strip("|"))]
            if not all(re.fullmatch(r":?-{2,}:?", c) for c in row if c):
                tables.append((i + 1, row))
                for cell in row:
                    if cell:
                        units.append(Unit("table", i + 1, cell))
            i += 1
            continue
        if stripped.startswith(">"):
            stripped = stripped.lstrip("> ").strip()
            if not stripped:
                i += 1
                continue
        item = LIST_ITEM.match(line)
        if item:
            flush()
            buffer_kind = "numbered" if item.group(2)[0].isdigit() else "list"
            buffer, buffer_line = [item.group(3)], i + 1
            i += 1
            continue
        if buffer_kind in ("numbered", "list") and line.startswith((" ", "\t")):
            buffer.append(stripped)
            i += 1
            continue
        if buffer_kind != "paragraph":
            flush()
            buffer_kind, buffer_line = "paragraph", i + 1
        buffer.append(stripped)
        i += 1
    flush()
    return units, fences, tables


def plain(text):
    """Remove everything that is not running text: code spans, links, markup."""
    text = CODE_SPAN.sub("", text)
    text = PLACEHOLDER.sub("", text)
    text = IMAGE.sub("", text)
    text = LINK.sub(r"\1", text)
    text = URL.sub("", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"(\*\*|__|\*|(?<!\w)_|_(?!\w))", "", text)
    return text.replace("\\|", "|")


def protect(text):
    """Hide dots that do not end a sentence."""
    for abbreviation in sorted(ABBREVIATIONS, key=len, reverse=True):
        pattern = r"(?<![\wÄÖÜäöüß])" + re.escape(abbreviation)
        guarded = abbreviation.replace(".", "\u2024").replace(" ", "\u00a0")
        text = re.sub(pattern, guarded, text)
    # Ordinals: "am 3. Oktober", "die 2. Stufe"
    text = re.sub(r"(\d)\.(?=\s+(?:[a-zäöüß]|(?:" + MONTHS + r")\b))", "\\1\u2024", text)
    return text


def sentences(text):
    text = protect(plain(text)).strip()
    if not text:
        return []
    parts, start = [], 0
    for match in re.finditer(r"[.!?…][“”\"»)\]]?\s+", text):
        following = text[match.end():match.end() + 1]
        if following and (following.isalnum() or following in "„\"(["):
            parts.append(text[start:match.end()].strip())
            start = match.end()
    parts.append(text[start:].strip())
    return [p for p in parts if re.search(r"[\wÄÖÜäöüß]", p)]


def words(sentence):
    return [w for w in re.split(r"[ \t\n]+", sentence) if re.search(r"[\wÄÖÜäöüß]", w)]


def show(sentence, limit=90):
    text = sentence.replace("\u2024", ".").replace("\u00a0", " ").replace("\n", " ⏎ ")
    return text if len(text) <= limit else text[: limit - 1] + "…"


def print_sentences(units):
    for unit in units:
        for sentence in sentences(unit.text):
            print(f"{unit.line:>5} {len(words(sentence)):>3}  {show(sentence, 200)}")


def check_rules(units, tables, report):
    term_cells = {cell for _, row in tables for cell in row}
    term_text = " ".join(term_cells)
    for unit in units:
        if unit.kind == "heading":
            continue
        found = sentences(unit.text)
        if unit.kind == "paragraph" and len(found) > MAX_PARAGRAPH_SENTENCES:
            report.warn(unit.line, f"Absatz mit {len(found)} Sätzen (höchstens {MAX_PARAGRAPH_SENTENCES})")
        for sentence in found:
            count = len(words(sentence))
            if count > MAX_DESCRIPTION:
                report.error(unit.line, f"{count} Wörter (höchstens {MAX_DESCRIPTION}): „{show(sentence)}“")
            elif count > MAX_INSTRUCTION and unit.kind == "numbered":
                report.error(unit.line, f"{count} Wörter in einem Arbeitsschritt (höchstens {MAX_INSTRUCTION}): „{show(sentence)}“")
            elif count > MAX_INSTRUCTION:
                report.warn(unit.line, f"{count} Wörter: zu lang, falls der Satz eine Anweisung ist (höchstens {MAX_INSTRUCTION}): „{show(sentence)}“")
            if PASSIVE_AUX.search(sentence) and PARTICIPLE.search(sentence):
                report.hint(unit.line, f"Passiv? „{show(sentence, 60)}“")
            nominal = NOMINAL_SUFFIX.findall(sentence)
            if len(nominal) >= 3:
                report.hint(unit.line, f"Nominalstil? {len(nominal)} Substantive auf -ung/-heit/-keit/-ion: „{show(sentence, 60)}“")
        text = plain(unit.text)
        for word in re.findall(r"[\wÄÖÜäöüß]+(?:-[\wÄÖÜäöüß]+)*", text):
            parts = word.split("-")
            if len(parts) > 3:
                report.hint(unit.line, f"Wort aus {len(parts)} Teilen: „{word}“ (höchstens 3)")
            elif len(parts) == 1 and len(word) >= 20 and word[0].isupper():
                report.hint(unit.line, f"Langes zusammengesetztes Wort: „{word}“ (mit Bindestrich gliedern?)")
        for abbreviation in FLAGGED_ABBREVIATIONS:
            if re.search(r"(?<![\wÄÖÜäöüß])" + re.escape(abbreviation), text):
                report.hint(unit.line, f"Abkürzung „{abbreviation}“ ausschreiben oder ersetzen")
        if unit.kind != "table":
            for acronym in sorted(set(re.findall(r"\b[A-ZÄÖÜ][A-ZÄÖÜ0-9]{1,6}\b", text))):
                known = acronym in KNOWN_ACRONYMS or acronym.rstrip("0123456789") in KNOWN_ACRONYMS
                if not known and not re.search(r"\b" + acronym + r"\b", term_text):
                    report.hint(unit.line, f"„{acronym}“ erklären oder in die Begriffstabelle aufnehmen")


def storage_to_markdown(source):
    """Rough view of Confluence storage format, good enough to extract facts.

    Macros and images become {{macro:N}} with the numbers of `confluence.py extract`,
    because they go back into the page unchanged.
    """
    # Keep the installed plugin directory free of a __pycache__ folder.
    sys.dont_write_bytecode = True
    from confluence import find_macros

    pieces, last = [], 0
    for number, (start, end) in enumerate(find_macros(source), 1):
        pieces += [source[last:start], f" {{{{macro:{number}}}}} "]
        last = end
    source = "".join(pieces) + source[last:]
    source = re.sub(r"<code>(.*?)</code>", lambda m: "`" + m.group(1) + "`", source, flags=re.S)
    source = re.sub(r"</(p|h\d|li|tr|td|th|ul|ol|table)>", "\n", source)
    source = re.sub(r"<[^>]+>", " ", source)
    return html.unescape(source)


def facts(source):
    """Everything the rewrite must keep, as a Counter per kind."""
    units, fences, _ = parse_markdown(source)
    spans, prose = [], []
    for unit in units:
        spans += [m.group(2).strip() for m in CODE_SPAN.finditer(unit.text)]
        prose.append(CODE_SPAN.sub(" ", unit.text))
    # Code spans and fenced blocks are compared whole; numbers inside them
    # (colours in a diagram, line numbers) are not facts of the text.
    prose_text = PLACEHOLDER.sub(" ", URL.sub(" ", "\n".join(prose)))
    without_dates = DATE.sub(" ", prose_text)
    return {
        "Code-Span": Counter(spans),
        "Codeblock/Diagramm": Counter(fences),
        "Bild": Counter(IMAGE.findall(source)),
        "Platzhalter": Counter(PLACEHOLDER.findall(source)),
        "URL": Counter(u.rstrip(".,;:") for u in URL.findall("\n".join(prose + spans))),
        "Datum": Counter(DATE.findall(prose_text)),
        "Version": Counter(VERSION.findall(without_dates)),
        "Ticket": Counter(TICKET.findall(prose_text)),
        "Zahl": Counter(NUMBER.findall(VERSION.sub(" ", without_dates))),
    }


def check_kept(original, rewritten, report):
    old, new = facts(original), facts(rewritten)
    for kind, items in old.items():
        for item in items:
            if item not in new[kind]:
                report.error(0, f"{kind} aus dem Original fehlt: „{show(item, 70)}“")
    for kind in ("Datum", "Version", "Zahl", "Ticket", "URL"):
        for item in new[kind]:
            if item not in old[kind]:
                report.warn(0, f"{kind} steht nicht im Original: „{show(item, 70)}“ (erfunden?)")


class Report:
    def __init__(self):
        self.entries = []

    def error(self, line, message):
        self.entries.append((line, "FEHLER", message))

    def warn(self, line, message):
        self.entries.append((line, "WARNUNG", message))

    def hint(self, line, message):
        self.entries.append((line, "HINWEIS", message))

    def count(self, level):
        return sum(1 for _, lvl, _ in self.entries if lvl == level)

    def print(self, show_hints):
        for line, level, message in self.entries:
            if level == "HINWEIS" and not show_hints:
                continue
            where = f"Zeile {line}" if line else "Inhalt"
            print(f"{where:>10}  {level:<8} {message}")
        print(f"\n{self.count('FEHLER')} Fehler, {self.count('WARNUNG')} Warnungen, {self.count('HINWEIS')} Hinweise")


def main():
    parser = argparse.ArgumentParser(description="Prüft einen deutschen Markdown-Text gegen die Schreibregeln von clear-docs-de.")
    parser.add_argument("text", help="neuer oder umgeschriebener Text (Markdown)")
    parser.add_argument("--original", help="Original (Markdown oder Confluence-Storage .xml): prüft, ob alle Fakten erhalten sind")
    parser.add_argument("--no-hints", action="store_true", help="nur Fehler und Warnungen ausgeben")
    parser.add_argument("--sentences", action="store_true", help="nur die erkannten Sätze mit Zeile und Wortzahl ausgeben")
    args = parser.parse_args()

    with open(args.text, encoding="utf-8") as handle:
        text = handle.read()
    report = Report()
    units, _, tables = parse_markdown(text)
    if args.sentences:
        print_sentences(units)
        return
    check_rules(units, tables, report)
    if not tables:
        report.hint(0, "Keine Tabelle gefunden: Fehlt die Begriffstabelle am Anfang?")
    if args.original:
        with open(args.original, encoding="utf-8") as handle:
            original = handle.read()
        if args.original.endswith((".xml", ".html")) or "<ac:" in original:
            original = storage_to_markdown(original)
        check_kept(original, text, report)
    report.print(show_hints=not args.no_hints)
    sys.exit(1 if report.count("FEHLER") else 0)


if __name__ == "__main__":
    main()
