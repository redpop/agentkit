---
name: coderabbit
description: This skill should be used when the user asks for "code review", "run CodeRabbit", "review my changes", or needs automated code review with fix application and critical evaluation.
---

# CodeRabbit Review

Execute CodeRabbit CLI review with critical evaluation, systematic fixes, and project consistency validation.

Verified against **CodeRabbit CLI 0.7.8**. The CLI moves, and it has moved under this skill before:
`0.7` dropped `--prompt-only` and `--type` in favour of separate scope flags and made plain text the
default output, and `0.7.8` reworded `--uncommitted` and added `--remote`. Check `coderabbit review
--help` before trusting a flag named here — and when one has changed, fix this file rather than
working around it.

## Arguments

Parse arguments: `$ARGUMENTS`

| Flag | Effect |
| ------ | -------- |
| `--type uncommitted\|committed\|all` | What to review. Default `uncommitted` |
| `--base <branch>` | Base branch for comparison (detected if omitted) |
| `--base-commit <sha>` | Base **commit** instead of a branch — the way to review only what is new since a previous round |
| `--dir <path>` | Review only changes under this directory. For a monorepo, this is how one plugin is reviewed without the rest |

## Workflow

### Phase 1: Check Who the CLI Is, Then Resolve Scope

**Run this first, and read the answer:**

```bash
coderabbit auth status
```

It prints the account, the **provider**, the active **organization**, the **plan** and whether a seat
is assigned. This matters before anything is spent: the CLI signs in per provider, so a GitHub login
does not see GitLab groups and vice versa, and a repository that belongs to neither runs on the free
CLI allowance instead of the paid plan. That fallback is announced in one line at the top of the
output and is easy to read past — measured: two full reviews ran on the free allowance while a paid
plan sat unused under a different provider.

If the plan or organization is not the expected one, say so and stop. Switching is
`coderabbit auth org`, or `coderabbit auth logout` and `coderabbit auth login` for a different
provider.

Then resolve the base:

1. Current branch: `git rev-parse --abbrev-ref HEAD`
2. Unpushed commits: `git rev-list --count @{u}..HEAD 2>/dev/null`
3. `--base-commit` given → use it. `--base` given → use it. Ahead of origin → `origin/<branch>`.
   Otherwise → `main`

**On a follow-up round, prefer `--base-commit`.** When this repository has been reviewed before and
those findings were addressed, the scope is what happened since that revision, not since the branch
point. Nothing detects this — a base branch is a branch point, not a review history, so an unset
base re-reviews everything every round. Measured on a sixth round over one ticket: 9 files and
+2220/−88 against the ticket base where only 5 files and +557/−93 were new.

### Phase 2: Execute Review

Run synchronously. Set a timeout of 3600000ms (60 minutes) and tell the user it will take a while —
small diffs come back in a few minutes, a large scope can take well over half an hour.

```bash
coderabbit review --agent [scope flags] [--base <branch> | --base-commit <sha>] [--dir <path>]
```

Scope flags per `--type`:

| `--type` | Flags |
| ---------- | ------- |
| `uncommitted` (default) | `--uncommitted --include-untracked` |
| `committed` | `--committed` |
| `all` | `--include-untracked` (no scope flag; the full diff against the base) |

**`--include-untracked` is not optional.** A file that has never been `git add`ed is not part of
`--uncommitted`; that the CLI ships a separate flag for "files that have not been added to Git" is
the proof, and it is a steadier one than the scope flag's own description, which was reworded in
0.7.8. A review that silently skips every new file in a change is exactly the failure this skill
exists to prevent, and it looks identical to a clean one.

**`--agent` is how the findings come back structured** rather than as prose to be scraped. The CLI
asks for it by name when it detects this environment. Read the findings it emits as they are; do not
re-parse the plain-text rendering.

Two flags worth knowing, not defaults:

- `--light` runs a cheaper review with less context work
- `--use-credits` allows a review to continue past the plan's included limits, at usage-based
  cost. Never pass it unprompted — it converts a run that would have stopped into a billed one

If the review has already run and the findings are needed again, `coderabbit review findings` reprints
the stored ones without paying for a second review; `coderabbit review findings --clear` forgets them.

`--remote <owner/repo>` reviews a repository server-side without a local checkout. This skill does not
use it: it reviews the working tree you are sitting in, and `--remote` is GitHub-only — named here so
the omission reads as a decision rather than an oversight.

### Phase 3: Parse Results

Take the findings from the `--agent` output: file, line, severity/category, the claim, and the
proposed fix. Create a todo list with one item per finding.

If the structured output is missing or unreadable, fall back to `coderabbit review findings` and read
the rendered findings — but say that the fallback was used, because a parse that silently yields
nothing is indistinguishable from a review that found nothing.

### Phase 4: Critical Evaluation & Fix

For each issue, critically evaluate before implementing:

1. **Is the issue valid?** (not a false positive?)
2. **Is the fix appropriate?** (fits project conventions?)
3. **Is the fix necessary?** (provides genuine value?)
4. **Could the fix cause harm?** (breaks functionality?)

Decision framework:

- **Apply**: Valid and appropriate — implement
- **Adapt**: Core idea valid, adjust for project — implement modified version
- **Skip**: False positive or unnecessary — mark completed with justification

Guidelines:

- Skip purely stylistic changes with no functional benefit
- Adapt rather than blindly copy when project conventions differ
- When in doubt, skip and flag for manual review

### Phase 5: Validation

After all fixes, validate project consistency:

- Architectural patterns maintained
- Naming conventions consistent
- Dependencies and imports correct
- Cross-reference similar patterns in codebase using Grep

### Phase 6: Summary

Report: issues found, fixes applied, items skipped (with reasons), validation results, testing recommendations.
