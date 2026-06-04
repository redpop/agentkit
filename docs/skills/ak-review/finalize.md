# Finalize

> Execute the project-specific task completion workflow after code changes.

## Overview

Discovers the project's task completion workflow from `AGENTS.md` or `CLAUDE.md`, parses its steps, and executes them sequentially -- running bash commands, invoking agents, and tracking progress. If no workflow exists, offers to generate one based on detected project tooling (package managers, test runners, linters). Stops on failure and asks how to proceed.

## Usage

```text
/ak-review:finalize
```

No arguments required. Reads the workflow from the project's instruction files.

## Examples

```text
/ak-review:finalize
```

Discovers the `## Task completion workflow` section in `AGENTS.md` / `CLAUDE.md` and runs each step in order against
your current working-tree changes — the standard post-implementation pass.

```text
/ak-review:finalize
```

When no workflow section exists, the same invocation offers to generate one (via `/ak-review:workflow`) from your
detected tooling, then executes the newly created workflow.

## When to Use

- After finishing a feature or bug fix implementation
- Before committing to validate everything works
- When you want a structured validation pass (format, simplify, review, re-validate)
- Setting up a task completion workflow for a new project

## Best Practices

- Ensure your project has a `## Task completion workflow` section in AGENTS.md for best results
- Let the skill generate a workflow if none exists -- it detects available tooling automatically
- Skip steps 3-5 (simplify, review, re-validate) for trivial changes like typo fixes
- Fix failures immediately -- the skill stops and asks before continuing past errors

## Related

- [coderabbit](./coderabbit.md) -- the review step typically invoked within finalize
- [ak-git:operations](../ak-git/operations.md) -- commit after finalize passes
