#!/usr/bin/env python3
"""Company register, App Store and .com page title per name.

North Data suggestions (company names), Apple App Store search for DE and US,
and the <title> of http://<name>.com. One line per name, one second apart.

Usage: PYTHONIOENCODING=utf-8 python3 -I q.py name1 name2 ...
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (name-check-script)"}
MAX_BYTES = 512 * 1024  # enough for a title or a JSON hit list


def get(url, as_json=True):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = resp.read(MAX_BYTES)
    return json.loads(data) if as_json else data.decode("utf-8", "replace")


def north_data(name):
    url = "https://www.northdata.com/suggest.json?query=" + urllib.parse.quote(name)
    hits = get(url).get("results", [])[:3]
    return [(h.get("title", "")[:40], h.get("description", "")) for h in hits]


def app_store(name, country):
    url = (
        "https://itunes.apple.com/search?entity=software&limit=3"
        f"&country={country}&term=" + urllib.parse.quote(name)
    )
    return [r.get("trackName", "")[:28] for r in get(url).get("results", [])]


def com_title(name):
    html = get(f"http://{name}.com", as_json=False)
    m = re.search(r"<title[^>]*>([^<]{0,80})", html, re.I)
    return m.group(1).strip() if m else "-"


def main(names):
    if not names:
        print(__doc__.strip(), file=sys.stderr)
        return 1
    for n in names:
        out = [n]
        try:
            out.append(f"ND={north_data(n)}")
        except Exception as e:  # report and go on with the next source
            out.append(f"ND=error {str(e)[:40]}")
        for c in ("de", "us"):
            try:
                out.append(f"App{c}={app_store(n, c)}")
            except Exception as e:
                out.append(f"App{c}=error {str(e)[:40]}")
        try:
            out.append(f"com-title={com_title(n)}")
        except Exception:
            out.append("com-title=unreachable")
        print(" | ".join(out), flush=True)
        time.sleep(1)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
