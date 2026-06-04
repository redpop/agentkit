---
name: advise
description: This skill should be used when the user asks to "validate review findings", "check these findings", "second opinion on a code review", "are these findings false positives", or wants to verify a foreign agent's code-review findings against the real code.
---

# Advise on Review Findings

Validate a foreign coding agent's code-review findings against the **real code** in this project, and return a verdict per finding. **Read-only — never modifies code and never invents new findings.**

## Arguments

Parse `$ARGUMENTS`:

| Flag | Effect |
|------|--------|
| `--in <path>` | Findings file (Markdown report or JSON). If omitted, use the pasted content in `$ARGUMENTS` |

## Workflow

### Phase 1: Parse Findings

Prefer the JSON block (schema: `findings[]` with `id, title, severity, category, file, start_line, end_line, claim,
evidence, suggested_fix`). If only Markdown is present, parse the structured fields. If neither parses, ask the user to
paste the findings and stop.

### Phase 2: Validate Each Finding

For each finding, read the cited `file` around `start_line..end_line` and check the `claim` against the actual code. For
long lists, validate in internal groups (≈8 at a time) to avoid cross-issue context mixing. Do not modify code. Do not
add findings that were not in the input.

Assign a verdict:

- `confirmed` — the claim holds against the code.
- `false_positive` — the code does not have the described problem.
- `needs_more_context` — cannot decide without files/types/paths not provided.
- `uncertain` — genuinely ambiguous even with context.

### Phase 3: Emit Results

Output a Markdown summary (grouped by verdict) AND a JSON `results[]` block. Report `confidence` and `fix_recommended`,
but do NOT apply any fix threshold — that decision belongs to the consumer.

## Output Format

### Markdown

Group by verdict (Confirmed / False Positive / Needs More Context / Uncertain).
Each: `**F-NNN**` / verdict / confidence / reason / fix recommended? / fix hint.

### JSON (append verbatim, fenced as ```json)

```json
{
  "results": [
    {
      "id": "F-001",
      "verdict": "confirmed|false_positive|needs_more_context|uncertain",
      "confidence": 0.0,
      "reason": "...",
      "fix_recommended": true,
      "fix_hint": "..."
    }
  ]
}
```

`id` must match the input finding's id. Output one result per input finding.
