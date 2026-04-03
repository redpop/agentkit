---
name: operations
description: This skill should be used when the user asks to "commit changes", "smart commit", "resolve conflicts", "review changes", or needs Git workflow assistance with intelligent commit messages.
---

# Git Operations

Smart Git operations with intelligent commit messages and change analysis.

**Default**: Always uses intelligent commit message generation. Defaults to `commit` operation.

## Arguments

Parse arguments: `$ARGUMENTS`

Extract operation and options:

- If first argument matches operations (commit, review, resolve, conflict-resolver), use as operation
- Default: operation="commit"
- Flags: `--push`, `--force-push`

## Scope Detection

Before executing, analyze change scope:

```bash
git status --porcelain
git diff --stat
```

| Scope | Criteria | Workflow |
|-------|----------|----------|
| **Small** | < 3 files, single logical change | Direct commit, concise message |
| **Medium** | 3-10 files, related changes | Smart commit with detailed analysis |
| **Large** | 10+ files OR unrelated features | Suggest splitting into atomic commits |

## Ticket Detection

Extract ticket/issue identifier from the current branch name:

```bash
git branch --show-current
```

- Match common patterns: `ABC-1234`, `FOO-99`, `fix/ABC-1234`, `feature/FOO-99_description`, etc.
- Regex: extract first match of `[A-Z][A-Z0-9]+-[0-9]+` from branch name
- If a ticket is found, **prefix every commit message** with it: `ABC-1234 type(scope): description`
- If no ticket pattern is found, use standard Conventional Commits without prefix
- Pass the detected ticket (or "none") to the git-workflow-specialist

## Execution

Use Task tool with subagent_type="git-workflow-specialist":
"Execute Git '$operation':

**IMPORTANT**: NEVER include Co-Authored-By lines in commit messages.

1. **Ticket Prefix**: If a ticket was detected from the branch name, prefix ALL commit messages with it (e.g., `ABC-1234 feat(config): add feature`). If no ticket was detected, use standard Conventional Commits format without prefix.
2. **Convention Analysis**: Apply standard commit conventions
3. **Change Analysis**: Analyze changes with full codebase context
4. **Message Generation**: Create professional commit messages with proper formatting
5. **Execution**: Create commits, handle conflicts, or perform code review

Focus:

- **commit**: Intelligent commit creation with scope-based messaging
- **review**: Pre-commit code review of staged changes
- **resolve/conflict-resolver**: Merge conflict resolution with context"

## Commit Summary

After completing operations, provide:

```markdown
## Commit Summary

**Scope**: [Small/Medium/Large] ([X] files changed)

**Commits created:**
- `abc1234` - ABC-123 feat: description (or without prefix if no ticket detected)

**Files affected:**
- path/to/file (modified/added/deleted)

**Next steps:**
- [ ] Push to remote: `git push`
- [ ] Create PR: `gh pr create`
```

If `--push` was used: confirm push success with remote branch info.

If `--force-push` was used: execute `git push --force-with-lease` and confirm push success with remote branch info.
