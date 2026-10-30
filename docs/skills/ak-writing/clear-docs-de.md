# Clear German Technical Docs

> Write or rewrite German technical documentation so that it is short, clear and unambiguous, loosely
> based on ASD-STE100.

## Overview

Two modes. **Rewrite** takes an existing text and changes only its form: every code span, path, date,
version, number and decision stays. **Write** drafts a new doc from sources the user names, such as
code or tickets, and takes every fact from them. In both modes the text starts with a term table that
fixes one meaning per technical term, and unclear terms go to the user as questions before the
text is finished. Gaps stay marked as gaps; the skill never fills one with a guess.

The rules: instructions at most 20 words, descriptions at most 25, one statement per sentence, at most
6 sentences per paragraph, active voice, verbs instead of nominal style, compounds of at most 3 parts,
procedures as numbered lists, abbreviations such as `ggf.` and `bzw.` replaced, jargon explained.

## Usage

```text
/ak-writing:clear-docs-de [--rewrite | --write] [file | Confluence page | topic]
```

| Argument | Effect |
| ---------- | -------- |
| `--rewrite` | Rewrite an existing text; only its form changes |
| `--write` | Write a new doc from the sources the user names |
| target | A file, a Confluence page, or the topic of a new doc |

Without a flag, an existing file or page means rewrite mode and a topic means write mode.

## Scripts

Both scripts need python3 3.9 or later and nothing beyond its standard library. Without python3 the
skill still works, checks by hand and says so, and uploads nothing to Confluence.

- `scripts/check_text.py` counts words per sentence (code spans left out) and sentences per paragraph,
  and flags passive, nominal style, long words, abbreviations and unexplained acronyms. With
  `--original` it reports every code span, code block, diagram, image, date, version, ticket number,
  URL and number missing from the new text, and warns about new facts. It reports in German:
  `FEHLER`, `WARNUNG`, `HINWEIS`.
- `scripts/confluence.py` saves the macros, images and page links of a Confluence page byte for byte,
  replaces them with placeholders, and puts them back with their `macro-id` after the rewrite. It
  never uploads; the skill uploads only after the user's explicit yes.

## Examples

```text
/ak-writing:clear-docs-de --rewrite docs/setup.md
```

Rewrites the guide without changing its content and reports the open questions and the check result.

```text
/ak-writing:clear-docs-de --write Installationsanleitung für das neue Deploy-Skript
```

Drafts a new guide from the script and the notes the user names.

## When to Use

- A German guide, README or concept page is hard to read and should keep its content
- A new German doc should follow uniform writing rules from the start
- A Confluence page should be rewritten while its macros, diagrams and images stay untouched
- A doc uses one word for two things and needs its terms sorted out

Not for English text (ASD-STE100 itself covers English, with its own dictionary), for marketing copy,
or as proof that a text conforms to ASD-STE100.

## Legal

ASD-STE100 is a protected specification of the ASD and is defined for English only. The skill carries
a few of its ideas over to German, freely. It contains no text and no dictionary of the specification
and never calls a text "STE-konform".

## Related

- Rules (German): `plugins/ak-writing/knowledge/clear-docs-rules-de.md`
- Confluence procedure: `plugins/ak-writing/knowledge/clear-docs-confluence.md`
- [unslop](unslop.md) removes AI-slop patterns; run it on the result when the doc should also not read
  as machine-written
