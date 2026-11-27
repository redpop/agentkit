# Check Chain: Commands, Status Codes, Traps

Every step of `find-name` step C with its command and how to read the answer. `$S` is the
scratchpad, `$K` is `${CLAUDE_PLUGIN_ROOT}/skills/find-name/scripts`.

```bash
cd "$S" || exit 1
```

## 1. Vulgar substrings (`risk_scan.py`)

```bash
PYTHONIOENCODING=utf-8 python3 -I "$K/risk_scan.py" --file names.txt
```

Offline, so it runs first on the whole list. It reads the substring table in `language-risks.md`
and prints `name => substring (lang: meaning)` per hit; the count goes to stderr. Add languages with
`--extra more.tsv` (`substring<TAB>lang<TAB>meaning` per line). A hit is a signal: `fut` inside a
name is read differently from a name that starts with it. Judge, then keep or reject.

## 2. DNS pre-filter (`pre.sh`)

```bash
xargs -P 8 -n 1 sh "$K/pre.sh" -t de < names.txt > nx.txt
```

Prints each name whose main-market domain (`-t`, default `de`) answers NXDOMAIN. That means
"probably free", not "free": a domain can be registered without name servers. Confirm every
survivor in step 3. A name `dig` cannot resolve (SERVFAIL, timeout) goes to stderr as
`unresolved`: check it in step 3 instead of dropping it.
The only script that may run in parallel, because it asks DNS, not a whois server.

## 3. Core domains (`chk.sh`)

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

## 4. Extra TLDs (`tlds.sh`)

```bash
sh "$K/tlds.sh" krevalo zintora
```

`.eu`, `.at`, `.it` by whois, `.ch`, `.io`, `.org` by RDAP. `free`, `taken`, or `?` for an empty,
quota or error reply. nic.at has a query quota: finalists only.

## 5. Companies, apps, `.com` owner (`q.py`)

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

## 6. EU trade marks: EUIPO eSearch (browser)

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

**Trap: no count means "not checked".** A stem with zero marks shows `Trade marks` without a
number, and so does a search that has not finished – sometimes after more than 30 s, even for a
stem with many marks. Run a **control search** once per session with a stem known to have marks
(`nvidi`). Only when the control shows a count in the same session is a missing count for a
candidate read as 0 hits. When the control shows no count either, click the visible Search button
and read again; if it still shows none, report eSearch as not checked for that round, never as
clean.

**Details** – status, expiry date, owner and the full list of goods and services:

```text
https://euipo.europa.eu/eSearch/?d=<number>#details/trademarks/<number>
```

**Read the nearest marks in detail.** For the three to five marks closest to a candidate, open the
details page and name these points in the result, not only the classes:

- **Type:** a figurative mark protects mainly its design; the risk is lower than for a word mark.
- **Limitations in the list of goods,** such as "all aforementioned goods related to the
  hospitality industry": classes 9 and 42 on paper, a narrow field in fact.
- **Owner and strength:** a group that markets the name opposes more readily than a private person.
  Check with a search engine whether the mark is active in the market.
- **Ending family:** when a candidate shares four or five final letters with marks in the core
  classes, search `*<ending>*` as well. A vowel swap that dodges one family easily lands in the
  next, for example from a figurative mark for restaurant software to a word mark of an industrial
  group.

**Limits of `stem*`:**

- It finds only marks that contain the stem. Neighbours one letter away are missing. Illustration:
  `telav*` does not find TELIVO (one vowel different) or ETLAVO (two letters swapped).
- National marks are missing (a German mark only at the DPMA).
- Three-syllable sound names sit in a dense field. Before recommending one, get the TMview
  screenshot (step 10).
- **Grace period for use, as a timeline.** It runs five years from the registration date
  ("Registration date" on the details page). After that, an owner who opposes must show genuine use
  in the five years before the filing date of the new mark, so use up to a rename still counts.
  Revocation for non-use is possible at the earliest five years after the last use. Illustration:
  registered 12/2020, company renamed 12/2024 – probably still a basis for opposition until about
  the end of 2029. A pre-screen, not legal advice.

## 7. Neighbours (`neighbors.py`)

```bash
PYTHONIOENCODING=utf-8 python3 -I "$K/neighbors.py" krevalo zintora
```

For the best 8 candidates of a round. Finalists have failed in the TMview screenshot on marks one
letter away in the core classes 9, 35 and 42 – a vowel swapped, a first consonant swapped, two
letters transposed – which neither the `stem*` search in eSearch nor any national register in it
shows. The script builds 4 to 6 such spellings per name (one of each kind first: vowel, similar
first consonant, ending `-ia`/`-ea`/`-o`/`-a`, transposition), asks DNS for their `.de`, and for
each existing one prints the page title and North Data's suggestions:

```text
== krevalo
  krivalo.de no DNS
  grevalo.de exists | title=Grevalo – IT-Beratung | ND=[('Grevalo GmbH', 'Köln')]
```

(Illustration; the names are invented.) The labels report DNS, not availability: `no DNS` can
still be registered without name servers. The step asks who holds a neighbour, not whether it is
free. An active company or brand in a related field – software,
consulting, or the user's own classes – is a red signal: name it in the result and ask for the
TMview screenshot first. A parked domain or a shop page is not.

## 8. Web search

Search the exact name in quotes. Look for:

- people-search sites among the hits – a sign of a first name, even a rare one
- a place, river or region of that name
- apps with near spellings (one letter changed, doubled or dropped) – also search the App Store
  for them directly

**"Not found" only after a search engine in the browser.** A web search tool with its own index
missed, on one day, a brand sold on Japanese marketplaces, an Italian limited company listed only in
business registers, and a Catalan verb form in a dictionary. Google and Bing in the built-in
browser answered without a CAPTCHA (2026); read the page with `get_page_text`, and set language and
country to the main market:

```text
https://www.google.com/search?q=%22<name>%22&hl=de&gl=de
https://www.bing.com/search?q=%22<name>%22&setlang=de&cc=DE
```

A claim counts as unconfirmed only when the browser search shows nothing either. The result names
the search engine that was checked.

**Read page 1 for every finalist,** at Google and Bing for the main market, not only whether there
are hits:

- Who owns page 1: profiles of people (a first name), another brand, people-search sites?
- "Did you mean …" shows the strongest neighbour word. Whoever types the name from memory lands
  there.
- Bing shows related words as hits, such as a well-known car model. That reveals a sound
  association.
- Google's AI overview shows how Google files the name, for example as a rare first name.
- When page 1 belongs to people or others, recommend getting the landing page indexed first
  (Search Console), and posting publicly only after that.

The EU VAT check VIES is no company check: small companies, Italian ones often, are not enabled for
it and show as INVALID although they exist.

## 9. Language risks (`wk.py`)

```bash
PYTHONIOENCODING=utf-8 python3 -I "$K/wk.py" krevalo kreval
```

Checks the full name and its parts against the English Wiktionary, which covers many languages.
3 s between words; faster gives HTTP 429. The checklist is in `language-risks.md`.

## 10. National trade marks: TMview (user only)

TMview blocks automated access. Give the user the link and ask for a screenshot of the hit list,
for every finalist in the round that names it:

```text
https://www.tmdn.org/tmview/#/tmview/results?page=1&pageSize=30&criteria=F&basicSearch=<name>&offices=EM,DE,WO,AT,CH,IT,ES,PT
```

Adjust `offices` to the target countries.

## Blocked sources

Leave these alone; they block automated access: TMview, Squadhelp, DuckDuckGo (html.duckduckgo.com,
bot check), lexigram.gr (verification page), greek-language.gr (HTTP 403). For Greek, use
Wiktionary or ask the user.

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

- **Words of the main-market language with a Romance ending:** about 80 % free `.de` (123 of 154).
  But the ear splits them into "word + ending", and abroad the reading tips over: `w`, `ei`, `eu`,
  a silent `h` in Romance languages, false friends in English. The direction hardly pays.
- **Roots from very small languages** carry strong stories but quickly feel foreign to users. Ask
  about the sound early.

## macOS and zsh

- Quote glob patterns (`--include='*.md'`), or zsh stops with `no matches found`.
- `cd "$S" || exit 1` before every scratchpad command.
- Run Python from a script file with `PYTHONIOENCODING=utf-8`; inline code with non-ASCII output can
  fail with `character not in range`.
