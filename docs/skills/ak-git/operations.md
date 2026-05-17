# Git Operations

> Smart Git operations with intelligent commit messages, scope detection, ticket extraction, and commit-style detection.

## Overview

Analyzes your changes, detects scope (small/medium/large), extracts ticket identifiers from branch
names, and generates professional commit messages using Conventional Commits. Automatically detects
the commit-prefix style already used on the branch — bracket (`[ABC-1234] feat: ...`) or plain
(`ABC-1234 feat: ...`) — and continues it consistently. Delegates execution to the
`git-workflow-specialist` agent for commit creation, conflict resolution, and code review.

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
- Use ticket-prefixed branches (e.g., `feature/ABC-1234`, `ABC-1234_description`) for automatic ticket extraction
- Commit-prefix style is auto-detected from branch history: bracket (`[ABC-1234]`) or plain (`ABC-1234`)
- For 10+ file changes, consider splitting into atomic commits as suggested
- Use `--force-push` only when necessary -- it uses `--force-with-lease` for safety
- Never include Co-Authored-By lines in commit messages

## Related

- `git-workflow-specialist` agent -- handles the actual Git execution
- [ak-review:coderabbit](../ak-review/coderabbit.md) -- review changes before committing
