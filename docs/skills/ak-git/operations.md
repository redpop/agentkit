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
/ak-git:operations [flags]
```

All arguments are `--`-prefixed flags. With no flag, the skill runs `--commit`.

| Flag | What it does |
|------|--------------|
| `--commit` | Smart commit with scope-based, ticket-aware messaging (default if no flag is given) |
| `--review` | Pre-commit code review of staged changes (no commit is created) |
| `--resolve` | Merge conflict resolution using full codebase context |
| `--push` | Commit, then push the branch to the remote |
| `--force-push` | Commit, then push with `git push --force-with-lease` |
| `--pr` | Commit → push → create a PR/MR with an adaptive description |
| `--ship` | Alias for `--pr` — the full commit-to-PR flow in one step |

## Examples

```text
/ak-git:operations
```

Generates an intelligent commit message for the current changes and commits them (defaults to `--commit`).

```text
/ak-git:operations --review
```

Runs a pre-commit code review of the staged changes without creating a commit (`--review`).

```text
/ak-git:operations --push
```

Commits the changes and pushes the branch to the remote in one step (`--push`).

```text
/ak-git:operations --ship
```

Commits, pushes, and opens a PR/MR with an auto-written description — the full ship flow (`--ship`, alias of `--pr`).

```text
/ak-git:operations --resolve
```

Resolves the current merge conflicts using surrounding codebase context (`--resolve`).

## When to Use

- Committing changes with auto-generated, context-aware messages
- Reviewing staged changes before committing
- Resolving merge conflicts with codebase context
- Creating a PR/MR with an adaptive description in one step (`--pr` / `--ship`)
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
