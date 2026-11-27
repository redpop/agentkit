#!/usr/bin/env python3
"""Wiktionary lookup per word: which languages know it, and what it means.

Uses the English Wiktionary REST API, which covers words of many languages.
Waits 3 seconds between words; faster requests get HTTP 429.

Usage: PYTHONIOENCODING=utf-8 python3 -I wk.py word1 word2 ...
"""
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://en.wiktionary.org/api/rest_v1/page/definition/"
UA = {"User-Agent": "name-research-script/1.0"}


def lookup(word):
    req = urllib.request.Request(API + urllib.parse.quote(word), headers=UA)
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    out = []
    for lang, entries in data.items():
        for e in entries[:2]:
            defs = [
                re.sub(r"<[^>]+>", "", d.get("definition", ""))[:90]
                for d in e.get("definitions", [])[:2]
            ]
            out.append(f"{lang}/{e.get('partOfSpeech')}: {defs}")
    return " | ".join(out)


def main(words):
    if not words:
        print(__doc__.strip(), file=sys.stderr)
        return 1
    for i, w in enumerate(words):
        if i:
            time.sleep(3)
        try:
            print(w, "=>", lookup(w), flush=True)
        except urllib.error.HTTPError as e:
            print(w, "=>", "not found" if e.code == 404 else f"HTTP {e.code}", flush=True)
        except Exception as e:
            print(w, "=> error", str(e)[:40], flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
