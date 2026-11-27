# Find a Name

> Find and screen names for a product, app, service or brand, so that only defensible finalists
> remain.

## Overview

Inventing a name stays a dialogue with the user. The skill asks for a short brief (product, target
countries, Nice classes, domain requirement, sound taste, exclusions), generates 20 to 120
candidates per round from word fields the story suggests, and runs them through a check chain from
cheap to expensive. Each step drops names with a one-sentence reason. A round ends with at most
three finalists in a table next to the current favourite, a list of what was checked and what was
only estimated, and a question about how the names sound.

Favourite, reserve and exhausted word fields go to the user's memory when the host has one, so a
later round checks nothing twice.

## Usage

```text
/ak-naming:find-name [product description | --check <name>, <name>]
```

| Argument | Effect |
| ---------- | -------- |
| description | Start with the brief, then generate and check |
| `--check <names>` | Skip to the check chain for the names given |

## Check chain

1. DNS pre-filter for the main-market domain, `-t <tld>` (`pre.sh`, parallel)
2. The main-market domain (`-t <tld>`, default `.de`) and `.com` by whois, `get<name>.com`, `.app`
   by RDAP (`chk.sh`)
3. `.eu`, `.at`, `.it`, `.ch`, `.io`, `.org` for finalists (`tlds.sh`)
4. North Data companies, App Store DE and US, the `.com` page title (`q.py`); for a taken `.com`
   the whois name servers show whether it is for sale
5. EU trade marks in EUIPO eSearch through a browser tool, with a control search
6. Web search: first names, places, near-spelled apps
7. Language risks by checklist, with Wiktionary (`wk.py`)
8. National trade marks: the user sends a TMview screenshot
9. Optional second opinion from another agent, every claim checked afterwards

## Scripts

In `skills/find-name/scripts/`. The shell scripts need `dig`, `whois` and `curl`; the Python scripts
need python3 3.9 or later, standard library only. All of them wait between names to stay inside the
rate limits of the whois, RDAP and Wiktionary services.

## Rules

- Never registers or buys a domain.
- Never gets around a bot block (TMview, Squadhelp and others).
- Sends only candidate names to outside services.
- Keeps facts with source and date apart from estimates.
- A pre-screen, not legal clearance; it does not push the user towards a lawyer.

## Examples

```text
/ak-naming:find-name budgeting app for couples, Germany and Austria
/ak-naming:find-name --check krevalo, zintora
```
