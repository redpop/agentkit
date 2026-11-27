#!/usr/bin/env python3
"""Scan candidate names for vulgar and derogatory substrings.

Reads the table under "## Vulgar and derogatory substrings" in
knowledge/language-risks.md and prints every candidate that contains an entry,
with language and meaning. A pre-filter before the manual language check, not a
verdict. Matching ignores case and diacritics.

Usage: PYTHONIOENCODING=utf-8 python3 -I risk_scan.py name1 name2 ...
       PYTHONIOENCODING=utf-8 python3 -I risk_scan.py --file names.txt [--extra more.tsv]

--extra adds entries for further languages, one per line: substring<TAB>lang<TAB>meaning
"""
import argparse
import pathlib
import sys
import unicodedata

HEADING = "## Vulgar and derogatory substrings"
TABLE = pathlib.Path(__file__).resolve().parents[3] / "knowledge" / "language-risks.md"


def fold(s):
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower().replace("ß", "ss")


def load_table(path):
    entries, inside = [], False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            inside = line.strip() == HEADING
            continue
        if not inside or not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3 or cells[0] in ("Substring", "---") or set(cells[0]) <= {"-"}:
            continue
        entries.append((fold(cells[0]), cells[1], cells[2]))
    return entries


def load_extra(path):
    entries = []
    for line in pathlib.Path(path).read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) >= 3 and parts[0].strip() and not line.startswith("#"):
            entries.append((fold(parts[0].strip()), parts[1].strip(), parts[2].strip()))
    return entries


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("names", nargs="*")
    ap.add_argument("--file", help="one name per line")
    ap.add_argument("--extra", help="TSV: substring, lang, meaning")
    ap.add_argument("--table", default=str(TABLE), help="language-risks.md to read")
    a = ap.parse_args()

    names = list(a.names)
    if a.file:
        names += [n.strip() for n in pathlib.Path(a.file).read_text(encoding="utf-8").splitlines()]
    names = [n for n in names if n]
    if not names:
        ap.print_usage(sys.stderr)
        return 1

    entries = load_table(pathlib.Path(a.table))
    if not entries:
        print(f"risk_scan.py: no entries under '{HEADING}' in {a.table}", file=sys.stderr)
        return 1
    if a.extra:
        entries += load_extra(a.extra)

    hits = 0
    for n in names:
        found = [f"{sub} ({lang}: {meaning})" for sub, lang, meaning in entries if sub in fold(n)]
        if found:
            hits += 1
            print(f"{n} => " + "; ".join(found))
    print(f"risk_scan: {hits} of {len(names)} names with hits, {len(entries)} entries checked",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
