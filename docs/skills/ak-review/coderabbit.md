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

Before spending a review, the skill checks **how** the session is authenticated. Under an API key
(`authType: api_key`) there is no organization, plan or seat in the output at all — that block is
absent by design, so the staleness checks below do not apply and would otherwise fire on every run.
Under an OAuth session it checks the provider and the organization. The CLI signs in per
provider, so a GitHub login does not see GitLab groups and vice versa — and a repository that
belongs to neither runs on the free CLI allowance rather than the paid
plan.

`auth status` also reports, under *Review access*, the plan and whether a seat is assigned —
entitlement hangs on the seat, not on the organization owning a plan.

**If those two lines are missing on an OAuth session, the browser session behind them has
expired** — on its own schedule, measured daily and sometimes twice, with no upgrade in between.
Two credentials with two lifetimes sit behind one login: a bearer token, measured 83 days from
expiry, which keeps identity and the review itself alive, and a cookie session that the seat and
usage endpoints require and that lives hours. Nothing renews the cookie; only the browser callback
during `auth login` mints one, which is why `coderabbit auth logout && coderabbit auth login`
repairs it and why it has to be repeated. **For unattended work, an API key removes the cookie from
the path entirely.** `coderabbit doctor` catches none of this: nine checks passed, authentication
included, on a CLI with no entitlement.

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
  healthy session: `0.7` dropped `--prompt-only` and replaced `--type` with the named scope flags
  (`--type` itself still parses, merely unlisted), and `0.7.8` reworded `--uncommitted` and
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
  them, from a ticket system or a spec; CodeRabbit needs no access of its own. The file goes into a
  directory from `mktemp -d`, never into the repository -- there it would be untracked, and since
  `--include-untracked` is mandatory it would join the very change it describes: reviewed,
  commented on, billed as a reviewed file, and left behind for someone to commit later. `mktemp -d`
  also beats a fixed path under `/tmp`, which is world-readable; a private tracker's acceptance
  criteria should not be
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
- **An empty finding list is the ambiguous result here**, and the reasons for one that have nothing
  to do with the code keep accumulating: a `complete` event carrying `status: review_skipped`, a
  non-zero exit, an interrupted run reported as partial, and a scope that never contained the work
  -- `--committed` on a change not committed yet, or a `--base` that puts it behind the comparison
  point. A heartbeat is not completion either. The skill rules each one out before writing "no
  issues found", and names the one that applied. (`path_filters` belong in that list for a hosted
  review; in a CLI run they exclude nothing -- measured)
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

## The Same Repository, Reviewed Twice

A project reviewed both on merge requests and from the terminal is reviewed by two different
things, and the difference decides where a rule has to live. Conventions reach the hosted reviewer
on their own -- `**/AGENTS.md` and `**/CLAUDE.md` are among CodeRabbit's `code_guidelines` defaults
-- and reach a CLI run because the skill passes `-c AGENTS.md`. Scope is the opposite: `path_filters`
bind on the hosted side and not in the CLI, where git and `--dir` decide it.

So durable guidance belongs in an `AGENTS.md`, per package in a monorepo if need be, rather than in
`path_instructions` that work on one surface and silently do nothing on the other.

The non-obvious part is requirements. A CLI review gets them from the session through `-c`; a hosted
review has no session and, without a ticket-system connection, no way to reach a ticket at all. **The
merge-request description is the only channel there is** -- without it, the hosted reviewer checks
the code against nothing.

## Project Configuration

**A configuration does not bound a CLI review.** CodeRabbit's CLI reference describes a local
review as reading `.coderabbit.yaml` for *additional instructions* — the role the `-c` flag fills,
whose own help names `coderabbit.yaml` as an example. There is no enforcement layer on that path,
only a model reading text.

Measured 2026-09-20, twice: a 14-file diff came back as 14 files reviewed with `!CHANGELOG.md`,
`!**/CHANGELOG.md` and `!docs/**` all present in the configuration. Neither the root-file form nor
the directory form excluded anything. The skill therefore treats a configuration as information:
it compares what the filters claim against the `reviewedFiles` the run reports, and says which of
the two is true. If a project has no configuration and the
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
