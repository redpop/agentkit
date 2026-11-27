#!/usr/bin/env python3
"""Neighbour check: spellings one edit away from a candidate, and who holds them.

eSearch prefix searches miss trade marks one letter away, and national registers
are not in eSearch at all. This builds 4 to 6 neighbour spellings per name (vowel
swapped, first consonant swapped for a similar one, ending -ia/-ea/-o/-a swapped,
two letters transposed), asks DNS whether their .de exists, and for each existing
one reads the page title and North Data's company suggestions.

The labels describe DNS, not registration: "no DNS" (NXDOMAIN) can still be a
registered domain without name servers, "exists" (a DNS answer) means someone
holds it. Availability is chk.sh's job.

An active company or brand in a related field (the user's Nice classes) is a red
signal. Judging that is yours; the script only reports.

Usage: PYTHONIOENCODING=utf-8 python3 -I neighbors.py [--max 6] name1 name2 ...
"""
import argparse
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

VOWELS = "aeiou"
SIMILAR = {
    "b": "p", "p": "b", "d": "t", "t": "d", "g": "k", "k": "g", "c": "k",
    "v": "f", "f": "v", "w": "v", "m": "n", "n": "m", "l": "r", "r": "l",
    "s": "z", "z": "s",
}
ENDINGS = ("ia", "ea", "o", "a")
UA = {"User-Agent": "Mozilla/5.0 (name-check-script)"}
MAX_BYTES = 512 * 1024


def variants(name, limit):
    """One neighbour of each kind first, then the rest, so a low --max keeps every kind."""
    kinds = [[], [], [], []]
    # 0. first vowel swapped for the two nearest other vowels
    for i, ch in enumerate(name):
        if ch in VOWELS:
            j = VOWELS.index(ch)
            kinds[0] += [name[:i] + alt + name[i + 1:] for alt in (VOWELS[(j + 1) % 5], VOWELS[(j - 1) % 5])]
            break
    # 1. first consonant swapped for a similar one
    for i, ch in enumerate(name):
        if ch in SIMILAR:
            kinds[1].append(name[:i] + SIMILAR[ch] + name[i + 1:])
            break
    # 2. ending swapped
    for end in ENDINGS:
        if name.endswith(end):
            kinds[2] += [name[: -len(end)] + alt for alt in ENDINGS if alt != end]
            break
    # 3. two letters transposed: a middle pair, then the first pair
    if len(name) >= 3:
        m = len(name) // 2
        kinds[3] += [name[: m - 1] + name[m] + name[m - 1] + name[m + 1:], name[1] + name[0] + name[2:]]

    out = []
    for rank in range(3):
        for k in kinds:
            if rank < len(k):
                v = k[rank]
                if v != name and v not in out and re.fullmatch(r"[a-z0-9-]{2,63}", v):
                    out.append(v)
    return out[:limit]


def de_exists(name):
    try:
        r = subprocess.run(["dig", "NS", f"{name}.de", "+time=3", "+tries=2"],
                           capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return None
    m = re.search(r"status: ([A-Z]+)", r.stdout)
    if not m:
        return None
    return {"NXDOMAIN": False, "NOERROR": True}.get(m.group(1))


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=8) as resp:
        return resp.read(MAX_BYTES)


def title(name):
    try:
        html = fetch(f"http://{name}.de").decode("utf-8", "replace")
    except Exception:
        return "unreachable"
    m = re.search(r"<title[^>]*>([^<]{0,80})", html, re.I)
    return m.group(1).strip() if m else "-"


def north_data(name):
    try:
        url = "https://www.northdata.com/suggest.json?query=" + urllib.parse.quote(name)
        hits = json.loads(fetch(url)).get("results", [])[:3]
        return str([(h.get("title", "")[:40], h.get("description", "")) for h in hits])
    except Exception as e:
        return f"error {str(e)[:40]}"


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("names", nargs="*")
    ap.add_argument("--max", type=int, default=6, help="neighbours per name (default 6)")
    a = ap.parse_args()
    if not a.names:
        ap.print_usage(sys.stderr)
        return 1
    for raw in a.names:
        name = raw.strip().lower()
        if not re.fullmatch(r"[a-z0-9-]{2,63}", name):
            print(f"neighbors.py: skipped invalid name '{raw}'", file=sys.stderr)
            continue
        print(f"== {name}", flush=True)
        for v in variants(name, a.max):
            state = de_exists(v)
            if state is False:
                print(f"  {v}.de no DNS", flush=True)
                continue
            if state is None:
                print(f"  {v}.de unresolved: check with chk.sh", flush=True)
                continue
            print(f"  {v}.de exists | title={title(v)} | ND={north_data(v)}", flush=True)
            time.sleep(1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
