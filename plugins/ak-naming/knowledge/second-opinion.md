# Second Opinion: Prompt Template

Fill the angle brackets and give the prompt to another agent or model. Tell the user to switch on
web search in the external agent. Afterwards check every claim in the answer before you repeat it.

Why the check: in one real search the second opinion found real problems (a rare US first name,
existing neighbour apps, a company that had renamed itself). A brand it named was dismissed as
invented, because a web search tool found nothing; a search engine in the browser showed it at
once. Its own name ideas failed on EU marks it had not checked. In a later round most of its
checkable claims held and four could not be confirmed.

So check both ways: back every confirmed claim with a source, and call a claim unconfirmed only
after a search engine in the browser found nothing either (`check-chain.md`, step 8).

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

| Round | Word field | Names checked | Best hit | Why it left |
| --- | --- | --- | --- | --- |
| <n> | <field> | <count> | <name> | <reason> |

Exhausted word fields: <list>

Rejected, do not suggest again, by reason:

- Trade marks: <name; …>
- Language: <name; …>
- Sound: <name; …>
- Domains and companies: <name; …>

Earlier second opinion: <its verdict; which claims held, which did not>

## Finalists (checked on <date>)

| Name | Domains | EU marks (eSearch) | Companies, apps | Language risks |
| --- | --- | --- | --- | --- |
| <name> | | | | |

The user's favourite is <name>, because <reason>. Attack exactly this one hardest.

Open questions per finalist:

- <name>: <its concrete open risk, as a question>

## Tasks

1. First impression of each finalist, one sentence.
2. Score 1–10 each: sound, memorability, dictation, product fit, target countries, language risks,
   trade mark risk, brand potential. Keep these eight criteria in every round, so the sums compare.
3. Answer the open questions per finalist.
4. Risks we missed.
5. Pre-mortem: two years from now the user regrets the name. What is the most likely reason, and
   what helps against it today?
6. Ranking with a short reason.
7. Two slogans per finalist.
8. Check your risk claims on the web and give the source.
9. New names only if you checked their main-market domain and EU marks (at most one letter apart)
   yourself; at most three.

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
