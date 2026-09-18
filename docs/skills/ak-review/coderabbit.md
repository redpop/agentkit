# CodeRabbit Review

> Automated code review with CodeRabbit CLI, critical evaluation, and systematic fix application.

## Overview

Executes a CodeRabbit CLI review against uncommitted, committed, or all changes. Parses the results, critically evaluates each finding (apply, adapt, or skip), implements valid fixes, and validates project consistency afterward. Includes intelligent base branch detection.

## Usage

```text
/ak-review:coderabbit [flags]
```

**Flags:** `--type uncommitted|committed|all` (default: uncommitted), `--base <branch>`,
`--base-commit <sha>`, `--dir <path>`

Before spending a review, the skill runs `coderabbit auth status` and reads it. The CLI signs in per
provider, so a GitHub login does not see GitLab groups and vice versa — and a repository that
belongs to neither runs on the free CLI allowance rather than the paid plan. That fallback is
announced in a single line at the top of the output and is easy to read past. Measured: two full
reviews ran on the free allowance while a paid plan sat unused under a different provider.

## Examples

```text
/ak-review:coderabbit
```

Reviews your current uncommitted work (staged + unstaged) using the default `--type uncommitted` — the typical
pre-commit check.

```text
/ak-review:coderabbit --type committed
```

Reviews everything committed on the current branch against the auto-detected base branch — useful before opening a PR.

```text
/ak-review:coderabbit --type committed --base develop
```

Reviews all commits made since `develop`; `--base` pins the comparison branch when auto-detection would pick the wrong
one.

```text
/ak-review:coderabbit --type committed --base-commit 30d679d
```

Reviews only what is new since that commit. On a second or third round over the same work, that is
the scope that matters: a base branch is a branch point, not a review history, so leaving it unset
re-reviews everything each round. Measured on a sixth round over one ticket: 9 files and +2220/−88
against the ticket base, where only 5 files and +557/−93 were new.

```text
/ak-review:coderabbit --type all
```

Reviews both committed and uncommitted changes in one pass for a full sweep of everything not yet on the base branch.

## When to Use

- After implementing changes, before committing
- As part of a task completion workflow
- When you want automated review beyond what linting catches
- Reviewing committed changes on a feature branch

## Best Practices

- Expect anything from a few minutes to well over half an hour, depending on scope -- the skill
  sets a 60-minute timeout
- **New files need `--include-untracked`, and the skill now passes it.** `--uncommitted` alone
  covers "staged changes and tracked edits", so a file never added to Git was skipped -- a review that
  silently omits every new file in a change, looking exactly like a clean one
- The skill asks the CLI for structured findings (`--agent`) instead of scraping the plain-text
  rendering. The CLI itself recommends this when it detects an agent environment
- `coderabbit review findings` reprints the last review's findings without paying for a second run
- Skip purely stylistic suggestions with no functional benefit
- Adapt fixes to match project conventions rather than applying them blindly
- When in doubt, skip and flag for manual review -- false positives happen
- Run validation after fixes to ensure project consistency

## Related

- [finalize](./finalize.md) -- full task completion workflow that includes CodeRabbit
- [ak-git:operations](../ak-git/operations.md) -- commit after review passes
- [execute](./execute.md) -- the tool-agnostic equivalent of this skill, reusing its fix decision framework
