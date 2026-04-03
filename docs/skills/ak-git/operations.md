# Git Operations

> Smart Git operations with intelligent commit messages, scope detection, and ticket extraction.

## Overview

Analyzes your changes, detects scope (small/medium/large), extracts ticket identifiers from branch names, and generates professional commit messages using Conventional Commits. Delegates execution to the `git-workflow-specialist` agent for commit creation, conflict resolution, and code review.

## Usage

```text
/ak-git:operations [operation] [flags]
```

**Operations:** `commit` (default), `review`, `resolve`, `conflict-resolver`

**Flags:** `--push`, `--force-push`

## When to Use

- Committing changes with auto-generated, context-aware messages
- Reviewing staged changes before committing
- Resolving merge conflicts with codebase context
- Working on branches with ticket identifiers (e.g., `feature/ABC-1234`)

## Best Practices

- Let the skill detect scope automatically -- it adjusts messaging based on change size
- Use ticket-prefixed branches (`ABC-1234/description`) for automatic ticket extraction
- For 10+ file changes, consider splitting into atomic commits as suggested
- Use `--force-push` only when necessary -- it uses `--force-with-lease` for safety
- Never include Co-Authored-By lines in commit messages

## Related

- `git-workflow-specialist` agent -- handles the actual Git execution
- [ak-review:coderabbit](../ak-review/coderabbit.md) -- review changes before committing
