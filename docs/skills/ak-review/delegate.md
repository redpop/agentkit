# Delegate Code Review

> Generate a self-contained, project-specific code-review prompt for a foreign coding agent.

## Overview

Analyzes the current project (instructions, languages, test/lint commands, docs) and the
requested review scope, then assembles a ready-to-paste prompt that instructs any foreign
coding agent (Kimi, Codex, …) to perform a code review. Report-only by default; `--fix` makes
the prompt also fix findings. The skill never modifies code (it only writes a file when
`--out` is given).

## Usage

```text
/ak-review:delegate [flags]
```

**Flags:** `--type all|committed|uncommitted` (default: all), `--base <ref>`, `--path <…>`, `--all`, `--fix`, `--out <path>`

## When to Use

- You want a different coding agent to review changes in this project
- You want a report you can later validate with `/ak-review:advise`
- Reviewing a feature branch, uncommitted work, or a specific module

## Best Practices

- Default scope is `--type all`; narrow with `--type uncommitted` or `--path`
- The generated prompt is self-contained -- paste it as-is into the other agent
- Keep report-only for hand-off workflows; use `--fix` only when you want direct edits
- The foreign agent's output uses a Markdown + JSON format consumable by `/ak-review:advise`

## Related

- [advise](./advise.md) -- validate the findings the foreign agent returns
- [coderabbit](./coderabbit.md) -- run an in-session automated review instead
