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

Before spending a review, the skill runs `coderabbit auth status` and checks the provider and the
organization. The CLI signs in per provider, so a GitHub login does not see GitLab groups and vice
versa — and a repository that belongs to neither runs on the free CLI allowance rather than the paid
plan.

`auth status` also reports, under *Review access*, the plan and whether a seat is assigned —
entitlement hangs on the seat, not on the organization owning a plan.

**If those two lines are missing, the stored login has gone stale**, and the usual cause is a CLI
upgrade underneath it. Measured: after upgrading 0.7.6 → 0.7.8, both lines vanished, `coderabbit
usage` failed with an org-access error, and reviews fell back to the free allowance — while the
organization's trial was running and the seat had been assigned the whole time.
`coderabbit auth logout && coderabbit auth login` restored all three at once. `coderabbit doctor`
does not catch it: nine checks passed, authentication included, on a CLI with no entitlement.

The skill reads the review's own opening lines as well, and stops if a run announces the free
allowance — the session can go stale between one run and the next. That matters because the
allowance is small: measured at three reviews before a rate limit, with the message that the plan
was never in play arriving only on the fourth.

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
- **New files need `--include-untracked`, and the skill now passes it.** A file never added to Git
  is not part of `--uncommitted`, so it was skipped -- a review that silently omits every new file
  in a change, looking exactly like a clean one
- Verified against CodeRabbit CLI **0.7.8**, both `review --help` and `auth status`, and on a
  healthy session: `0.7` dropped `--prompt-only`/`--type`, and `0.7.8` reworded `--uncommitted` and
  added a GitHub-only `--remote`. A field missing from a stale session was once mistaken here for a
  field the version had removed -- one sample is not a version difference
- The skill asks the CLI for structured findings (`--agent`) instead of scraping the plain-text
  rendering. The CLI itself recommends this when it detects an agent environment
- `coderabbit review findings` reprints the last review's findings without paying for a second run
- **A failed review exits non-zero, and an interrupted one declares itself partial.** The skill checks
  both, because "no findings" and "never got there" are different answers that look alike
- **Unverified findings are a separate class** since CLI 0.7.8, and the skill will not auto-apply
  one. It is a lead to confirm against the code, not a defect the tool stood behind
- **A ticket reaches the review through `-c` as well.** CodeRabbit sees the diff and the repository,
  never what the change was supposed to achieve -- so a review can confirm the code is correct and
  miss that it does the wrong thing. `/ak-review:delegate` closes this for the external-agent path
  by writing requirements into the prompt it builds; this skill has no such prompt, so the
  acceptance criteria go in as a file: `-c AGENTS.md -c <requirements-file>`. The session fetches
  them, from a ticket system or a spec; CodeRabbit needs no access of its own
- **The requirements are looked for, not waited for.** Phase 1 follows `delegate`'s Phase 2.5 rather
  than repeating it -- ticket IDs from the branch name and the commits in scope, spec files where no
  ticket system is reachable. Reaching that system is the session's job: without an Atlassian MCP
  only the spec path is available, and the summary says so, because a review that ran without
  requirements is not one that found nothing to say about them
- **Project conventions go in, not through a filter afterwards.** The skill passes `-c AGENTS.md`
  when the repository has one. CodeRabbit's hosted reviewer already discovers `**/AGENTS.md` and
  `**/CLAUDE.md` via its knowledge-base defaults; whether the CLI applies the same defaults is
  undocumented, so passing the file explicitly settles it for a few kilobytes of context
- **Keep one base per round.** Changing the comparison base resets the saved review context, so
  alternating between two bases pays for a full review each time
- **`--agent` output is NDJSON**, one object per line — parsed line by line, not as one document
- **A `complete` event with `status: review_skipped` and no findings means no review ran.** It is
  not a clean bill of health, and neither is a heartbeat, a non-zero exit or a partial run. Four
  ways to end with zero findings for reasons that have nothing to do with the code
- **Severities stay in the CLI's own vocabulary** -- `critical`, `major`, `minor`, `trivial`,
  `info`, `none` -- so a reported finding can be traced back to what the tool actually said
- **The CLI uploads the diff to CodeRabbit's API.** The skill checks the resolved scope for
  credentials before starting -- a `.env` pulled in by `--include-untracked` is the obvious case --
  and treats everything the review returns as untrusted text
- **Scope flags do not combine freely:** `--committed` and `--uncommitted` conflict, and
  `--include-untracked` never goes with `--committed`. A failed run is reported rather than
  silently retried with a narrower scope
- Skip purely stylistic suggestions with no functional benefit
- Adapt fixes to match project conventions rather than applying them blindly
- When in doubt, skip and flag for manual review -- false positives happen
- Run validation after fixes to ensure project consistency

## Project Configuration

A review run now notices whether the repository has a `.coderabbit.yaml` and says in the summary
which paths its `path_filters` kept out. A configuration is a silent scope limitation: it removes
whole trees from the review, after which the run completes cleanly with nothing to say about
them —
indistinguishable from having looked and found nothing. If a project has no configuration and the
run made a case for one, the summary says so in a sentence and stops there; it does not create the
file.

Setting one up is a different task from running a review, and it is usually overdone. Most projects
need none: CodeRabbit reads `AGENTS.md` and
`CLAUDE.md` on its own through its knowledge-base defaults, so a config that restates the
conventions buys nothing and creates a second source that drifts.

Create one when files exist that should never be reviewed (`path_filters` — and usage-based reviews
bill per reviewed file, so this is noise and money at once), when different areas need different
attention (`path_instructions`), or when the volume of nitpicks is wrong (`profile`).

The starting point is `coderabbit config --agent`, a read-only inspection that reports what exists,
which format has authority, and the URL of the schema in force — read the schema from there rather
than from any copy. The content is then derived from the repository at hand: its AGENTS.md, its
layout, the mistakes its history records. A configuration copied from another project is worse than
none, because it looks considered. `coderabbit config validate` checks the result.

One trap: a `.coderabbit.yaml` takes precedence over a `.coderabbit.config.ts` when both exist, so
adding the TypeScript form beside an existing YAML file produces something that silently does
nothing.

## Related

- [finalize](./finalize.md) -- full task completion workflow that includes CodeRabbit
- [ak-git:operations](../ak-git/operations.md) -- commit after review passes
- [execute](./execute.md) -- the tool-agnostic equivalent of this skill, reusing its fix decision framework
