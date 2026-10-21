# ak-writing

Prose quality for German and English text: finds and removes the patterns that make readers recognize
text as AI-generated, without losing facts, numbers, or the strength of a claim.

## Skills

| Skill | Description |
|-------|-------------|
| `unslop` | Write, check, rewrite, or edit a file against AI-slop patterns on three levels (words, sentence rhythm, structure), with register profiles for docs, email, blog, social, academic, and slides |

## Knowledge Base

- **word-lists.md** — German and English vocabulary in three tiers, stock phrases, stretched verbs, leak artifacts, microformats
- **pattern-catalog.md** — before/after examples for 31 pattern families, German special cases included

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
```

## Attribution

Adapted from [unslop_ai](https://github.com/jlwin/unslop_ai) v1.8.4 by Jean-Luc Winkler (MIT). See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
