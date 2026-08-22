---
name: deps
description: >
  Generate or audit a project-specific dependency update skill. Use when the user asks to
  "set up dependency updates", "create a dependency update skill", "generate a dependency
  workflow", "audit my dependency update skill", or wants a repeatable, project-aware
  procedure for bumping dependencies safely.
---

# Deps

Generate a project-specific dependency update skill at `.claude/skills/dependency-update/SKILL.md`, or audit an
existing one against the project's current state.

The methodology is generic and lives in
`${CLAUDE_PLUGIN_ROOT}/knowledge/dependency-update-methodology.md`. What varies per project is which commands form
the baseline, what a second kind of baseline covers, which versions are pinned in more than one place, and what a
changelog entry means. This skill detects what it can, asks about what it cannot, and writes both into the
generated skill.

**This skill does not update any dependency.** It produces the procedure that does.

**Ask and report in the language of the invoking session** — the same rule `/ak-review:setup` and
`/ak-review:execute` follow. The Step 5 interview and every audit report go to a person, so they follow that
person's language.

**The generated skill file does not.** Its language follows the target project's own instruction files
(`AGENTS.md` / `CLAUDE.md`), defaulting to English when they give no signal. A generated skill outlives the session
that produced it and is read by whoever picks up the next update, so it should read like the rest of the project
rather than like the conversation that happened to create it. Commands, file paths and package names are never
translated in either case.

## Arguments

Parse `$ARGUMENTS` for mode:

| Argument | Mode |
|---|---|
| _(none)_ | **Generate** — Scan project, interview the gaps, write the skill |
| `--audit` | **Audit** — Check an existing skill against the project's current state |

## Mode: Generate

### Step 1: Check for an existing skill

Look for `.claude/skills/dependency-update/SKILL.md`. If it exists, read it, show the user its section headings, and
ask whether to **replace** it or **cancel**. Do not proceed without an answer.

If it exists but has drifted, point out that `--audit` updates it in place and preserves the accumulated project
findings — replacing it throws those away. Recommend the audit unless the user wants a clean rebuild.

Also locate the project instruction file (`AGENTS.md`, then `CLAUDE.md`, then `.claude/CLAUDE.md`) — Step 7 writes
traps there, not into the generated skill.

### Step 2: Detect ecosystem and install boundaries

Read `${CLAUDE_PLUGIN_ROOT}/knowledge/project-tooling-detection.md` for the manifest, config and lockfile tables,
and apply them. Then answer three questions this skill needs beyond that:

**How many independent installs are there?** Count manifests that each have their own lockfile. Two manifests with
two lockfiles are two projects that share a repository: they install separately, they can be updated separately, and
a request that touches both is really two.

**Which update commands does this manager offer?** Record the actual invocations, not the generic ones:

| Manager | Inspect outdated | Update |
|---|---|---|
| pnpm | `pnpm outdated` | `pnpm update <pkg>@<ver>` / `pnpm add -D <pkg>@<ver>` |
| npm | `npm outdated` | `npm install <pkg>@<ver>` |
| Yarn | `yarn outdated` | `yarn up <pkg>@<ver>` |
| Composer | `composer outdated` | `composer require <pkg>:<ver>` |
| Poetry / uv | `poetry show --outdated` / `uv lock --upgrade-package` | `poetry add <pkg>@<ver>` / `uv add` |
| Cargo | `cargo outdated` | `cargo update -p <crate> --precise <ver>` |
| Go | `go list -m -u all` | `go get <module>@<ver>` |
| Bundler | `bundle outdated` | `bundle update <gem>` |

**Is there an automated update source?** Check for `.github/dependabot.yml`, `renovate.json`, `.renovaterc*`, or a
Renovate config block in `package.json`. If one exists, the generated skill starts from its PRs rather than from
`outdated`, and should say so.

### Step 3: Detect the baseline

The baseline is every check that must be green _before_ the first version changes. Collect the commands from the
manifest's scripts or the ecosystem defaults: type check, lint, unit tests, integration/E2E tests, build.

Then look specifically for a **second kind of baseline** — one that catches what a functional suite cannot. This is
the highest-value detection in this skill, because a dependency can pass every behavioural test and still be wrong:

| Signal | Second baseline |
|---|---|
| `toHaveScreenshot` / `toMatchSnapshot` on images, `*-snapshots/`, `__image_snapshots__/` | Visual regression |
| `percy`, `chromatic`, `backstopjs`, `reg-suit`, `loki` in dependencies | Visual regression (hosted or local) |
| `size-limit`, `bundlesize`, `bundlewatch`, `.size-limit.*` | Bundle size budget |
| `benchmark`, `vitest bench`, `criterion`, `pytest-benchmark`, `hyperfine` | Performance benchmark |
| `*.snap`, `__snapshots__/`, `insta` (Rust), `approvaltests` | Structural snapshot |
| `lighthouserc*`, `@lhci/cli` | Lighthouse budget |

Record for each: the command, whether it runs in CI, and — crucially — **what it does not cover**. A visual suite
that renders in Chromium while the product ships in a WebView catches CSS and layout, not paint behaviour. A
snapshot suite pinned to one OS cannot run on another. These limits go into the generated skill verbatim; a baseline
whose blind spots are undocumented gets trusted past them.

Also check whether the test runner swallows console output — Vitest intercepts by default
(`--disableConsoleIntercept` turns it off), and a bump that makes a library start warning is invisible without it.

### Step 4: Detect pins and couplings

**What is already pinned exactly?** Run the ecosystem's listing snippet from
`${CLAUDE_PLUGIN_ROOT}/knowledge/dependency-update-methodology.md` §5. An exact pin is a decision someone made; the
generated skill must not silently loosen it.

**What determines the result but is _not_ pinned?** Ask this separately, because it is the question a
pin-versus-range comparison never reaches: a package that was never pinned looks the same on every run. Cross the
detected formatters, linters, browser engines, compilers and the package manager against the exact-pin list from
above; anything on the first list and missing from the second carries a range on something whose version decides
the outcome. Report each one with the range it currently carries. This is a finding about the project, not about
the skill — never pin anything as a side effect of generating a document.

**Which versions appear in more than one place?** These are the silent-drift candidates:

- The same package at different versions across manifests (compare the parsed manifests directly)
- A `packageManager` field, a `corepack prepare` line, a `setup-node`/`setup-python` version, a Docker base tag, an
  `engines` field, a `.tool-versions`/`.nvmrc`/`rust-toolchain.toml` entry — grep the repo for the literal version
  string found in the manifest and report **every** file it appears in, including comments and documentation
- Schema URLs that carry a version (`$schema` in a formatter config against the formatter's own version)

Report the count per version string. A toolchain version that appears in five files is five chances to disagree, and
that number is exactly what the generated skill needs to state.

**Where does CI mask a drift?** If CI activates a fixed toolchain version for every job, a mismatch between two
projects in the repo only ever appears locally. Note it.

### Step 5: Interview the gaps

Detection finds signals; it cannot find meaning. Ask only questions whose trigger actually fired — a question about
a visual suite that does not exist wastes the user's attention and teaches them the interview is boilerplate.

Ask as grouped sets rather than one question per message — `AskUserQuestion` takes at most four per call, so six
triggered questions means two rounds. Six is the ceiling; if more triggers fired, drop the least consequential.

| Fired when | Ask |
|---|---|
| A second baseline was found (Step 3) | What does it cover, at what tolerance, and which packages influence its output? |
| A second baseline was found | Which engine and platform does it run on, versus where the product actually runs — and does CI run it, or only a developer machine? |
| UI-affecting dependencies present (CSS framework, component library, charting, icon set) but **no** second baseline | Is there anything that would catch a purely visual regression? If not, this is recorded as a known gap, not glossed over. |
| `CHANGELOG.md` exists | Does an entry there have an effect outside the repository — a release feed, an auto-updater, store notes? Which changes deserve no entry at all? |
| A version string was found in 2+ files (Step 4) | Is this the complete list, and must they always move together? |
| 2+ independent installs (Step 2) | Which packages must stay in version-sync across them, and which may legitimately differ? |
| Always | Which commands in this project exit non-zero without being broken, or fail for a reason unrelated to the code? |
| Always | Do dependency updates follow a ticket or issue convention here, and does the skill start from an existing ticket or create one? |

Two rules for handling answers:

- **Never invent an answer.** If the user does not know whether a changelog entry reaches an updater, write that
  into the generated skill as an open question with the command to find out — not as a confident rule.
- **Prefer the answer that names a file or a number.** "Five places: both `package.json`, the `corepack` line, the
  CI header comment, and AGENTS.md" is usable; "a few places" is not.

### Step 6: Present and confirm

Show the user:

1. **The detected baseline** — every command, and which of them CI runs
2. **The second baseline and its limits**, or an explicit "none found" with the gap it leaves
3. **The couplings**, with the file count per version string
4. **What the interview added** that detection could not have found

Wait for approval. If the user corrects a detection, fix it and present again — a wrong command in a generated skill
is worse than a missing one, because it gets run.

### Step 7: Write the skill

Write `.claude/skills/dependency-update/SKILL.md`, creating the directory if needed. Fill the template below with
the detected and interviewed values; omit any section whose trigger never fired rather than emitting an empty one.

````markdown
---
name: dependency-update
description: Dependency updates for {project} — baseline{, second baseline}, tiering, verification, commit shape{, couplings}. Use when carrying out a dependency update.
---

# Dependency updates

{Scope: which install this covers, and that a request touching both is really two. What is out of scope.}

**Open an observations note now** (one file, scratchpad) and add to it whenever something in this skill turns out
wrong, missing, or slower than it needed to be. The last step folds it back in. Doing it at the end from memory
does not work — the useful details are the ones that felt obvious at the time.

**Turn the checklist at the bottom into a todo list now, one item each**, and answer it before reporting done.
Every item asks for a value rather than a tick, because a tick can be given without having done anything.

## 1. Baseline first — before changing a single version

{Commands, per install. Note which ones CI runs.}

Write the result down including warning, hint and info counts — not pass/fail. The counts are what later
distinguishes "this bump caused it" from "that was already there". Read the output; do not pipe it through `grep`.

{Second baseline block: command, what it covers, tolerance, which packages influence it, and its limits verbatim.}

If the baseline is already red or noisy, stop and report that first.

## 2. Classify each package into one of three tiers

- **Patch, same minor** — update together in one step.
- **Minor** — update, then run the regression that actually covers that package, named per package.
- **Major** — do not bundle. {Ticket convention, if any — the rule, never a specific open ticket number.}

## 3. Verify claims instead of assuming

{Ecosystem-specific commands from Step 2 detection, plus the four generic rules from the methodology.}

{Project-specific exit-code traps from the interview.}

## 4. One logical step per commit, verified in between

{Ordering rules, naming what in this project can move the test harness itself.}

## 5. Couplings — check these every time

{Table: package, why it matters, how many places hold the version.}

## 6. Traps

Known traps live in {instruction file}, not here — they are always loaded there and reach whoever never invokes
this skill. Add what you find there rather than to this file.

## 7. Finish

{Handoff to the task completion workflow, if one exists.}

{Changelog rules from the interview: which changes get an entry and which do not, and why.}

## 8. Fold the observations back in

{Methodology §7, with the project's instruction file named.}

## Checklist

{One numbered item per value: baseline numbers, tiering, per-bump coverage, verified claims, unfiltered output,
{second baseline result}, final state versus baseline, observations folded in.}
````

**Write no claim that expires on its own.** A ticket number, a milestone or a release named as the _current_ one is
true on the day it is written and silently false afterwards — the generated skill has no way to notice, and the
next reader has no reason to doubt it. State the rule instead ("a major goes in its own ticket with its own
verification"); closed tickets may still be cited, but only where they are introduced as past examples. The same
applies to counts that the project can change without touching this file: write how to obtain the number, or accept
that the audit has to re-derive it.

Then:

1. Show the user the written file.
2. If a task completion workflow exists (`.claude/skills/task-completion/SKILL.md` or a workflow section in the
   instruction file), confirm the handoff in §7 names it correctly.
3. **Optional**: if `skill-creator` is installed, offer to run it against the new file as a structural quality pass.
   Skip silently if unavailable; do not suggest installing it for this.

Do not add a pointer to the instruction file. Unlike a task completion workflow, this skill is invoked by name when
a dependency update starts — it does not need to be discoverable from every prompt.

## Mode: Audit (`--audit`)

Audit is not only a drift check on the document. Because it re-runs detection, it finds drift in the **project** —
a coupling that has come apart since the skill was written.

### Step 1: Find the skill

Read `.claude/skills/dependency-update/SKILL.md`. If it does not exist, say so and suggest `/ak-review:deps` without
the flag.

### Step 2: Re-run detection

Repeat Generate Steps 2-4. Do not repeat Step 5 — an audit must not re-interview the user about answers the skill
already records. Ask only where a _new_ trigger fired that the skill has no answer for.

### Step 3: Compare

| Check | Finding |
|---|---|
| A command in the skill no longer exists | Script renamed or removed |
| A detected check is not in the baseline | Baseline incomplete — new tooling was added |
| A second baseline exists that the skill does not mention | The most costly gap; report first |
| The skill's stated limits no longer hold | E.g. the visual suite now runs in CI, or on a second platform |
| An exact pin has become a range | Someone loosened a decision; confirm it was deliberate |
| A result-determining package carries a range and always has | **Not a change — a standing gap.** A comparison against the previous state cannot surface this, so check it outright every audit (Step 4 of Generate) |
| A coupled version now differs across files | **Live drift — this is a project bug, not a document bug** |
| A version string now appears in more files than the skill states | Coupling grew |
| An install was added or removed | Scope statement stale |
| An automated update source appeared | Renovate/Dependabot now opens the PRs |
| The skill names a ticket, issue or milestone as the _current_ one | Check whether it is still open. A named "current" ticket is a claim with an expiry date, and it expires silently |

### Step 4: Report

Group by kind, because the two need different fixes:

```markdown
## Dependency Skill Audit

### Project drift (fix the project)
- **[Coupling]** `@biomejs/biome` — root 2.3.1, `site/` 2.2.0. The skill says these must match.

### Skill drift (fix the document)
- **[Baseline]** `pnpm test:visual` added since the skill was written — not in step 1
- **[Stale]** Step 3 references `pnpm lint`; package.json now has `check`

### Still accurate
- **[Couplings]** `packageManager` in 5 files — confirmed, all at 10.2.0
```

### Step 5: Offer to fix

Ask before changing anything. **Skill drift** is edited in place — prefer editing an existing line over adding a new
one, and keep the accumulated project findings. **Project drift** is not this skill's to fix: report it, and let the
user decide whether it becomes a dependency update of its own.

## Related

- `/ak-review:workflow` — generates the task completion workflow this skill hands off to
- `/ak-review:finalize` — executes that workflow
