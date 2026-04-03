# Document Solution

> Capture a verified solution as a structured, searchable Markdown file in `docs/solutions/`.

## Overview

Transforms a solved problem from the current conversation into a structured document with YAML frontmatter, categorized by track (bug or knowledge). Uses parallel subagents for context analysis, solution extraction, and related-docs discovery. Supports both full mode (multi-phase with subagents) and compact mode (`--compact`) for quick capture.

## Usage

```text
/ak-knowledge:document [context hint]
/ak-knowledge:document --compact [context hint]
```

The optional context hint narrows focus when a session covered multiple topics.

## When to Use

- After a fix is verified and working
- After debugging sessions with non-trivial resolutions
- When trigger phrases appear: "it's fixed", "working now", "that did the trick"
- To build a searchable team knowledge base over time

## Best Practices

- Wait until the fix is verified before documenting -- speculative content degrades quality
- Use `--compact` for straightforward fixes; full mode for complex, multi-step resolutions
- Let the skill auto-detect track (bug vs knowledge) from the schema -- don't force it
- Check the overlap assessment -- high overlap updates an existing doc instead of creating duplicates
- Skip documentation for trivial one-character fixes

## Related

- [refresh](./refresh.md) -- maintain and update existing solution docs
- `solution-reviewer` agent -- reviews document quality in Phase 3
