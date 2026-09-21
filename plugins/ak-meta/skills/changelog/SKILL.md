---
name: changelog
description: This skill should be used when the user asks to "update changelog", "create release notes", "bump version", or needs CHANGELOG.md management with automatic version detection.
---

# Changelog

AI-powered CHANGELOG.md management with automatic version detection based on change analysis.

## Arguments

Parse arguments: `$ARGUMENTS`

Extract flags:

- `--no-commit`: Skip automatic commit (default: commits automatically)
- `--push`: Push commit to remote
- `--version=X.Y.Z`: Use this version instead of deriving one — Steps 1 and 2 are then skipped
- `--since=<ref>`: Take the commit range from `<ref>..HEAD` instead of the last version tag

**`--version` and `--since` are how a caller that has already decided hands its decision over.**
`/ak-git:operations --release` computes both before writing the new version into the project's
version files, so deriving them a second time here would read those freshly bumped files back and
answer with the version that was just written, from a tag-based range the caller deliberately did
not use. When either flag is given, take it as final and do not re-derive it.

## Execution

### Step 1: Analyze Repository State

Skip this step and Step 2 when `--version` was given; use `--since` as the range boundary when it
was given.

- Get current version from CHANGELOG.md or package files
- List commits since the last version tag, or since `--since` when it was given:
  `git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD`
- Examine uncommitted and staged changes
- Parse commit messages for conventional commit types

### Step 2: Determine Version Bump

- **Major (X.0.0)**: Breaking changes, removed features, API changes
- **Minor (0.X.0)**: New features (`feat:` commits)
- **Patch (0.0.X)**: Bug fixes (`fix:` commits), docs, refactoring

### Step 3: Generate Changelog Entries

Group changes by type with emoji prefixes:

- ✨ **Added**: New features
- 🔄 **Changed**: Changes in existing functionality
- ⚠️ **Deprecated**: Soon-to-be removed features
- 🗑️ **Removed**: Removed features
- 🐛 **Fixed**: Bug fixes
- 🔒 **Security**: Vulnerability fixes

### Step 4: Update CHANGELOG.md

- Create file with Keep a Changelog header if missing
- Add new version section with today's date
- Insert categorized entries
- Preserve existing content

### Step 5: Commit (default)

Commit message: `📝 docs: update changelog for v{version}`

Skip if `--no-commit` was used.

### Step 6: Push (--push)

Push to remote and confirm success.
