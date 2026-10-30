# ak-writing

Prose quality for German and English text: finds and removes the patterns that make readers recognize
text as AI-generated, without losing facts, numbers, or the strength of a claim. A second skill writes
German technical documentation short and unambiguous, loosely based on ASD-STE100.

## Skills

| Skill | Description |
|-------|-------------|
| `unslop` | Write, check, rewrite, or edit a file against AI-slop patterns on three levels (words, sentence rhythm, structure), with register profiles for docs, email, blog, social, academic, and slides |
| `clear-docs-de` | Write or rewrite German technical docs by fixed rules (short sentences, active voice, term table, no invented facts), with a check script and a Confluence path that keeps macros |

## Knowledge Base

- **word-lists.md** — German and English vocabulary in three tiers, stock phrases, stretched verbs, leak artifacts, microformats
- **pattern-catalog.md** — before/after examples for 31 pattern families, German special cases included
- **clear-docs-rules-de.md** — the German writing rules of `clear-docs-de` with before/after examples
- **clear-docs-confluence.md** — rewriting a Confluence page with its macros, images and `macro-id`s kept

## Requirements

`clear-docs-de` runs its two scripts with python3 3.9 or later, standard library only. Without python3 it
checks by hand and uploads nothing to Confluence.

## Evals

`evals/unslop-cases.md` holds 28 regression cases with expected findings. Nine of them must come back clean,
so a skill change that overflags fails.

## Usage

```bash
# Install the plugin
claude plugin add ak-writing

# Use the skill
/ak-writing:unslop --check README.md
/ak-writing:unslop docs/guide.md
/ak-writing:unslop --rewrite
/ak-writing:clear-docs-de --rewrite docs/setup.md
```

## Attribution

`unslop` is adapted from [unslop_ai](https://github.com/jlwin/unslop_ai) v1.8.4 by Jean-Luc Winkler (MIT). See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
