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

## Execution

### Step 1: Analyze Repository State

- Get current version from CHANGELOG.md or package files
- List commits since last version tag: `git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD`
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
