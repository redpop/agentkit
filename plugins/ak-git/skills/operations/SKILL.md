---
name: operations
description: This skill should be used when the user asks to "commit changes", "smart commit", "resolve conflicts", "review changes", "create PR", "open merge request", "ship this", "cut a release", "bump the version", "tag a release", or needs Git workflow assistance with intelligent commit messages, PR creation, or the version-bump-changelog-tag release flow.
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
| `--release` | Version bump → changelog → one commit → annotated tag → push. Optional `major`/`minor`/`patch` |

## Scope Detection

**Scope and ticket detection below apply to the commit-producing operations. `--release` skips both**
— a release commit carries no ticket and its scope is fixed; see *Execution: --release*.

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
- If no ticket pattern is found, use standard Conventional Commits without prefix — unless the
  project states its own rule on this point, which then outranks it; see *Message Convention* below

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

## Message Convention

**A commit-message convention stated in the project's own instruction file wins on every point it
states.** Read `AGENTS.md`, `CLAUDE.md` or `.claude/CLAUDE.md` and look for a section that governs
commit messages — a heading naming commits, or rules about subject shape, subject length, or what a
body may contain.

Projects genuinely disagree here and both answers are correct in their own repository: one mandates
Conventional Commits (`feat(scope): description`), the next mandates `TICKET Capitalized
description` and treats a `feat(scope):` subject as wrong. A skill that hardcodes one of them makes
the other project violate its own instruction file — which is also what its code reviewer reads as
criteria.

Precedence, highest first:

1. **The project's instruction file** — its commit-message section, taken verbatim
2. **The style detected from branch history** — bracket vs. plain, as detected above; this settles
   how the prefix is written, not the subject shape
3. **Conventional Commits** — the fallback when neither of the above says anything

**Precedence applies point by point, not source by source.** A section that fixes the subject shape
and says nothing about ticket prefixes has not decided the prefix question — that one still falls
through to 2, then 3. Silence is not a prohibition, and reading it as one is how a branch's own
ticket disappears from its commits.

**Copy the section into the dispatch prompt; do not point at it.** Whether a Task-dispatched
subagent inherits the project's instruction files is not something this skill should depend on
either way — the same reason `--pr` builds a self-contained description rather than assuming
shared context. Reading the file costs one tool call; a message that silently ignored the
convention costs a rewritten commit.

## Execution: --commit, --review, --resolve

Use Task tool with subagent_type="git-workflow-specialist":
"Execute Git '$operation':

**IMPORTANT**: NEVER include Co-Authored-By lines in commit messages.

0. **Project Convention**: [paste the project's commit-message section here verbatim, or the
   literal word `none` when the instruction files state no convention]. Where it is present it
   overrides steps 1 and 2 on any point they disagree on — including the subject shape.
1. **Ticket Prefix**: Apply the style detected above:
   - Bracket: `[ABC-1234] feat(config): add feature`
   - Plain: `ABC-1234 feat(config): add feature`
   - No ticket detected: standard Conventional Commits without prefix
2. **Convention Analysis**: Apply standard commit conventions, unless step 0 supplied the
   project's own
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

## Execution: --release

Cuts a release: version bump → changelog → **one** commit → annotated tag → push.

Ticket detection does not apply here — a release commit carries no ticket, and its subject follows
the project's own release pattern rather than the branch name.

**The release commit must be the last commit of the cycle.** If the working tree is dirty, run the
`commit` operation on those changes first and release afterwards. Otherwise `git checkout
v<version>` does not match what was released and `git log vA..vB` describes the wrong range.

### Step 1: Find the boundary — the last release commit, not the last tag

```bash
git log --format='%H %s' --grep='^chore: release v' -1   # adjust the pattern, see below
git log <that hash>..HEAD --oneline
```

The release-commit subject is a convention, not a law. Read the project's own pattern out of its
history before assuming one:

```bash
git log --oneline -200 | grep -iE 'release|bump|version' | head
```

If no release commit exists, fall back to the last tag; if there is no tag either, use the full
history.

**Do not use `git describe --tags` as the boundary.** A release can happen without ever being
tagged, and then "since the last tag" spans several releases and counts their commits a second
time. Measured in AgentKit's own history: four releases went out untagged, the last tag ended up
three versions behind, and a `feat:` that had already shipped two versions earlier would have
forced another minor bump. The release commit is the marker that always exists.

**If that range is empty, there is nothing to release — say so and stop.** An empty range means the
version already describes HEAD, and bumping anyway produces a version whose changelog entry has
nothing to describe. Check whether tagging or pushing is what is actually missing and offer that
instead:

```bash
git tag --sort=-v:refname | head -1   # is the current version tagged?
git status -sb                        # was the last release pushed?
```

### Step 2: Determine the bump type

An explicit argument wins: `--release major`, `--release minor`, `--release patch`. Any other value
is an error — stop rather than guessing.

Otherwise derive it from the commit subjects in the range:

- `BREAKING CHANGE` in a body or footer, or a `!` before the colon (`feat!:`) → **major**
- any `feat:` / `feat(` → **minor**
- otherwise (`fix:`, `docs:`, `refactor:`, `chore:`) → **patch**

Projects that do not use Conventional Commits get no automatic answer: report what the range
contains and ask for the bump type.

### Step 3: Discover which files carry the version — never hardcode a list

A hardcoded list silently skips a file added after the list was written, and that file stays
stranded on the old version.

| Marker in the repository | Version lives in |
| --- | --- |
| `package.json` | its `version` field; refresh the lockfile if one is tracked |
| `Cargo.toml` | `[package] version`, plus `Cargo.lock` |
| `pyproject.toml` | `[project] version`, or the build backend's own field |
| `.claude-plugin/marketplace.json` | every entry of the `plugins` array **and** every `plugins/*/.claude-plugin/plugin.json` — glob them, do not count from memory |
| `composer.json` | usually **nothing** — Packagist reads the tag. Only bump a `version` key that is already there |
| none of the above | **tag-only release.** CHANGELOG and tag, no file edits. Go projects and most Composer packages belong here |

Also update a version stated in prose (a README badge, an `AGENTS.md` line such as
`currently X.Y.Z`) — grep the old version string across the repository to find those.

### Step 4: Verify that nothing was missed

Every file discovered in Step 3 must now report the same, new version:

```bash
grep -rho '"version"[[:space:]]*:[[:space:]]*"[^"]*"' <the discovered files> \
  | grep -o '[^"]*"$' | sort -u
```

Exactly one distinct value must come back. Compare the **values**, not whole lines — a nested entry
and a top-level one differ by indentation alone and would report a false mismatch. Where one file
enumerates the others (a marketplace manifest and its plugins), check the counts match too.

### Step 5: Changelog

Invoke `/ak-meta:changelog --no-commit --version=<new-version> --since=<boundary commit>`.

All three flags are required, and each removes a specific failure:

- `--no-commit` — that skill commits by default, and a separate changelog commit would split the
  release across two commits, leaving the tag on only one of them.
- `--version` — it would otherwise derive a version of its own by reading the very files Step 4 just
  bumped, and answer with the version that was already written.
- `--since` — it would otherwise measure the range from the last version **tag**, which is exactly
  the boundary Step 1 rejected. An untagged release would make the changelog list commits that
  earlier versions already documented.

### Step 6: Commit

One commit carrying the version files and the CHANGELOG, with the subject in the project's detected
release format (`chore: release v<new-version>` where no other pattern is in use). No ticket prefix,
no `Co-Authored-By`.

### Step 7: Tag — annotated, on the right commit

```bash
git tag -a v<new-version> -m "Release v<new-version>"
```

Annotated (`-a -m`), never lightweight: the tagger, date and message are what `git show <tag>` and
the GitHub/GitLab release UIs read.

**Then backfill any earlier release that was never tagged.** The gap does not heal on its own — every
version has a changelog entry, so one without a tag is a release nobody can check out:

```bash
git log --format='%H %s' --grep='^chore: release v' | while read -r hash subject; do
  v="${subject##* }"
  git rev-parse -q --verify "refs/tags/$v" > /dev/null || echo "untagged: $v $hash"
done
```

Tag each one on **its own** release commit, never on HEAD — a tag on the wrong commit is worse
than a missing one, because it looks correct:

```bash
git tag -a <version> -m "Release <version>" <that version's hash>
```

Confirm with `git tag --sort=-v:refname | head -5`, and that they are annotated:
`git for-each-ref refs/tags/<v> --format='%(objecttype)'` prints `tag`, not `commit`.

### Step 8: Push

```bash
git push --follow-tags
```

`--follow-tags` pushes the annotated tags reachable from what is being pushed, which covers the
backfilled ones as well. Publishing a provider-side release (`gh release create`) is **not** part of
this operation — offer it, do not do it unasked.

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

If `release` was used, report instead:

```markdown
## Release Summary

**Version**: X.Y.Z → A.B.C (<bump type>) — <why that bump type>
**Range**: <boundary commit>..HEAD (<N> commits)

**Version files updated:** <the files discovered in Step 3, or "none — tag-only release">
**Changelog**: <N> entries added under [A.B.C]
**Commit**: `abc1234` chore: release vA.B.C
**Tags**: `vA.B.C`<, plus any backfilled tags>
**Pushed**: yes / no
```
