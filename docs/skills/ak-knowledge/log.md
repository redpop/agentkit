# Log Solution

> Capture a verified solution as a structured, searchable Markdown file in `docs/solutions/`.

## Overview

Transforms a solved problem from the current conversation into a structured document with YAML frontmatter, categorized by track (bug or knowledge). Uses parallel subagents for context analysis, solution extraction, and related-docs discovery.

## Usage

```text
/ak-knowledge:log
/ak-knowledge:log [context hint]
```

All arguments are treated as a free-text context hint (`$ARGUMENTS`). With no argument, the skill inspects the
current conversation to identify the solved problem. The optional context hint narrows focus when a session
covered multiple topics.

## Examples

```text
/ak-knowledge:log
```

Capture the problem solved in the current conversation; with no argument, the skill reconstructs the fix from
the session history on its own.

```text
/ak-knowledge:log fixed the flaky auth test by awaiting the token refresh before asserting
```

Document a just-solved problem from free text; the hint is the problem/fix summary the entry is built from,
useful when you want to be explicit about what to record.

```text
/ak-knowledge:log the CORS preflight fix, not the unrelated logging change
```

Disambiguate which resolution to log when a session covered multiple topics; the hint tells the skill to focus
on the CORS fix and ignore the others.

## When to Use

- After a fix is verified and working
- After debugging sessions with non-trivial resolutions
- When trigger phrases appear: "it's fixed", "working now", "that did the trick"
- To build a searchable team knowledge base over time

## Best Practices

- Wait until the fix is verified before documenting -- speculative content degrades quality
- Let the skill auto-detect track (bug vs knowledge) from the schema -- don't force it
- Check the overlap assessment -- high overlap updates an existing doc instead of creating duplicates
- Skip documentation for trivial one-character fixes

## Related

- [refresh](./refresh.md) -- maintain and update existing solution docs
- `solution-reviewer` agent -- reviews document quality in Phase 3
