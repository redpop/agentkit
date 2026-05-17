---
name: operations
description: This skill should be used when the user asks to "commit changes", "smart commit", "resolve conflicts", "review changes", "create PR", "open merge request", "ship this", or needs Git workflow assistance with intelligent commit messages and PR creation.
---

# Git Operations

Smart Git operations with intelligent commit messages, change analysis, and PR creation with adaptive descriptions.

**Default**: Always uses intelligent commit message generation. Defaults to `commit` operation.

## Arguments

Parse arguments: `$ARGUMENTS`

All arguments use `--` prefix:

| Argument | Operation |
|----------|-----------|
| `--commit` | Smart commit with scope-based messaging (default if no argument given) |
| `--review` | Pre-commit code review of staged changes |
| `--resolve` | Merge conflict resolution with context |
| `--pr` or `--ship` | Commit → Push → Create PR/MR in one flow |
| `--push` | Push after commit |
| `--force-push` | Force push with lease after commit |

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

- Match common patterns: `ABC-1234`, `fix/ABC-1234`, `feature/FOO-99_description`, `FOO-123_description`, etc.
- Regex: extract first match of `[A-Z][A-Z0-9]+-[0-9]+` from branch name
- If no ticket pattern is found, use standard Conventional Commits without prefix

**If a ticket is found**, detect the commit style already used on this branch:

```bash
MERGE_BASE=$(git merge-base origin/HEAD HEAD 2>/dev/null \
  || git merge-base origin/main HEAD 2>/dev/null \
  || git merge-base origin/master HEAD 2>/dev/null)
if [ -n "$MERGE_BASE" ]; then
  git log --format="%s" "${MERGE_BASE}..HEAD"
else
  git log --format="%s" -10
fi
```

- If any subject matches `^\[<ticket-id>\]` (e.g., `[FOO-1] feat: ...`) →
  use **bracket style**: `[ABC-1234] type(scope): description`
- Otherwise or if no prior commits found →
  use **plain style**: `ABC-1234 type(scope): description`

Pass the detected ticket and style to the git-workflow-specialist.

## Execution: --commit, --review, --resolve

Use Task tool with subagent_type="git-workflow-specialist":
"Execute Git '$operation':

**IMPORTANT**: NEVER include Co-Authored-By lines in commit messages.

1. **Ticket Prefix**: Apply the style detected above:
   - Bracket: `[ABC-1234] feat(config): add feature`
   - Plain: `ABC-1234 feat(config): add feature`
   - No ticket detected: standard Conventional Commits without prefix
2. **Convention Analysis**: Apply standard commit conventions
3. **Change Analysis**: Analyze changes with full codebase context
4. **Message Generation**: Create professional commit messages with proper formatting
5. **Execution**: Create commits, handle conflicts, or perform code review

Focus:

- **commit**: Intelligent commit creation with scope-based messaging
- **review**: Pre-commit code review of staged changes
- **resolve/conflict-resolver**: Merge conflict resolution with context"

## Execution: --pr / --ship

Full flow from working tree to open PR/MR in one step.

### Step 1: Commit & Push

1. If uncommitted changes exist, run the `commit` operation first (see above)
2. Detect default branch: `git rev-parse --abbrev-ref origin/HEAD 2>/dev/null` (strip `origin/` prefix)
3. If on the default branch with unpushed commits, ask whether to create a feature branch first
4. Push: `git push -u origin HEAD`

### Step 2: Gather Branch Scope

Get the full picture of what the PR will contain — not just the last commit:

```bash
MERGE_BASE=$(git merge-base origin/<default-branch> HEAD)
git log --oneline $MERGE_BASE..HEAD
git diff $MERGE_BASE...HEAD --stat
```

### Step 3: Classify Commits

Classify each commit on the branch into two categories:

- **Feature commits** — implement the purpose of the PR (new functionality, intentional refactors, design changes). These drive the PR description.
- **Fix-up commits** — iteration noise: lint fixes, typo corrections, code review feedback, rebase conflict resolutions, style cleanups. These are invisible to the reader.

Only feature commits inform the PR title and description.

### Step 4: Write Adaptive PR Description

Scale the description depth to the complexity of the change:

| Change Profile | Description Approach |
|---|---|
| Small + simple (typo, config, dep bump) | 1-2 sentences, no headers |
| Small + non-trivial (targeted bugfix) | Short "Problem / Fix" narrative, 3-5 sentences |
| Medium feature or refactor | Summary paragraph + what changed and why, call out design decisions |
| Large or architecturally significant | Full narrative: problem context, approach, key decisions, migration notes |

**Writing principles:**

- **Lead with value**: First sentence = why this PR exists, not what files changed
- **Describe the net result, not the journey**: No iteration history, no debugging steps
- **Explain the non-obvious**: Spend space on things the diff doesn't show — why this approach, what was rejected
- **No empty sections**: If a section doesn't apply, omit it entirely
- **Test plan — only when non-obvious**: Omit for straightforward changes

### Step 5: Detect Git Provider & Create PR

Auto-detect the Git provider from the remote URL and use the appropriate CLI:

```bash
git remote get-url origin
```

| Remote URL contains | Provider | CLI | Command |
|---|---|---|---|
| `github.com` | GitHub | `gh` | `gh pr create --title "..." --body "..."` |
| `gitlab.com` or self-hosted GitLab | GitLab | `glab` | `glab mr create --title "..." --description "..."` |
| Other | Unknown | — | Print push URL, instruct user to create PR/MR manually |

**If the CLI is not installed**, print the PR/MR URL pattern and suggest the user create it manually or install the CLI.

**If a PR/MR already exists** for this branch, report the URL and ask whether to update the description.

### Step 6: Update Existing PR Description

When updating an existing PR/MR description:

1. Read current description via CLI
2. Gather branch scope and classify commits (same as Step 2-3)
3. Write new description based on the full branch — not just new commits
4. Show summary of changes to user, ask for confirmation
5. Apply update via CLI

## Output Summary

After completing operations, provide:

```markdown
## Commit Summary

**Scope**: [Small/Medium/Large] ([X] files changed)

**Commits created:**
- `abc1234` - ABC-1234 feat: description (or `[ABC-1234]` bracket style if detected)

**Files affected:**
- path/to/file (modified/added/deleted)

**Next steps:**
- [ ] Push to remote: `git push`
- [ ] Create PR: `gh pr create` / `glab mr create`
```

If `--push` was used: confirm push success with remote branch info.

If `--force-push` was used: execute `git push --force-with-lease` and confirm push success with remote branch info.

If `pr` / `ship` was used: report the PR/MR URL.
