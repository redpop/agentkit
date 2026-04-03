# Git Workflow Specialist

> Intelligent commit creation, change analysis, and atomic commit strategies.

## Overview

Creates professional commits by analyzing staged and unstaged changes, categorizing them by type,
and generating Conventional Commits messages. Automatically detects ticket identifiers from branch
names and prefixes commit messages accordingly.

## Usage

```
Agent tool with subagent_type="git-workflow-specialist"
```

Part of the **ak-git** plugin. Uses Read, Grep, and Bash(git:\*) tools.

## When to Use

- Committing changes with well-crafted messages
- Splitting large changes into atomic commits
- Generating commit messages from staged diffs
- Ensuring no sensitive data or debug code is committed
- Branch management and Git workflow best practices

## Methodology

1. **Change Analysis** -- Review changes, categorize (feat, fix, refactor, docs, test, chore), assess scope
2. **Ticket Detection** -- Extract ticket IDs from branch name (e.g., `ABC-1234`) and prefix commits
3. **Commit Message Generation** -- Conventional Commits format, concise subjects (< 72 chars), body for larger changes
4. **Commit Strategy** -- Single commit for focused changes, atomic commits for multi-concern changes
5. **Quality Checks** -- Verify no secrets, debug code, or temporary files; validate format

## Output

Produces a commit summary with scope assessment, list of commits with hashes, affected files,
and next-step action items.

## Related

- [git-conflict-specialist](git-conflict-specialist.md) -- Conflict resolution
- [ak-git:operations skill](../../../plugins/ak-git/skills/operations/SKILL.md) -- Git workflow skill
