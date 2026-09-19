---
title: CodeRabbit CLI silently falls back to the free plan after a version upgrade
date: 2026-09-19
category: integration-issues
module: ak-review
problem_type: integration_issue
component: cli
symptoms:
  - "`coderabbit auth status` stops printing the `Plan` and `Seat` lines"
  - "`coderabbit usage` fails with \"Check your connection and organization access\""
  - "Reviews run on the free allowance (`isProUser: false`) although a paid plan is active"
  - "`coderabbit doctor` passes every check, authentication included"
root_cause: config_error
resolution_type: config_change
severity: high
related_components:
  - tooling
  - plugin
tags:
  - coderabbit
  - cli
  - authentication
  - stale-credential
  - entitlement
  - code-review
  - version-upgrade
---

# CodeRabbit CLI silently falls back to the free plan after a version upgrade

## Problem

After the CodeRabbit CLI upgraded itself from 0.7.6 to 0.7.8, the stored login stopped carrying the
organization's entitlement. Reviews kept running — on the free CLI allowance instead of the paid
plan — until the allowance was exhausted four runs later. Nothing failed at the time; the runs
looked like ordinary reviews.

## Symptoms

- `coderabbit auth status` prints account, provider and organization as usual, but the
  **`Plan` and `Seat` lines under _Review access_ are gone**
- `coderabbit usage` fails: `Could not fetch usage for the current billing period. Check your
  connection and organization access, then try again.`
- A review's own output reports `"isProUser": false` and eventually
  `You've used all 3 included reviews currently available`
- `coderabbit doctor` reports **9 passed, 0 failed**, authentication included — it does not test
  entitlement at all
- Meanwhile the web UI shows the plan as active, and Team management shows the seat as assigned

## What Didn't Work

- **Checking provider and organization.** Both were correct (`gitlab` / `martin-alker`) throughout,
  which is exactly why the problem was hard to see: the obvious check passes.
- **`coderabbit doctor`.** Nine green checks on a CLI with no entitlement. It verifies reachability
  and sign-in, not what the sign-in is worth.
- **Suspecting the subscription.** A trial had been cancelled the day before, so "the trial ended
  early" looked plausible. The billing page disproved it — the plan was running, with a seat
  assigned and an end date two weeks out.
- **Suspecting the working directory.** The CLI is repository-aware, so the entitlement might have
  resolved per repo. It does not: the same failure appeared from inside the connected GitLab
  repository and from an unrelated GitHub one.
- **Concluding the CLI version had removed the fields.** 0.7.6 printed `Plan` and `Seat`, 0.7.8
  appeared not to — so the absence was recorded as a version difference, written into
  `plugins/ak-review/skills/coderabbit/SKILL.md`, and released as 1.31.5. It was a symptom, observed
  once, on a broken session. Corrected in 1.31.6.

## Solution

Re-authenticate. One command pair, and all symptoms clear together:

```bash
coderabbit auth logout && coderabbit auth login
```

Verify afterwards — `auth status` should print the two lines again, and `usage` should answer:

```text
Review access
Default      : <org>/<user>
Plan         : Advanced (trial)
Seat         : assigned

CodeRabbit Usage — current billing period
Organization  : <org>
Your reviews  : 5
Period resets : 2026-10-18
```

The login flow opens a browser and asks which organization the CLI should use. It preselects by
matching the git remote of the current directory ("Git origin match"), so **run it from a
repository belonging to the organization you want**, or pick deliberately in the dialog.

## Why This Works

The entitlement is not read from the organization at review time; it rides on the stored login
credential. A CLI upgrade underneath that credential leaves it syntactically valid — the CLI still
reports itself as authenticated, with the right account, provider and organization — while the part
that conveys plan and seat no longer resolves. Logging out discards it; logging in mints a new one
against the running version.

That also explains the shape of the failure. Every check that inspects _identity_ passes, because
the identity is intact. Only the checks that inspect _entitlement_ fail, and the CLI has just one
of those (`usage`), which reports the failure as a connection or access problem rather than as a
stale token.

## Prevention

- **Re-authenticate after a CodeRabbit CLI upgrade**, or at least whenever `auth status` looks
  different than it did before. The CLI auto-updates, so the upgrade may not be a conscious act.
- **Treat a missing `Plan` or `Seat` line as a stale login, not as a version difference.** It is a
  symptom with a one-command remedy. This is now written into the `ak-review:coderabbit` skill's
  Phase 1.
- **Do not use `coderabbit doctor` as an entitlement check.** It is a connectivity and installation
  check and will pass regardless.
- **Read the first lines of a review run.** The CLI announces there when it falls back to the free
  allowance or cannot reach the organization. A session can go stale between one run and the next,
  so the pre-run check alone is not enough. The free allowance is three reviews, and the message
  that the plan was never in play arrived only with the fourth — by which point the quota was gone.
- **One observation on a possibly-broken session is not a tool-version behaviour.** Before writing
  "version X removed Y" into documentation, reproduce it on a session known to be healthy. The
  wrong claim here survived a release. The same conclusion, reached from the opposite direction, is
  in [skill-shell-absolute-paths](../best-practices/skill-shell-absolute-paths-2026-04-07.md):
  static inspection is not verification.

## Related

- `plugins/ak-review/skills/coderabbit/SKILL.md` — Phase 1 carries the check and the remedy
- `docs/skills/ak-review/coderabbit.md` — the same material for readers of the docs
- `CHANGELOG.md` — `1.31.5` contains the wrong claim, `1.31.6` the correction
- [skill-shell-absolute-paths](../best-practices/skill-shell-absolute-paths-2026-04-07.md) —
  related prevention lesson: verify against a live run rather than by reading
