# Changelog

> AI-powered CHANGELOG.md management with automatic version detection and conventional commit analysis.

## Overview

Analyzes repository state -- commits since the last tag (or since `--since`), staged and unstaged
changes, and conventional commit types -- to determine the appropriate version bump (major, minor,
or patch), unless `--version` supplies one. Generates categorized changelog entries with emoji
prefixes, updates or creates CHANGELOG.md following the Keep a Changelog format, and optionally
commits and pushes.

## Usage

```text
/ak-meta:changelog [--no-commit] [--push] [--version=X.Y.Z] [--since=<ref>]
```

**Flags:**

- `--no-commit` — skip the automatic commit (default: the skill commits the changelog automatically)
- `--push` — push the commit to the remote after committing
- `--version=X.Y.Z` — use this version instead of deriving one; version detection and bump-type
  detection are skipped
- `--since=<ref>` — take the commit range from `<ref>..HEAD` instead of from the last version tag

`--version` and `--since` exist for callers that have already decided, `/ak-git:operations --release`
above all: it writes the new version into the project's version files before invoking this skill, so
a second derivation here would read those freshly bumped files back and answer with the version that
was just written.

## Examples

```text
/ak-meta:changelog
```

Analyzes commits since the last tag, updates CHANGELOG.md with categorized entries, and commits
the change
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

- [ak-git:operations](../ak-git/operations.md) -- commit with conventional commit messages, unless
  the project's instruction file states a different convention; its
  `--release` flag invokes this skill with `--no-commit --version --since` and folds the changelog
  into the release commit
- [handoff](./handoff.md) -- capture session state for the next AI session
