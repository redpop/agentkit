# Advise on Review Findings

> Validate a foreign agent's code-review findings against the real code and return verdicts.

## Overview

Parses a findings list (Markdown report or JSON produced by `/ak-review:delegate`), checks each
finding against the actual code in this project, and returns a per-finding verdict (`confirmed`,
`false_positive`, `needs_more_context`, `uncertain`) with confidence and a fix hint. Read-only:
it never modifies code and never invents new findings.

## Usage

```text
/ak-review:advise [--in <path>]
```

**Flags:** `--in <path>` (findings file; if omitted, paste the findings as arguments)

## Examples

```text
/ak-review:advise --in findings.json
```

Validates the findings stored in `findings.json` (the JSON block produced by `/ak-review:delegate`) against the real
code; `--in` points to the file.

```text
/ak-review:advise <paste the findings report here>
```

Validates findings pasted directly as arguments when there is no file — omit `--in` and include the Markdown/JSON
content inline.

## When to Use

- A foreign agent returned review findings and you want a second opinion
- You want to filter false positives before fixing
- Acting as advisor in a two-agent review loop (foreign agent reviews → Claude validates → foreign agent fixes)

## Best Practices

- Prefer feeding the JSON block -- it parses most reliably
- Use the returned `confidence` to decide what to fix; the skill does not auto-threshold
- Pass back the JSON `results[]` to the fixing agent so it knows what is confirmed
- For large finding lists (>5), the skill dispatches one sub-agent per group of ≤8 findings to avoid context mixing

## Related

- [delegate](./delegate.md) -- generate the review prompt that produces these findings
- [execute](./execute.md) -- runs this skill's verification automatically as part of the unattended delegate -> external tool -> advise -> fix loop
