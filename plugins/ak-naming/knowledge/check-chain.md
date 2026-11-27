# Check Chain: Commands, Status Codes, Traps

Every step of `find-name` step C with its command and how to read the answer. `$S` is the
scratchpad, `$K` is `${CLAUDE_PLUGIN_ROOT}/skills/find-name/scripts`.

```bash
cd "$S" || exit 1
```

## 1. DNS pre-filter (`pre.sh`)

```bash
xargs -P 8 -n 1 sh "$K/pre.sh" -t de < names.txt > nx.txt
```

Prints each name whose main-market domain (`-t`, default `de`) answers NXDOMAIN. That means
"probably free", not "free": a domain can be registered without name servers. Confirm every
survivor in step 2. A name `dig` cannot resolve (SERVFAIL, timeout) goes to stderr as
`unresolved`: check it in step 2 instead of dropping it.
The only script that may run in parallel, because it asks DNS, not a whois server.

## 2. Core domains (`chk.sh`)

```bash
sh "$K/chk.sh" -t de $(cat nx.txt)
```

Output: `krevalo de=free com=free get=- app=404`

| Field | Values |
| --- | --- |
| `de` | `free` available, `connect` registered, `redemptionPeriod` deleted but not yet available, `?` no answer |
| other `-t` TLD | `free`, `taken` (domain record found), `?` no answer, quota, or a reply format the script does not know |
| `com` | `free` available, `taken` registered, `?` no answer, rate limit or error – check again later |
| `get` | `get<name>.com`, checked only when `.com` is taken |
| `app` | RDAP HTTP code: `404` available, `200` registered, other codes unknown |

`-t <tld>` sets the main-market domain; the column is named after it (`fr=free`). For `.de` the
script asks DENIC, for any other TLD the whois server IANA lists for it. Some registries give no
public whois (`.es` among them): the column stays `?`, and the domain needs a check at the
registry's own web search before a name becomes a finalist.

The script waits 1.2 s per name and retries `.app` once after an HTTP 429.

## 3. Extra TLDs (`tlds.sh`)

```bash
sh "$K/tlds.sh" krevalo zintora
```

`.eu`, `.at`, `.it` by whois, `.ch`, `.io`, `.org` by RDAP. `free`, `taken`, or `?` for an empty,
quota or error reply. nic.at has a query quota: finalists only.

## 4. Companies, apps, `.com` owner (`q.py`)

```bash
PYTHONIOENCODING=utf-8 python3 -I "$K/q.py" krevalo zintora
```

- `ND=` – up to three North Data company suggestions. A company with the same name in a related
  field is a conflict; one in an unrelated field and another country is a note.
- `Appde=`, `Appus=` – the App Store search returns the top three hits even for a nonsense word, so
  only a hit whose title contains the name or a near spelling counts.
- `com-title=` – the title of `http://<name>.com`. `unreachable` means no website, not a free
  domain.

**A taken `.com`:** `whois -h whois.verisign-grs.com <name>.com` shows the creation date and the
name servers. Name servers of AFTERNIC, BRANDBUCKET, SQUADHELP or DAN mean "for sale". Prices are
readable at `afternic.com/domain/<name>.com` and `brandbucket.com/names/<name>`. Squadhelp blocks
bots through Cloudflare: do not try.

## 5. EU trade marks: EUIPO eSearch (browser)

Works in a browser tool (the built-in browser or Claude in Chrome). Without one, skip and list it as
open.

**Search URL** – the query parameter before `#` is required, or the single-page app shows the
previous result list:

```text
https://euipo.europa.eu/eSearch/?s=<stem>#basic/1+1+1+1/100+100+100+100/<stem>*
```

**Read the result** with this snippet. It waits up to 45 s, because the trade mark count often
arrives after 20 s or more while designs and owners show at once:

```js
let m=null,t='';for(let i=0;i<45&&!m;i++){await new Promise(r=>setTimeout(r,1000));t=document.body.innerText;m=t.match(/Trade marks \((\d+)\)/);} const re=/(\d{9}) - ([^\n]+?) \+ info[\s\S]*?Nice Classification\n([^\n]*)\nTrade mark status\n([^\n]*)/g; let r,out=[]; while((r=re.exec(t))&&out.length<40){out.push(r[1]+' '+r[2]+' ['+r[3]+'] '+r[4]);} [location.hash, m?m[1]:'no count', out]
```

**Trap: no count is ambiguous.** A stem with zero marks shows `Trade marks` without a number, and so
does a search that has not finished. Run a **control search** once per session with a stem known to
have marks (`nvidi`). Only when the control shows a count is a missing count for a candidate read as
0 hits. When the control shows no count either, click the visible Search button and read again.

**Details** – status, expiry date, owner and the full list of goods and services:

```text
https://euipo.europa.eu/eSearch/?d=<number>#details/trademarks/<number>
```

**Limits of `stem*`:**

- It finds only marks that contain the stem. Neighbours one letter away are missing. Illustration:
  `telav*` does not find TELIVO (one vowel different) or ETLAVO (two letters swapped).
- National marks are missing (a German mark only at the DPMA).
- Three-syllable sound names sit in a dense field. Before recommending one, get the TMview
  screenshot (step 8).
- A mark registered more than five years ago must be in use. A company that has since renamed
  itself lowers the practical risk, but the mark stays on the register.

## 6. Web search

Search the exact name in quotes. Look for:

- people-search sites among the hits – a sign of a first name, even a rare one
- a place, river or region of that name
- apps with near spellings (one letter changed, doubled or dropped) – also search the App Store
  for them directly

## 7. Language risks (`wk.py`)

```bash
PYTHONIOENCODING=utf-8 python3 -I "$K/wk.py" krevalo kreval
```

Checks the full name and its parts against the English Wiktionary, which covers many languages.
3 s between words; faster gives HTTP 429. The checklist is in `language-risks.md`.

## 8. National trade marks: TMview (user only)

TMview blocks automated access. Give the user the link and ask for a screenshot of the hit list:

```text
https://www.tmdn.org/tmview/#/tmview/results?page=1&pageSize=30&criteria=F&basicSearch=<name>&offices=EM,DE,WO,AT,CH,IT,ES,PT
```

Adjust `offices` to the target countries.

## Blocked sources

Leave these alone; they block automated access: TMview, Squadhelp, lexigram.gr (verification page),
greek-language.gr (HTTP 403). For Greek, use Wiktionary or ask the user.

## Field data

From one search with about 1,500 checked names (German main market, 2026). Use it to size a round,
not as a rule:

| Word field | Free `.de` |
| --- | --- |
| soft Romance coined words | about 25–35 % |
| light and clarity (`lum-`, `seren-`, `mir-`) | about 25 % |
| companion roots from rare European languages | about 70 % |
| short three-syllable names | about 28 %; `.com` almost always taken or for sale at 2,000–3,000 $ |

The endings `-avia` and `-ivia` are crowded in the EU register.

## macOS and zsh

- Quote glob patterns (`--include='*.md'`), or zsh stops with `no matches found`.
- `cd "$S" || exit 1` before every scratchpad command.
- Run Python from a script file with `PYTHONIOENCODING=utf-8`; inline code with non-ASCII output can
  fail with `character not in range`.
