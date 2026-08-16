# Dependency Update Methodology

The transferable rules for updating dependencies safely. Project values — which commands form the baseline, which
packages are coupled, what a changelog entry means — belong in the generated project skill, not here. This file is
what `/ak-review:deps` draws on so it composes a method rather than inventing one per project.

## 1. Baseline first, as numbers

Run every check *before* changing a single version and write the results down, including warning, hint and info
counts. Not pass/fail: the counts are what later distinguishes "this bump caused it" from "that was already there".

**Read the output, do not filter it.** Piping a build through `grep "built in"` to keep the transcript tidy throws
away precisely what a dependency bump produces — a new deprecation warning survives a green suite unnoticed. Some
test runners intercept console output by default (Vitest does; `--disableConsoleIntercept` turns it off), which
hides library chatter exactly when a bump makes a library start talking.

**A green functional suite is not a green baseline.** Tests assert behaviour, and a dependency can be functionally
correct while being visually, structurally or operationally wrong. Where a project has a second kind of baseline —
pixel comparison, snapshot, bundle size, benchmark — it belongs in the baseline run, and its limits (which engine,
which platform, whether CI runs it) belong written next to it.

If the baseline is already red or noisy, stop and report that first. Updating on top of a broken baseline makes
attribution impossible for everyone after you.

## 2. Classify each package into one of three tiers

- **Patch, same minor** — update together in one step.
- **Minor** — update, then run the regression that actually covers that package. Name it per package: "the suite is
  green" is not the same as "the thing this package does was exercised". Tracing the coverage is cheap and often
  turns a vague "check visually" into a specific command.
- **Major** — do not bundle. Its own change, its own verification, and if the project tracks tickets, its own ticket.

## 3. Verify claims instead of assuming

Assumptions about packages are cheap to make and expensive to be wrong about. A package's own declared metadata is
authoritative where a blog post or a changelog summary is not.

| Question | Command |
|---|---|
| Why is this installed, and who needs it? | `pnpm why <pkg>` / `npm ls <pkg>` / `composer why <pkg>` / `cargo tree -i <crate>` / `go mod why <module>` / `pip show <pkg>` |
| Does X support Y? | `npm view <pkg>@<ver> peerDependencies engines` / `composer why-not <pkg> <ver>` / `cargo add <crate>@<ver> --dry-run` |
| What does this tool actually do? | Read its source in the install directory (`node_modules/`, `vendor/`, `site-packages/`) |

Four rules that hold in every ecosystem:

- **A/B swap a version to test whether a message is new.** Install the old version, run the check, install the new
  one, compare. Two commands, and it settles "did this bump cause the warning" instead of leaving it open.
- **Never run a migration command blindly** (`biome migrate --write`, `eslint --migrate-config`, `rector process`
  and their kind). Run it on a copy, read the result, and verify the *effect*, not the exit code.
- **A non-zero exit is not automatically a failure, and a failure is not automatically real.** A build that stops at
  a signing or publishing step may have produced every artifact first. A check may fail because a previous command
  left the wrong build in place. Look at what was produced before calling either one broken.
- **Start the application, not just the suite.** For anything touching the build chain (bundler, CLI, CSS toolchain),
  run the dev command once and read what it prints. Build-chain deprecations often surface nowhere else.

## 4. One logical step per commit, verified in between

Four packages bumped at once means a red test points at four suspects. Commit per step and run the relevant checks
before moving on. It is also what lets a commit message state what was measured rather than what was hoped.

**Order matters when a change can move the test harness itself.** A fix that keeps the suite runnable goes first and
alone, even if it is inert until the bump lands. Anything that changes how output is produced or rendered goes
before anything that changes what is rendered, so a difference has one possible cause and not two.

## 5. Pin what determines the result

Pin exactly — no caret, no tilde — anything whose version decides the *outcome* rather than merely what installs:
formatters, linters, browser engines, compilers, the package manager itself. A caret on those turns a reproducible
check into a moving target.

The listing below is only half the check. The other half is which result-determining packages are *missing* from
it — a package that was never pinned looks identical on every run, so nothing but an outright check will surface it.

To list what a project already treats that way:

```bash
# npm/pnpm/yarn
node -e "const p=require('./package.json');for(const s of ['dependencies','devDependencies'])for(const [k,v] of Object.entries(p[s]||{}))if(!/^[\^~]/.test(v))console.log(s,k,v)"
```

```bash
# composer
python3 -c "import json;d=json.load(open('composer.json'));[print(s,k,v) for s in ('require','require-dev') for k,v in d.get(s,{}).items() if not v[0] in '^~>*']"
```

## 6. Couplings drift silently

Two manifests with two lockfiles are two projects: nothing forces them to agree. Packages whose version determines
the result (see above) drift first and quietly, because each project stays internally consistent.

A version pinned in more than one place is the same problem in miniature — a toolchain version duplicated across a
manifest, a CI config, a Dockerfile and a documentation line has four chances to disagree. CI often hides such a
drift by activating a fixed version for every job, so it only ever appears on a developer machine.

## 7. Fold the observations back in

Keep a note while working and place each entry before reporting done:

- **A step was wrong, incomplete or in the wrong order** → fix the project skill.
- **A tool behaved in a way that would surprise the next person** → add it to the project instruction file, where it
  reaches whoever never invokes the skill.
- **Neither** → drop it. "Nothing to add" is a normal outcome; inventing an improvement to have one makes the skill
  worse.

Two rules keep this from turning the skill into a changelog. **Prefer editing an existing line over adding a new
one** — a document that only grows stops being read, and an unread skill guards nothing. And **write the correction,
not the anecdote**: the next reader needs the rule, not the story of how it was found. The story belongs in the
commit message.

## 8. Ask for values, not ticks

A generated skill ends in a checklist whose every item demands an actual value — the baseline numbers, the test that
covers each minor bump, which assumption was checked with which command. A tick can be given without having done
anything; a blank where a number belongs shows the step did not happen.
