---
name: find-name
description: 'Find and screen names for a product, app, service or brand, so that only defensible finalists remain: free domains, no conflicting EU trade marks, companies or apps, no embarrassing meaning in the target languages. Use when the user asks to "find a name", "name my app", "product name", "brand name", "check this name", "is the domain free", "trade mark conflict", "does this name mean something bad in Spanish", or in German "Namen finden", "Produktname", "Markenname prüfen", "ist die Domain frei", "Markenkonflikt", "Sprachrisiko eines Namens". Not for naming code identifiers, files or variables, and not legal trade mark clearance.'
---

# Find a Name

Inventing a name stays a dialogue with the user. This skill adds the discipline around it: a fixed
check chain from cheap to expensive, the traps that cost real rounds before, and a result format
that keeps facts apart from judgement.

The check chain with every command, status code and browser snippet:
`${CLAUDE_PLUGIN_ROOT}/knowledge/check-chain.md`. The language-risk checklist:
`${CLAUDE_PLUGIN_ROOT}/knowledge/language-risks.md`. The second-opinion prompt:
`${CLAUDE_PLUGIN_ROOT}/knowledge/second-opinion.md`. The round brief for a subagent:
`${CLAUDE_PLUGIN_ROOT}/knowledge/round-brief.md`. Read the first two before the first check
round.

## Arguments

`$ARGUMENTS` is free text: a product description, a list of candidates to check, or both.

- `--check <names>` (`--check krevalo, zintora`) – skip to step C for those names.
- A description or nothing – start with step A.

## Rules

- **Facts and judgement apart.** Every result says what a source returned and when, and separately
  what is only an estimate (sound, fit, risk).
- **Never register or buy a domain**, never fill a registrar's form.
- **Never get around a bot block.** TMview, Squadhelp and some dictionary sites block automated
  access: leave them, or ask the user for a screenshot. No other user agent, no CAPTCHA, no proxy.
- **Keep rate limits:** the scripts sleep between names; do not run them in parallel, except
  `pre.sh` (DNS only).
- **Send no personal data** to an outside service: only candidate names go out.
- **Not legal advice.** The chain is a pre-screen. Say so once in the result. Do not push the user
  towards a lawyer; they decide whether and where to file. Filing fees as a reference, check the
  current ones: DPMA about 290 € for up to three classes, EUIPO from 850 € for one class.
- Answer in the user's language and follow their style preferences from memory.

## Workflow

### A. Brief

Ask only for what the user has not given yet, in one message:

1. Product and its story in one sentence.
2. Audience, markets and target countries. They set the languages for the risk check.
3. Nice classes. Default for software and services: 9, 35, 39, 41, 42, 45 – drop what does not
   apply.
4. Domain requirement. Default: the country TLD of the main market required (`.de` for Germany),
   plus `.app` or `get<name>.com`. A `.com` may be missing when it is parked or in unrelated use.
5. Sound taste: short or long, hard or soft, invented or real word. Read it from the user's memory
   when the host has one instead of asking again.
6. Exclusions: stems, letters, languages, names already rejected.

If memory holds a favourite, a reserve or exhausted word fields from earlier rounds, list them and
do not check them again.

### B. Generate

Story first, then sound. Pick two or three word fields from the story (what the product does, how
it feels, who it accompanies) and switch language areas on purpose: Latin and Romance stems,
Germanic, Greek, rare European languages. Avoid words from languages with a living cultural claim
(Swahili, Māori, Hawaiian, Sanskrit).

For short sound names, a generator of stem × ending helps (`kre-`, `zin-`, `tav-` × `-alo`, `-ora`,
`-ivo`), filtered through a block list of real words and first names. Produce 20 to 120 candidates
per round, lower-case, one per line, in a file in the scratchpad.

### C. Check chain, cheap to expensive

Run the steps in this order. A name that fails a step leaves the round with a one-sentence reason.
Commands and status codes are in `check-chain.md`.

1. **Vulgar substrings** – `risk_scan.py` checks the whole list offline against the substring
   table in `language-risks.md`. A hit is a signal to judge, not an automatic rejection.
2. **DNS pre-filter** – `pre.sh` keeps names whose main-market domain has no DNS record. `-t <tld>`
   sets that domain from the brief; the default is `.de`.
3. **Core domains** – `chk.sh`, with the same `-t <tld>`: the main-market domain and `.com` by
   whois, `get<name>.com` when `.com` is taken, `.app` by RDAP. A `?` for the main-market domain
   is not a pass: some registries (`.es`) answer no public whois, so check it at the registry's
   web search or ask the user before a name becomes a finalist.
4. **Extra TLDs, finalists only** – `tlds.sh`: `.eu`, `.at`, `.it`, `.ch`, `.io`, `.org`.
5. **Companies, apps, `.com` owner** – `q.py`: North Data, App Store DE and US, the `.com` page
   title. A taken `.com`: whois creation date and name servers show whether it is for sale.
6. **EU trade marks** – EUIPO eSearch in the browser, with a control search first. A pre-filter
   only: it misses one-letter neighbours and national marks. No count means "not checked". Read
   the three to five nearest marks in detail: type, limitations, owner, ending family, registration
   date.
7. **Neighbours, best 8 candidates** – `neighbors.py` builds 4 to 6 spellings one edit away,
   finds which of their `.de` exist, and reads page title and North Data for those. An active
   company or brand in a related field is a red signal. This catches most of what would otherwise
   fail only in the TMview screenshot.
8. **Web search** for the exact name: first name, place name, similar app names (search the App
   Store for neighbour spellings as well). "Not found" only after Google or Bing in the browser
   found nothing either; a web search tool alone misses real brands. For finalists, read page 1.
9. **Language risks** – the checklist in `language-risks.md`, with `wk.py` for Wiktionary.
10. **National trade marks, every finalist of every round** – the user opens TMview and sends a
    screenshot. Ask for it in the round that names the finalist, not at the end: a favourite that
    fails late costs every round built on it. Give them the link from `check-chain.md`. Agents
    never query TMview.
11. **Second opinion, optional** – fill `second-opinion.md` for another agent or model. Check
    every claim it makes before you repeat it, both ways: back what holds with a source, and call a
    claim unconfirmed only after a browser search, as in step 8.

**Division of work, for long searches.** A subagent or second model can generate 100 to 200 names
per round and run steps 1–5, 7 and 8 mechanically, from the brief in `round-brief.md`. The main
session keeps eSearch, the TMview request, the cross-check of language risks and the verdict, and
checks every subagent finding before it repeats it.

Scripts are in `${CLAUDE_PLUGIN_ROOT}/skills/find-name/scripts/`. Work in the scratchpad: `cd` into
it with `|| exit 1`, so an emptied scratchpad never makes the scripts write into a repository. Run
the Python scripts with `PYTHONIOENCODING=utf-8 python3 -I`. In zsh, quote glob patterns.

### D. Result per round

Write it in the user's language; the template is English:

````markdown
## Round <n>: <word fields tried>

<k> candidates generated, <m> left after domains, <f> finalists.

| | <benchmark (current favourite)> | <finalist 1> | <finalist 2> | <finalist 3> |
| --- | --- | --- | --- | --- |
| main TLD / .app / .com | | | | |
| EU marks (eSearch, date) | | | | |
| Companies, apps | | | | |
| Language risks | | | | |
| Sound, fit (estimate) | | | | |

**Rejected:** <name> – <one-sentence reason>; …

**Checked:** <sources and date>. **Estimated only:** <what>.
**Open:** TMview screenshot for every finalist, with the link from `check-chain.md`.

How do the finalists sound to you?
````

At most three finalists, always next to the current favourite as the benchmark. End by asking for
the user's gut feeling about the sound; that is their call, not the checks'.

Then save to memory, when the host has one: favourite, reserve, word fields exhausted in this round,
and the user's sound reactions. Without memory, offer a short `naming-log.md` in a folder the user
names.
