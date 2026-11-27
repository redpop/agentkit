# Round Brief for a Subagent

A long search splits well in two. A subagent or second model generates 100 to 200 names per round
and runs the mechanical checks. The main session keeps EUIPO eSearch, the TMview request, the
cross-check of language risks and the verdict.

Fill the angle brackets and hand the brief over. Check every finding that comes back before you
repeat it, both ways: a check once dismissed a real brand as invented, because only a web search
tool had looked for it.

## Template

```markdown
## Product

<one or two sentences: what it does, for whom, target countries>

## Benchmark

Current favourite: <name>. Strengths: <…>. Weak points: <…>.
A new name must beat it on at least one point without losing on the others.

## Theme of this round

<word field and its story>. Start roots: <root, root, root>.

## Criteria

- Sound: <hard or soft, invented or real word>
- Start: <letters or sounds wanted or excluded>
- Syllables: <number>
- Meaning: <what it may evoke, what it must not>

## Block list

Exhausted stems: <list>. Already checked names, do not suggest again: `<file or list>`.

## Steps

Scripts: `<plugin root>/skills/find-name/scripts/`. Work in `<scratchpad>`; `cd` there with
`|| exit 1` before every command. NN is the round number.

1. Generate 100–200 names into `rNN.txt`, lower-case, one per line, block list removed.
2. `risk_scan.py --file rNN.txt > rNN-risk.txt`; drop clear hits, keep doubtful ones marked.
3. `pre.sh -t <main-market TLD>` in parallel into `rNN-nx.txt`.
4. `chk.sh -t <main-market TLD>` on `rNN-nx.txt` into `rNN-chk.txt`; keep names whose main-market
   domain is free.
5. `q.py` on the survivors into `rNN-q.txt`.
6. `wk.py` on the survivors and their stems into `rNN-wk.txt`.
7. Web search for the best 15: first names, places, near-spelled apps. Say which search you used;
   without a browser search engine, mark "nothing found" as not confirmed.
8. `neighbors.py` on the best 8 into `rNN-nb.txt`.

## Rules

- Never register or buy a domain.
- Never get around a bot block (TMview, Squadhelp and others). Do not query TMview at all.
- Keep rate limits: only `pre.sh` runs in parallel.
- Send only candidate names to outside services.
- Keep facts with source apart from estimates. No invented trade mark, company or app data.

## Answer format

1. Statistics: generated, after risk scan, after DNS, after whois, finalists.
2. Top table, at most 8 rows:

   | Name | .de/.app/.com | Companies, apps | Neighbours | Language | Verdict against the benchmark |
   | --- | --- | --- | --- | --- | --- |

3. Rejected with one-sentence reason each.
4. Raw files: the `rNN*.txt` paths.
5. Checked (source, date) versus estimated only.
```
