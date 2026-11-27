# ak-naming

Find and screen names for a product, app, service or brand. Inventing the name stays a dialogue
with you; the skill adds a fixed check chain from cheap to expensive, the traps that cost real
rounds, and a result that keeps checked facts apart from estimates.

## Skills

| Skill | Description |
| --- | --- |
| `find-name` | Brief, generate candidates per word field, check them (DNS, whois, RDAP, North Data, App Store, EUIPO eSearch, web, language risks), report at most three finalists against the current favourite |

## Knowledge Base

- **check-chain.md** — every check step with its command, status codes, the eSearch snippet and its
  traps, blocked sources, field data on how many names survive
- **language-risks.md** — checklist for vulgar forms, false friends, hidden words, reading and
  dictation traps, first names, brand echoes
- **second-opinion.md** — prompt template for a critical second opinion from another agent

## Requirements

- `dig`, `whois` and `curl` for the domain scripts (preinstalled on macOS)
- python3 3.9 or later, standard library only, for `q.py` and `wk.py`
- a browser tool (built-in browser or Claude in Chrome) for EUIPO eSearch; without one that step is
  reported as open

## Limits

A pre-screen, not trade mark clearance. eSearch misses national marks and one-letter neighbours;
national marks come from a TMview screenshot you take yourself, because TMview blocks automated
access. The skill never registers or buys a domain and never gets around a bot block.

## Usage

```text
# Install the plugin
/plugin install ak-naming --marketplace redpop/agentkit

# Use the skill
/ak-naming:find-name budgeting app for couples, Germany and Austria
/ak-naming:find-name check krevalo, zintora
```
