# Changelog

> AI-powered CHANGELOG.md management with automatic version detection and conventional commit analysis.

## Overview

Analyzes repository state -- commits since the last tag, staged and unstaged changes, and conventional commit types -- to determine the appropriate version bump (major, minor, or patch). Generates categorized changelog entries with emoji prefixes, updates or creates CHANGELOG.md following the Keep a Changelog format, and optionally commits and pushes.

## Usage

```text
/ak-meta:changelog [--no-commit] [--push]
```

**Flags:**

- `--no-commit` — skip the automatic commit (default: the skill commits the changelog automatically)
- `--push` — push the commit to the remote after committing

## Examples

```text
/ak-meta:changelog
```

Analyzes commits since the last tag, updates CHANGELOG.md with categorized entries, and commits the change
automatically (the default behavior with no flags).

```text
/ak-meta:changelog --no-commit
```

Updates CHANGELOG.md but leaves the change unstaged so you can review or edit it before committing yourself
(`--no-commit`).

```text
/ak-meta:changelog --push
```

Updates CHANGELOG.md, commits it, and pushes the commit to the remote in one step (`--push`).

## When to Use

- Preparing a release with accumulated changes
- Updating CHANGELOG.md after a batch of commits
- Bumping the version based on conventional commit analysis
- Creating initial CHANGELOG.md for a project

## Best Practices

- Use conventional commits (`feat:`, `fix:`, `docs:`) for accurate auto-categorization
- Review the generated entries before pushing -- the skill commits automatically by default
- Use `--no-commit` when you want to review or edit the changelog before committing
- Breaking changes in commits trigger a major version bump

## Related

- [ak-git:operations](../ak-git/operations.md) -- commit with conventional commit messages
- [handoff](./handoff.md) -- document context for another AI session
