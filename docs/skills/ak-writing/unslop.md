# Unslop

> Find and remove AI-slop patterns in German and English prose without losing facts.

## Overview

Works on three levels: vocabulary, sentence rhythm, and document structure, weighted toward the last two
because word lists age with every model generation. Register profiles (social, blog, email, docs, academic,
slides) set the strictness, and story-telling texts get their own narrative rules. Guardrails decide what a
rewrite may never do: invent a number, name, quote, or first person, drop a fact, or change the strength of a
cause, comparison, hedge, or warning. Where a concrete detail is missing, the skill reports the gap instead of
filling it.

## Usage

```text
/ak-writing:unslop [--check | --rewrite | --write] [file]
```

| Argument | Effect |
|----------|--------|
| `--check` | Flag findings by severity (P0–P2), change nothing |
| `--rewrite` | Findings, cleaned version, change log, second pass |
| `--write` | Draft a new text under the rules, without announcing them |
| file path | Target file; without a flag, edit it in place, touching only flagged spans |

Without a target the skill works on the text in the conversation, in rewrite mode by default.

## Examples

```text
/ak-writing:unslop --check README.md
```

Lists every finding in the README with the quoted span and its severity, and says which flags are defensible
in a docs context.

```text
/ak-writing:unslop docs/guide.md
```

Edits the file in place: only flagged spans change, and every other sentence stays word for word.

## When to Use

- Before publishing a README, release notes, a blog article, or a LinkedIn post
- On commit and PR bodies that narrate the session or restate the diff
- On slide decks, where titles should be noun labels and the title sequence should carry the storyline
- As a review pass after another skill produced a draft

## Best Practices

- Use `--check` first on text a person wrote; human quirks are not defects
- Treat a word-list hit as a reason to look, not a licence to edit
- Run the regression cases in `plugins/ak-writing/evals/unslop-cases.md` after changing the skill

## Related

- Knowledge base: `plugins/ak-writing/knowledge/word-lists.md`, `plugins/ak-writing/knowledge/pattern-catalog.md`
- Upstream: [unslop_ai](https://github.com/jlwin/unslop_ai) (MIT)
