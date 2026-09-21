# Git Operations

> Smart Git operations: intelligent commit messages, scope and ticket detection,
> PR/MR creation, and releases.

## Overview

Analyzes your changes, detects scope (small/medium/large), extracts ticket identifiers from branch
names, and generates professional commit messages using Conventional Commits. Automatically detects
the commit-prefix style already used on the branch — bracket (`[ABC-1234] feat: ...`) or plain
(`ABC-1234 feat: ...`) — and continues it consistently. Delegates execution to the
`git-workflow-specialist` agent for commit creation, conflict resolution, and code review.

`--release` is the one operation that does not go through the agent: it bumps the version in
whichever files the project actually carries it in, folds the changelog into a single release
commit, tags that commit annotated, backfills tags for earlier releases that never got one, and
pushes with `--follow-tags`.

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
| `--release` | Version bump → changelog → one commit → annotated tag → push. Takes an optional `major`, `minor` or `patch` |

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

```text
/ak-git:operations --release
```

Cuts a release: derives the bump type from the commits since the last release commit, updates every
file that carries a version, runs `/ak-meta:changelog --no-commit`, creates one `chore: release
vX.Y.Z` commit, tags it annotated, and pushes with `--follow-tags` (`--release`).

```text
/ak-git:operations --release minor
```

The same, with the bump type given explicitly instead of derived.

## When to Use

- Committing changes with auto-generated, context-aware messages
- Reviewing staged changes before committing
- Resolving merge conflicts with codebase context
- Creating a PR/MR with an adaptive description in one step (`--pr` / `--ship`)
- Cutting a release — version bump, changelog, commit, annotated tag, push (`--release`)
- Working on branches with ticket identifiers (e.g., `feature/ABC-1234`)

## Best Practices

- Let the skill detect scope automatically -- it adjusts messaging based on change size
- Use ticket-prefixed branches (e.g., `feature/ABC-1234`, `ABC-1234_description`) for automatic ticket extraction
- Commit-prefix style is auto-detected from branch history: bracket (`[ABC-1234]`) or plain (`ABC-1234`)
- For 10+ file changes, consider splitting into atomic commits as suggested
- Use `--force-push` only when necessary -- it uses `--force-with-lease` for safety
- Never include Co-Authored-By lines in commit messages
- Release last: `--release` expects a clean tree, so the release commit is the final commit of the
  cycle and `git checkout v<version>` matches what was released
- The release range is measured from the last release commit, not the last tag -- an untagged
  release would otherwise make the range span several versions and count their commits again

## Related

- `git-workflow-specialist` agent -- handles the actual Git execution
- [ak-review:coderabbit](../ak-review/coderabbit.md) -- review changes before committing
- [ak-meta:changelog](../ak-meta/changelog.md) -- invoked by `--release` with `--no-commit`
