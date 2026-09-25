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
| --- | --- |
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

Read the project's commit rules while you are there: the instruction file, `CONTRIBUTING*`, a commitlint config
(`commitlint.config.*`, `.commitlintrc*`) and a commit template (`.gitmessage`, `git config commit.template`).
Record the subject format, whether a ticket key is required, whether a mechanical change gets a body, where measured
numbers belong, and whether changes merge through a PR/MR with CI or a review bot. The generator has no commit shape
of its own — §4 of the generated skill states the project's.

### Step 2: Detect ecosystem and install boundaries

Read `${CLAUDE_PLUGIN_ROOT}/knowledge/project-tooling-detection.md` for the manifest, config and lockfile tables,
and apply them. Then answer four questions this skill needs beyond that:

**How many independent installs are there?** Count manifests that each have their own lockfile. Two manifests with
two lockfiles are two projects that share a repository: they install separately, they can be updated separately, and
a request that touches both is really two.

**Which update commands does this manager offer?** Record the actual invocations, not the generic ones — and pick
the one that moves only the named package:

| Manager | Inspect outdated | Update |
| --- | --- | --- |
| pnpm | `pnpm outdated` | `pnpm add [-D] <pkg>@^<ver>` (`--filter <project>` or `-w` in a workspace) — or `@<ver>` for an exact pin: keep the manifest's operator; before pnpm 11.23, `pnpm update <pkg>` could re-resolve unrelated packages |
| npm | `npm outdated` | `npm install <pkg>@<ver>` |
| Yarn | `yarn outdated` | `yarn up <pkg>@<ver>` (not `-R`, which re-resolves every range of the package) |
| Composer | `composer outdated` | `composer require <pkg>:<ver>` (without `-w`/`-W`, which also update its dependencies) |
| Poetry / uv | `poetry show --outdated` / `uv tree --outdated` | `poetry add <pkg>@<ver>` / `uv add <pkg>==<ver>` |
| Cargo | `cargo outdated` | `cargo update -p <crate> --precise <ver>` |
| Go | `go list -m -u all` | `go get <module>@<ver>` (may raise modules it requires — by design, read the `go.mod` diff) |
| Bundler | `bundle outdated` | `bundle update --conservative <gem>` (plain `bundle update <gem>` also updates its dependencies) |

**Is there an automated update source?** Check for `.github/dependabot.yml`, `renovate.json`, `.renovaterc*`, or a
Renovate config block in `package.json`. If one exists, the generated skill starts from its PRs rather than from
`outdated`, and should say so.

**Is there a release-age gate?** A minimum age for new versions changes what "the newest version" means, and the
tools on one machine disagree about it. The gate often lives outside the repository, so look in the repository, the
user's and global config, and the update bot's config, and read the files themselves. Neither a config listing nor
a file is proof on its own: pnpm 10 prints `undefined` for `config get minimumReleaseAge` while a gate from
`~/.npmrc` is in effect, and it silently ignores the same setting spelled `minimumReleaseAge` in its ini `rc` file.

| Source | Setting | Where it is read from |
| --- | --- | --- |
| pnpm ≥ 10.16 | `minimumReleaseAge` (minutes) | pnpm 10: `pnpm-workspace.yaml`; in ini files (`.npmrc`, `~/.npmrc`) spelled `minimum-release-age`. pnpm ≥ 11: `pnpm-workspace.yaml`, global `config.yaml` only — `.npmrc` and `rc` are ignored for it; built-in default 1440 |
| npm ≥ 11.10 | `min-release-age` (days), or `before` (date) | project, user (`~/.npmrc`) and global `npmrc` |
| Yarn ≥ 4.10 | `npmMinimalAgeGate` (duration) | `.yarnrc.yml`; default `1d` since 4.15 |
| Bun ≥ 1.3 | `install.minimumReleaseAge` (seconds) | `bunfig.toml`, global `~/.bunfig.toml` |
| uv | `exclude-newer` (timestamp or duration) | `pyproject.toml` `[tool.uv]`, `uv.toml`, user `~/.config/uv/uv.toml` |
| Poetry ≥ 2.4 | `solver.min-release-age` (days) | `poetry.toml`, global Poetry config |
| Bundler | `cooldown` (days) | `bundle config`, per `source` in the `Gemfile` |
| Renovate | `minimumReleaseAge` | Renovate config; pending releases get a status check or no PR |
| Dependabot | `cooldown` | `dependabot.yml`; version updates only, 3-day default even when unset |

For a manager not listed, check its documentation for the version in use rather than concluding there is none.
Defaults count: a manager can gate without any file saying so.

Then probe the behaviour, which does not depend on where the gate is configured: for a **direct** dependency,
compare the manager's own "latest" (e.g. `pnpm outdated`, which respects the gate since pnpm 10.18) with the same
package's newest release queried from its registry directly (`npm view <pkg> version` for the npm registry — the
`latest` dist-tag, which is also what the manager starts from). A difference proves a gate is in effect. No
difference proves nothing — perhaps no direct dependency has a release younger than the gate right now — so only the
file search counts then, and if that found nothing either, the generated skill carries an open question, not "no
gate". The probe shows _that_ a gate acts, not _where_ it is set: to locate it, rerun the probe with one source
disabled (`npm_config_userconfig=/dev/null` hides `~/.npmrc` from npm and pnpm) — never by editing the user's files.

Record the value, where it lives — a gate in user config does not apply in CI, where it only matters without a
frozen lockfile — which display respects it, and which shows versions the manager will not install (registry
queries, editor plugins).

### Step 3: Detect the baseline

The baseline is every check that must be green _before_ the first version changes. Collect the commands from the
manifest's scripts or the ecosystem defaults: type check, lint, unit tests, integration/E2E tests, build.

Then look specifically for a **second kind of baseline** — one that catches what a functional suite cannot. This is
the highest-value detection in this skill, because a dependency can pass every behavioural test and still be wrong:

| Signal | Second baseline |
| --- | --- |
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

**Which packages form a family?** Direct dependencies that share a scope _and_ share internal packages in the
lockfile — a component library published as many `@scope/*` packages on common `@scope/*` internals, Radix for
example. Confirm by asking the manager why one of the shared internals is installed (`pnpm why`, `npm ls`); several
direct dependencies of the family should appear. Each confirmed family is named in §2 of the generated skill, since
it moves in one step whatever the tiers of its members.

**Where does CI mask a drift?** If CI activates a fixed toolchain version for every job, a mismatch between two
projects in the repo only ever appears locally. Note it.

**Does a lockfile-only change reach production?** In a workspace the lockfile and root manifest sit at the
repository root, while a deploy may build from a subdirectory and skip any commit that changes nothing under it.
Netlify with `base` set cancels such a build unless an `ignore` command says otherwise, and Render with a root
directory does not autodeploy it — a transitive security fix, or a dedupe, then never ships. Check the deploy config
(`netlify.toml` `base` and `ignore`, Render's root directory and build filters) and, for any other platform, its
documentation on skipped builds. Report a gap as a project finding, like an unpinned result-determining package:
never change deploy config as a side effect. The generated skill names it as a coupling, so an update that only
touches the lockfile is known not to deploy on its own.

### Step 5: Interview the gaps

Detection finds signals; it cannot find meaning. Ask only questions whose trigger actually fired — a question about
a visual suite that does not exist wastes the user's attention and teaches them the interview is boilerplate.

Ask as grouped sets rather than one question per message — `AskUserQuestion` takes at most four per call, so six
triggered questions means two rounds. Six is the ceiling; if more triggers fired, drop the least consequential.

| Fired when | Ask |
| --- | --- |
| A second baseline was found (Step 3) | What does it cover, at what tolerance, and which packages influence its output? |
| A second baseline was found | Which engine and platform does it run on, versus where the product actually runs — and does CI run it, or only a developer machine? |
| UI-affecting dependencies present (CSS framework, component library, charting, icon set) but **no** second baseline | Is there anything that would catch a purely visual regression? If not, this is recorded as a known gap with a per-run procedure next to it (Step 7), not glossed over. |
| `CHANGELOG.md` exists | Does an entry there have an effect outside the repository — a release feed, an auto-updater, store notes? Which changes deserve no entry at all? |
| A version string was found in 2+ files (Step 4) | Is this the complete list, and must they always move together? |
| The release-age probe was inconclusive and no gate was found in any file (Step 2) | Does a minimum release age apply anywhere — your user config, CI, a registry proxy, the update bot? |
| 2+ independent installs (Step 2) | Which packages must stay in version-sync across them, and which may legitimately differ? |
| Always | Which commands in this project exit non-zero without being broken, or fail for a reason unrelated to the code? |
| Always | Do dependency updates follow a ticket or issue convention here, and does the skill start from an existing ticket or create one? |
| Step 1 found no rule for where measured numbers go | Where should an update's measurements go — commit body, ticket comment, PR description — and does a plain version bump get a commit body at all? |

Two rules for handling answers:

- **Never invent an answer.** If the user does not know whether a changelog entry reaches an updater, write that
  into the generated skill as an open question with the command to find out — not as a confident rule.
- **Prefer the answer that names a file or a number.** "Five places: both `package.json`, the `corepack` line, the
  CI header comment, and AGENTS.md" is usable; "a few places" is not.

### Step 6: Present and confirm

Show the user:

1. **The detected baseline** — every command, and which of them CI runs
2. **The second baseline and its limits**, or an explicit "none found" with the gap it leaves and the per-run
   procedure proposed to cover it
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

{Starting point: the update bot's PRs, or the manager's outdated command. The release-age gate, if any: its value,
where it lives and whether CI sees it, which display is binding and which shows versions that will not install — and
that a target taken from a ticket or an editor is first checked against the gate by its publish date
(`npm view <pkg> time --json` or the ecosystem's equivalent). An undetermined gate is written as the open question
it is.}

**Open an observations note now** (one file, scratchpad) and add to it whenever something in this skill turns out
wrong, missing, or slower than it needed to be. The last step folds it back in. Doing it at the end from memory
does not work — the useful details are the ones that felt obvious at the time.

**Turn the checklist at the bottom into a todo list now, one item each**, and answer it before reporting done.
Every item asks for a value rather than a tick, because a tick can be given without having done anything.

## 1. Baseline first — before changing a single version

{Commands, per install. Note which ones CI runs.}

Write the result down including warning, hint and info counts — not pass/fail. The counts are what later
distinguishes "this bump caused it" from "that was already there". Read the output; do not pipe it through `grep`.

{Second baseline block: command, what it covers, tolerance, which packages influence it, and its limits verbatim.
Or, when none exists: the gap stated as one, plus a per-run procedure matched to the UI libraries detected — for
example screenshots with a pixel diff that reports magnitude for a component library, a per-element DOM snapshot
(tag, class, inline SVG) for class-merging and icon libraries, a rule-level diff of the compiled CSS for a CSS
framework, an A/B of the patterns actually used for a formatting library. Propose what the detected libraries can
change; none of these is required.}

If the baseline is already red or noisy, stop and report that first.

## 2. Classify each package into one of three tiers

- **Patch, same minor** — update together in one step, unless a peer range pulls in a minor (read the update
  command's output, not its exit code) or the package belongs to a family below.
- **Minor** — update, then run the regression that actually covers that package, named per package{; examples only
  where the imports were traced}.

{Families from Step 4: which packages move in one step whatever their tiers, and how to check the lockfile for
duplicates afterwards.}
- **Major** — do not bundle. {Ticket convention, if any — the rule, never a specific open ticket number.}

## 3. Verify claims instead of assuming

{Ecosystem-specific commands from Step 2 detection, plus the four generic rules from the methodology.}

{Project-specific exit-code traps from the interview.}

## 4. One logical step per commit, verified in between

{Ordering rules, naming what in this project can move the test harness itself.}

{Commit shape as the project's rules state it (Step 1): subject format, ticket key, whether a plain bump gets a body,
where the measured numbers go. If changes merge through a PR/MR with CI or a review bot: every review thread is fixed
or answered before the merge.}

## 5. Couplings — check these every time

{Table: package, why it matters, how many places hold the version.}

## 6. Traps

Known traps live in {instruction file}, not here — they are always loaded there and reach whoever never invokes
this skill. Add what you find there rather than to this file.

## 7. Finish

{Handoff to the task completion workflow, if one exists — by file, with its steps named as the workflow names them.
Skip only what the workflow itself allows to skip for this kind of change.}

{Changelog rules from the interview: which changes get an entry and which do not, and why.}

## 8. Fold the observations back in

{Methodology §7, with the project's instruction file named and the story sent where the project's commit rules put
it.}

## Checklist

{One numbered item per value: baseline numbers, tiering, per-bump coverage, verified claims, unfiltered output,
{second baseline result}, final state versus baseline and where it was recorded, {PR/MR and each review thread},
observations folded in.}
````

**Name coverage only after tracing it.** A per-package example in §2 ("`<pkg>` → `<test file>`") is written only
after following the imports: which files import the package, whether any of them is itself imported, and which test
imports that chain. A package whose only importer is unreachable is exercised by nothing but the type check — the
example says exactly that and names no test, and the dead importer is worth reporting on its own. Without the trace,
write the rule and the trace command instead — an untraced example reads as verified coverage, and the next update
trusts it.

**Write no claim that expires on its own.** A ticket number, a milestone or a release named as the _current_ one is
true on the day it is written and silently false afterwards — the generated skill has no way to notice, and the
next reader has no reason to doubt it. State the rule instead ("a major goes in its own ticket with its own
verification"); closed tickets may still be cited, but only where they are introduced as past examples. The same
applies to counts that the project can change without touching this file: write how to obtain the number, or accept
that the audit has to re-derive it.

Then:

1. Show the user the written file.
2. If a task completion workflow exists (`.claude/skills/task-completion/SKILL.md` or a workflow section in the
   instruction file), confirm the handoff in §7 names it correctly, cites each step as the workflow numbers or names
   it — read, not recalled — and skips nothing the workflow does not itself allow to skip. An exception the
   workflow does not grant is a rule the generator invented.
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

Repeat Generate Steps 2-4, and re-read the two sources Step 3 below compares against: the project's commit rules
(Generate Step 1) and the task completion workflow (Generate Step 7). Do not repeat Step 5 — an audit must not
re-interview the user about answers the skill already records. Ask only where a _new_ trigger fired that the skill
has no answer for.

### Step 3: Compare

| Check | Finding |
| --- | --- |
| A command in the skill no longer exists | Script renamed or removed |
| A detected check is not in the baseline | Baseline incomplete — new tooling was added |
| A second baseline exists that the skill does not mention | The most costly gap; report first |
| The skill's stated limits no longer hold | E.g. the visual suite now runs in CI, or on a second platform |
| An exact pin has become a range | Someone loosened a decision; confirm it was deliberate |
| A result-determining package carries a range and always has | **Not a change — a standing gap.** A comparison against the previous state cannot surface this, so check it outright every audit (Step 4 of Generate) |
| A lockfile-only change would not trigger a deploy, and the skill does not say so | **Project finding** — a security fix in the lockfile alone never ships. Check it outright every audit (Step 4 of Generate) |
| A coupled version now differs across files | **Live drift — this is a project bug, not a document bug** |
| A version string now appears in more files than the skill states | Coupling grew |
| An install was added or removed | Scope statement stale |
| An automated update source appeared | Renovate/Dependabot now opens the PRs |
| A release-age gate is in effect that the skill does not mention | Targets from a ticket or an editor may not install, and "latest" means two things |
| The skill describes a gate, or a tool's view of it, differently from what detection finds or the probe measures | A tool claim nobody verified — correct it from the file and the measurement, not from another guess |
| The skill prescribes a commit shape the project's rules contradict — subject format, ticket key, what goes in a body | The project's rules win; check where the skill sends measured numbers |
| The skill cites a workflow step the workflow does not have, or skips one the workflow does not let it skip | Handoff stale — the workflow was renumbered, or the generator invented an exception |
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
