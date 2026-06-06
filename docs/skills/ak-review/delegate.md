# Delegate Code Review

> Generate a self-contained, project-specific code-review prompt for a foreign coding agent.

## Overview

Analyzes the current project (instructions, languages, test/lint commands, docs) and the
requested review scope, then assembles a ready-to-paste prompt that instructs any foreign
coding agent (Kimi, Codex, …) to perform a code review. Report-only by default; `--fix` makes
the prompt also fix findings. The skill never modifies code (it only writes a file when
`--out` is given).

The skill automatically discovers requirements context so the reviewing agent knows what
the change was supposed to accomplish:

1. **Jira tickets** — searches branch name and commit messages for ticket IDs (e.g.
   `PROJ-123`), then fetches details via Atlassian MCP (summary, description, acceptance
   criteria). Only runs when Atlassian MCP is connected.
2. **Spec / task Markdown files** — scans the working tree for task/spec documents
   (filenames or directories matching common patterns like `tasks/`, `SPEC`, `TODO`, …)
   and any Markdown files modified in the current scope.
3. **Fallback** — if neither source is found, synthesizes a brief summary from the commit
   messages so the reviewer always has some requirements context.

No flags are needed — discovery is automatic and silently skipped in projects without
Jira or spec files.

## Usage

```text
/ak-review:delegate [flags]
```

**Flags:** `--type all|committed|uncommitted` (default: all), `--base <ref>`, `--path <…>`, `--all`, `--fix`, `--out <path>`

**Scope precedence:** `--path` / `--all` override `--type`. With no scope flags, the default is `--type all`.

## Examples

```text
/ak-review:delegate --type uncommitted
```

Generates a review prompt covering only your current uncommitted work (staged + unstaged) — the quickest hand-off while
iterating.

```text
/ak-review:delegate --type committed --base develop --fix
```

Reviews everything committed on this branch since `develop` and tells the foreign agent to fix findings, not just
report (`--fix`).

```text
/ak-review:delegate --path src/auth --path src/api
```

Scopes the review to specific paths instead of a git diff; `--path` can be repeated and overrides `--type`.

```text
/ak-review:delegate --all --out review-prompt.md
```

Reviews the entire project (`--all`) and also writes the generated prompt to `review-prompt.md` (`--out`) in addition to
printing it.

## When to Use

- You want a different coding agent to review changes in this project
- You want a report you can later validate with `/ak-review:advise`
- Reviewing a feature branch, uncommitted work, or a specific module

## Best Practices

- Default scope is `--type all`; narrow with `--type uncommitted` or `--path`
- The generated prompt is self-contained -- paste it as-is into the other agent
- Keep report-only for hand-off workflows; use `--fix` only when you want direct edits
- The foreign agent's output uses a Markdown + JSON format consumable by `/ak-review:advise`
- The generated prompt instructs the foreign agent to dispatch one sub-agent per review
  dimension (Security, Performance, Tests, …) and merge findings before the final report
- Requirements context (Jira tickets, spec files, or commit summary) is discovered
  automatically — no flags needed

## Related

- [advise](./advise.md) -- validate the findings the foreign agent returns
- [coderabbit](./coderabbit.md) -- run an in-session automated review instead
