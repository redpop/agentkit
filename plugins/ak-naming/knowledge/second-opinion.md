# Second Opinion: Prompt Template

Fill the angle brackets and give the prompt to another agent or model. Afterwards check every claim
in the answer before you repeat it.

Why the check: in one real search the second opinion found real problems (a rare US first name,
existing neighbour apps, a company that had renamed itself) and also invented a cleaning-product
brand that does not exist. Its own name ideas failed on EU marks it had not checked.

## Template

```markdown
## Role

You are a critical naming advisor. Do not confirm the shortlist; look for what speaks against it.

## Product

<product and its story in one sentence; audience; target countries>

## Criteria

- Domains: <requirement, e.g. .de required, plus .app or get<name>.com>
- Nice classes: <list>
- Sound: <user's taste>
- Exclusions: <stems, letters, languages>

## Search so far

Word fields tried: <list>
Rejected, do not suggest again: <name – reason; …>

## Finalists (checked on <date>)

| Name | Domains | EU marks (eSearch) | Companies, apps | Language risks |
| --- | --- | --- | --- | --- |
| <name> | | | | |

## Tasks

1. First impression of each finalist, one sentence.
2. Score 1–10 each: sound, memorability, dictation, product fit, target countries, language risks,
   trade mark risk, brand potential.
3. Risks we missed.
4. Ranking with a short reason.
5. Two slogans per finalist.
6. Optional, if you can search the web: check your risk claims and give the source.

## Rules

- Keep facts (with source) apart from judgement.
- Do not invent trade mark, company or app data. When you are not sure, say so.
- No legal advice, no referral to a lawyer.

## Answer format

### <name>
- First impression: …
- Scores: sound x, memorability x, dictation x, fit x, countries x, language x, trade mark x, brand x
- Missed risks: … (fact with source | estimate)
- Slogans: …, …

### Ranking
1. …
```
