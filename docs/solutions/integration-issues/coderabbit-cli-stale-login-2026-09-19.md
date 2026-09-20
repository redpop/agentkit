---
title: CodeRabbit CLI loses its paid plan every day because entitlement needs a browser cookie
date: 2026-09-19
category: integration-issues
module: ak-review
problem_type: integration_issue
component: cli
symptoms:
  - "`coderabbit auth status` stops printing the `Plan` and `Seat` lines, daily"
  - "`coderabbit usage` fails: \"Cookie session is required for tRPC procedures\""
  - "`Failed to fetch seat status: HTTP 403` in `~/.coderabbit/logs/`"
  - "Reviews fall back to the free allowance (`isProUser: false`) while a paid plan is active"
  - "`coderabbit doctor` passes every check, authentication included"
root_cause: wrong_api
resolution_type: config_change
severity: high
related_components:
  - tooling
  - plugin
tags:
  - coderabbit
  - cli
  - authentication
  - api-key
  - entitlement
  - code-review
  - oauth
---

# CodeRabbit CLI loses its paid plan every day because entitlement needs a browser cookie

## Problem

A browser-based (OAuth) CodeRabbit CLI login stops conveying the paid plan after a few hours —
daily, sometimes twice a day. `coderabbit auth logout && coderabbit auth login` restores it, which
opens a browser and therefore cannot run unattended. That is the whole damage: it interrupts
automated work for a credential the CLI otherwise holds for months.

## Symptoms

- `coderabbit auth status` still shows account, provider and organization, but the **`Plan` and
  `Seat` lines under _Review access_ are gone**
- `coderabbit usage` fails:
  `Cookie session is required for tRPC procedures. Please sign in again.`
  — code `-32001`, HTTP 401, path `meteredUsage.currentPeriodSummary`
- `~/.coderabbit/logs/` carries `Failed to fetch seat status: HTTP 403`
- A review reports `isProUser: false` and eventually
  `You've used all 3 included reviews currently available`
- `coderabbit doctor` reports **9 passed, 0 failed** — it does not test entitlement at all
- Meanwhile the web UI shows the plan as active with a seat assigned

## What Didn't Work

- **Blaming a CLI upgrade.** The first diagnosis here said the stored login went stale when the CLI
  auto-updated from 0.7.6 to 0.7.8, and that re-authenticating after an upgrade was the prevention.
  The upgrade was a coincidence — the symptom returns daily without one. Wrong causes shipped into
  this document once already; the correction is the reason it was rewritten.
- **Checking provider and organization.** Both stay correct throughout, which is why the obvious
  check passes and misleads.
- **`coderabbit doctor`.** Nine green checks, authentication included, on a CLI with no entitlement.
- **Suspecting the subscription.** The billing page showed the plan running, the seat assigned, and
  an end date two weeks out.
- **Suspecting the working directory.** The CLI is repository-aware, so entitlement might have
  resolved per repo. It does not: the failure appeared identically from a connected GitLab
  repository and from an unrelated GitHub one.
- **Re-authenticating.** It works — and that is the trap. It fixes the symptom so completely that
  it hides the shape of the problem, which is why the daily repetition went unexamined for weeks.

## Solution

Authenticate with an **Agentic API key** instead of the browser flow. Create it at
`app.coderabbit.ai` under _Account → API keys_, choose the longest expiry offered, then:

```bash
coderabbit auth login --api-key cr-***
```

Under an API key, `coderabbit auth status` reports **no organization, plan or seat at all** — the
whole output is:

```json
{"authenticated":true,"authType":"api_key","region":"us"}
```

That absence is by design, not a failure, and anything checking for those lines must branch on
`authType` first. `coderabbit usage` does not work either, failing with
`Authorization header not found` because the CLI does not send the key on that request. The one
remaining entitlement signal is the review's own opening lines — which announce a fallback to the
free allowance when one happens.

Verified 2026-09-20: three reviews ran under the API key, on the paid plan, with no free-allowance
notice in the stream.

## Why This Works

Two credentials with two lifetimes sit behind one login:

| Credential | Used for | Lives |
| --- | --- | --- |
| OAuth bearer token, with a refresh token beside it in the keychain | identity, and the review itself over the WebSocket | `expiresAt` measured 83 days out |
| **Cookie session** | `seat status`, `plan`, `usage` — the tRPC calls | hours |

The refresh token keeps the identity alive, which is why account, provider and organization never
disappear. Nothing renews the cookie session: only the browser callback during `auth login` mints
one, so the CLI has no non-interactive way to keep it. The entitlement surface therefore decays on
its own schedule while everything else stays valid — and re-authenticating is the only repair,
because it is the only path that opens a browser.

An API key removes the cookie from the picture entirely rather than renewing it.

## Prevention

- **Use an API key for any CLI work that must run unattended.** The browser flow cannot be
  automated by design, and that is the actual constraint, not a bug in the setup.
- **Do not treat a missing `Plan` or `Seat` line as staleness without checking `authType` first.**
  Under an API key they are never present, and a check that ignores that fires on every run. This is
  encoded in the `ak-review:coderabbit` skill's Phase 1.
- **Do not use `coderabbit doctor` as an entitlement check.** It is a connectivity and installation
  check and passes regardless.
- **Read the first lines of a review run.** The CLI announces there when it falls back to the free
  allowance. That allowance is three reviews, and the message that the plan was never in play
  arrives only with the fourth — by which point the quota is gone.
- **When a fix works but has to be repeated, the cause is not found yet.** Re-authenticating daily
  was treated as friction for weeks. A repair that has to be reapplied on a schedule is describing
  its own cause; the schedule is the clue.

## Related

- `plugins/ak-review/skills/coderabbit/SKILL.md` — Phase 1 carries the `authType` branch and the
  entitlement checks
- `docs/skills/ak-review/coderabbit.md` — the same material for readers of the docs
- [skill-shell-absolute-paths](../best-practices/skill-shell-absolute-paths-2026-04-07.md) —
  related prevention lesson: verify against a live run rather than by reading
