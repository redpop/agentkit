# Config Doctor Philosophy

This document defines the scoring methodology and severity classification used by `/ak-js:config-doctor`.

## Goal

Produce a transparent, actionable report that helps developers spot configuration problems that no
single tool would catch on its own. The score should be easy to explain and recreate by hand from
the finding list.

## Severity Levels

Each finding is classified into one of four severity levels. The severity determines how many
points are subtracted from the starting score of 100.

| Level | Score Impact | Meaning | Example |
|-------|--------------|---------|---------|
| 🔴 **Critical** | **−10** | Broken or unsafe — must be fixed immediately | Plaintext `_authToken` in `.npmrc`, invalid JSON that blocks tooling, missing required field that breaks publish/install |
| 🟠 **High** | **−5** | Will cause build or runtime failures, or dependency drift across a workspace | Script references a missing devDependency, `engines.node` incompatible with `tsconfig.target`, workspace package uses mismatched dep version |
| 🟡 **Medium** | **−2** | Best practice violation with measurable quality impact | Missing `license` / `repository` field, `compilerOptions.strict` not enabled, multiple package managers detected |
| 🔵 **Suggestion** | **−0.5** | Optional improvement, cosmetic or documentation | Add `engines` field for documentation, sort script keys alphabetically, prefer `exports` over `main` |

## Score Formula

```text
score = max(0, 100 − (critical*10 + high*5 + medium*2 + suggestion*0.5))
```

The formula is intentionally simple and additive — no caps, no multipliers, no hidden weights.
A reader can verify any score with a calculator.

## Grading Scale

| Score Range | Grade | Meaning |
|-------------|-------|---------|
| 90-100 | **A** | Excellent — production-ready |
| 75-89 | **B** | Good — minor polishing |
| 60-74 | **C** | Fair — several issues to address |
| 40-59 | **D** | Poor — substantial problems |
| 0-39 | **F** | Failing — many critical issues |

## Principles

1. **Read-only** — The doctor never modifies files. Users fix issues themselves, or ask Claude to
   fix them in the surrounding conversation.
2. **Transparent** — Every finding lists the file, the problem, and the fix. Every score reduction
   corresponds to a visible finding.
3. **Structural, not stylistic** — We flag things that break or mislead (missing deps, incompatible
   settings, leaked secrets). We do not flag personal style choices (tab vs. space, single vs.
   double quote).
4. **Fast** — No network calls on the critical path (SchemaStore is a soft fallback with a ~3s
   timeout). No subprocess beyond quick validation calls.
5. **Monorepo-aware** — Workspace detection is automatic. Cross-package drift is reported as
   workspace-wide findings separate from per-package findings.
