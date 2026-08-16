# deps

| Field | Value |
|-------|-------|
| Plugin | ak-review |
| Invoke | `/ak-review:deps [--audit]` |

## Usage

```text
/ak-review:deps [--audit]
```

**Flags:** `--audit` (check an existing dependency update skill against the project's current state). With no flag,
runs in Generate mode.

## Examples

```text
/ak-review:deps
```

Scans the project, interviews the gaps detection cannot fill, and — after you approve — writes
`.claude/skills/dependency-update/SKILL.md`, a procedure tailored to this project's baseline, pins and couplings.

```text
/ak-review:deps --audit
```

Re-runs detection against the existing skill and reports two kinds of finding separately: skill drift (the document
is stale) and project drift (a coupling the skill guards has actually come apart).

## Purpose

Produce a repeatable, project-aware procedure for updating dependencies safely. **This skill never updates a
dependency itself** — it generates the skill that does.

The methodology is generic; the values are not. Which commands form the baseline, whether a second kind of baseline
exists and what it fails to cover, how many files hold the same toolchain version, and whether a changelog entry
reaches an auto-updater — none of that is derivable from a package manifest, and all of it decides whether an update
is safe.

## Why generated, not generic

A generic dependency skill can say "take a baseline". It cannot say *which* baseline, and that is where the value
sits. A dependency bump can pass every behavioural test and still be wrong — a CSS framework bump that changes a
button border leaves a full E2E suite green, because the tests assert the fill and the fill is still right. Only a
project that knows it has a pixel comparison can be told to run it.

The generated skill also grows: its final step folds observations from each update back into the file, so it
accumulates project findings that no generic version could hold without polluting every other project.

## Language

The interview and the audit report follow the language of the invoking session — the same rule
[setup](./setup.md) and [execute](./execute.md) follow. The **generated file does not**: it follows the target
project's own `AGENTS.md` / `CLAUDE.md`, defaulting to English. It outlives the session that produced it and is
read by whoever picks up the next update.

## Detection

| Axis | What it finds |
|---|---|
| Ecosystem and installs | Package manager (via lockfile), update commands, how many independent installs share the repo, whether Renovate/Dependabot opens the PRs |
| Baseline | Type check, lint, test, build commands, and which of them CI runs |
| Second baseline | Visual regression, bundle-size budget, benchmark, structural snapshot, Lighthouse budget — plus what each one does *not* cover |
| Pins and couplings | What is already pinned exactly, what determines the result but carries a range anyway, which versions appear in more than one file, and where CI masks a drift |

Manifest, config and lockfile signals come from `knowledge/project-tooling-detection.md`, shared with
[workflow](./workflow.md) so both skills detect identically.

## Interview

Detection finds signals; it cannot find meaning. The generator asks at most six questions, and only those whose
trigger actually fired — for example, a second baseline was found (what does it cover, on which engine, does CI run
it), a `CHANGELOG.md` exists (does an entry reach anything outside the repo), or the same version string turned up
in several files (is that the complete list).

Where the user does not know, the answer is written into the generated skill as an open question with the command
to settle it — never as an invented rule.

## Modes

### Generate (default)

1. Check for an existing skill — offer `--audit` instead of replacing, to preserve accumulated findings
2. Detect ecosystem, install boundaries and update commands
3. Detect the baseline, including any second baseline and its documented limits
4. Detect exact pins, multi-file version strings and cross-install couplings
5. Interview the gaps (max six triggered questions)
6. Present for approval
7. Write `.claude/skills/dependency-update/SKILL.md`

### Audit (`--audit`)

1. Read the existing skill
2. Re-run detection (no re-interview)
3. Compare, separating project drift from skill drift — including two checks that a
   before/after comparison cannot reach: a result-determining package that has *always* carried a range, and a
   ticket the skill names as the current one but which has since closed
4. Report, project drift first
5. Offer to fix the document; report project drift for the user to decide on

## Related

- [workflow](./workflow.md) -- Generates the task completion workflow this skill hands off to
- [finalize](./finalize.md) -- Executes that workflow
