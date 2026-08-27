# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.28.0] - 2026-08-27

### ✨ Added

- `ak-review:execute` — **per-model runtime settings via `model_overrides`.** A model that reliably
  runs longer than the adapter's 20-minute ceiling previously left only bad options: raise
  `AK_REVIEW_TIMEOUT_SECS` globally, which makes every faster model's hang that much more expensive to
  detect, or remember an env prefix at the prompt — and the run it is forgotten on is the one killed
  just short of finishing. Measured 2026-08-27: `opencode-go/glm-5.3-flash` completed a real review in
  898 s against a 900 s ceiling.

  `resolve-config.sh` now reads a `timeout_secs` key and a `model_overrides` map keyed by model id,
  merging the matching entry over the file layers before CLI flags. An entry may set `effort`,
  `fix_threshold` and `timeout_secs`; `tool` and `model` are rejected with an error rather than
  ignored, because the map is keyed on the model that has already been resolved and an entry able to
  change it would mean the applied entry is not the one the resolved model points at. A `null` value
  unsets an inherited setting instead of replacing it — without that, a per-model entry cannot be
  safe across tools, since effort vocabularies belong to the adapter and a `codex` `xhigh` inherited
  by an `opencode` run becomes a `--variant` that tool never defined. Also adds a `--timeout-secs`
  flag for one-off runs, validated here rather than in the adapter so the message names the flag the
  user typed instead of the env var it becomes.

  The adapter is unchanged and still owns enforcement — the resolved value only tells it which number
  to enforce, so the timer still cannot be lost by a harness that backgrounds the call. When nothing
  resolves a value, the variable stays unset and the adapter's own default applies, keeping that
  number in exactly one place. Five test cases cover the override applying, not applying to a
  different model, losing to an explicit flag, the flag's validation, the rejected key, and `null`
  unsetting an inherited value.

- `ak-review:setup` — writing the config now **preserves keys it did not ask about**. The skill asks
  four questions and writes the whole file, so `timeout_secs` and `model_overrides` would have been
  destroyed by a plain overwrite — a per-model timeout silently reverting to the adapter default is
  the kind of loss nobody connects back to having run setup.

## [1.27.0] - 2026-08-24

### 🗑️ Removed

- **`ak-typo3` plugin removed entirely** — 5 skills (`content-blocks`, `extension-kickstarter`,
  `fluid-components`, `make-content-block`, `sitepackage`), 5 agents (`typo3-architect`,
  `typo3-content-blocks-specialist`, `typo3-extension-developer`, `typo3-fluid-expert`,
  `typo3-typoscript-expert`), and its 13-file knowledge base. Marketplace goes from 10 plugins to 9;
  skill and agent counts drop from 29/13 to 24/8 across `AGENTS.md`, `README.md`, and `docs/`.

## [1.26.3] - 2026-08-23

### 🐛 Fixed

- `ak-review:execute` — **Every dollar figure in `SKILL.md` was corrupted whenever the skill was invoked
  with an argument.** `$0.26` looks like a positional parameter, so argument substitution replaced `$0`
  with the argument itself: invoking `/ak-review:execute --show` rendered the cost documentation as
  `--show.26–0.61` and `` `--show.01` ``. It hit all seven amounts — precisely the numbers that explain
  the spend cap. They are now written as `USD 0.26`, which no substitution can touch; a backslash escape
  was rejected because its behaviour here could not be verified. Found by a user's mistyped command,
  which is the only way this surfaces: the file reads correctly on disk.

### ♻️ Changed

- `ak-review:execute` — **`SKILL.md` was 499 lines, and it is loaded in full on every invocation.**
  The Adapter Reference alone was 213 of them, much of it duplicating the reasoning already recorded in
  the adapter scripts' comment headers — `opencode-adapter.sh` carries 126 comment lines of its own.
  Compressed to 371 lines by keeping what an executing agent needs at runtime (how to call it, what the
  exit codes mean, which failures are silent) and pointing at the script headers for the measurements
  and history behind each decision. Phase 3's exit-code semantics became a table. Verified afterwards
  that every warning and instruction survived, including the `auto-rejecting` search term that is the
  entry point for diagnosing a silently uninformed opencode review.

## [1.26.2] - 2026-08-23

### 📝 Documented

- `ak-review:execute` — **The runtime limits had no single place that listed them.** All five
  `AK_REVIEW_*` variables were documented, but each only inside the adapter section that uses it, so
  finding out what knobs exist meant reading all three. A table in Configuration now names every
  variable with its real default (read from the adapters, not from memory), which adapters honour it,
  and what it does — including the two facts a table cannot carry on its own: that the timeout bounds
  one _attempt_ rather than the invocation, and that the budget cap is a ceiling that can be exceeded
  by up to one turn.

### ✨ Added

- `ak-review:setup` — **`--show` now reports the runtime limits actually in force.** They live in the
  environment rather than the config file, which makes them invisible to `resolve-config.sh` and easy
  to forget: an `AK_REVIEW_TIMEOUT_SECS` exported into a shell profile months ago silently governs
  every run since, and nothing surfaced it. `--show` now lists what is set, states that anything
  unlisted is at its default, and flags a variable belonging to an adapter other than the configured
  one — set, but inert.

## [1.26.1] - 2026-08-23

### ♻️ Changed

- `ak-review:execute` — **The claude adapter's spend cap is now on by default at $5**, rather than
  opt-in. It is by a wide margin the most expensive adapter (measured: $0.26–0.61 for a single trivial
  prompt) and the only one whose tool can stop itself on cost rather than on time — so an unattended
  review that quietly runs up an open-ended bill is a worse failure than one that stops and says why.
  Override with `AK_REVIEW_MAX_BUDGET_USD`; remove the cap with `AK_REVIEW_MAX_BUDGET_USD=none`, which
  is deliberately not `0` — that would read as "zero dollars" and abort instantly, the opposite of what
  anyone typing it means.

### 🐛 Fixed

- `ak-review:execute` — **Hitting the cap looked like a review that found nothing.** Claude Code ends
  such a run with `terminal_reason: budget_exhausted` and `result: null` — no report at all — so the
  extractor could only report that none was found, never that the cap was the reason. The adapter now
  detects it and says so, naming the _actual_ spend, how to lift it, and that sub-agents finishing
  before the cap are still recoverable from the stream.

### 📝 Documented

- `ak-review:execute` — **The spend cap is a ceiling, not a guarantee, and now says so.** Claude Code
  checks spend _between_ turns rather than before committing to one, so a run stops once it has already
  gone over. The overshoot is bounded by a single turn, not open-ended: measured, a `$0.01` cap ended a
  run at `$0.28` — after `turns=1`, so one turn, not a runaway. A cap therefore bounds spend to roughly
  _itself plus one turn_, which is worth knowing before setting one at the exact figure you cannot
  exceed. A cap below the price of one turn cannot bind at all, and the adapter now flags that rather
  than letting it look like protection. For a genuinely hard limit, the Anthropic Console's spend
  controls are the only thing outside both this plugin and the tool.

## [1.26.0] - 2026-08-23

### ✨ Added

- `ak-review:execute` — **A `claude` adapter, for running reviews through Claude Code headless.** It is
  the only adapter that combines both qualities the other two split between them: sub-agents per review
  dimension (which `codex` lacks) _and_ monetary cost reporting straight from the tool (which `codex`
  also lacks), without `opencode`'s startup stall. On SWE-Atlas-QnA — the public benchmark closest to
  reviewing, since it measures multi-file code comprehension rather than patch-writing — Opus 5 scores
  63.2 against GPT-5.6-Sol's 46.0, a gap outside the confidence intervals. Verified against Claude Code
  `2.1.240`, including a live end-to-end run.

- `ak-review:execute` — **Read-only is enforced by an allowlist here, and the reason is a measurement,
  not a preference.** A probe run with `--permission-mode plan` alone _successfully created a file_:
  plan mode governs how Claude Code works, not what it may touch. The adapter therefore grants an
  explicit allowlist — `Read`, `Glob`, `Grep`, `Task`, `WebFetch` and four read-only `git` invocations —
  and denies `Write`/`Edit`/`NotebookEdit`. `Bash` is never granted wholesale, because an unrestricted
  shell is a write path no deny-list can close: `touch`, `>`, `sed -i` and the rest cannot be
  enumerated. With the allowlist in place the agent reports it has no permitted way to create a file,
  while `git log` and file reads work normally. `--permission-mode dontAsk` completes it: unattended,
  nothing may sit waiting for a prompt nobody will answer.

- `ak-review:execute` — **`AK_REVIEW_MAX_BUDGET_USD` caps a run's spend in dollars.** Claude Code is by
  a wide margin the most expensive adapter — measured at roughly **$0.26–0.61 for a single trivial
  prompt**, against about $0.002 for the same shape of work through `opencode`, because it loads
  substantial context before doing anything. It is also the only one of the three whose tool can stop
  itself on cost rather than on time, so the ceiling is offered where it actually exists.

- `ak-review:execute` — **The adapter warns when Claude Code was denied a tool call.** Denials are
  recorded in `permission_denials` and the run continues, so a review that could not read what it
  needed still exits 0 with a confident-looking report — the same silent failure `opencode`'s
  auto-rejection produces, and it gets the same explicit warning.

### 📝 Documented

- `ak-review:execute` — Every place that enumerated the adapters or assumed there were two of them:
  the ceiling paragraph ("Both `opencode` and `codex`"), the salvage comparison ("the two implemented
  adapters sit at opposite extremes"), the model-format sentences in `setup` and the docs page, and
  the adapter list in `resolve-config.sh`'s no-config message — which is the first thing a new user
  ever sees.

## [1.25.0] - 2026-08-23

### ✨ Added

- `ak-review:setup` — **`--show`: see what is configured and what is on offer, without changing
  anything.** Until now the only way to find out which models a tool exposes was to start a setup that
  always ends in a write — the wrong instrument for a look, so people read the JSON by hand instead
  and lost the precedence rules in the process. `--show` reports the resolved configuration _and which
  layer each value came from_, the installed adapters (discovered from the filesystem, never a list
  kept in prose), and the available models for every adapter that can list them. It writes nothing,
  asks nothing, and closes with the two commands that turn a listed value into a one-off run or a
  permanent default.

- `ak-review:setup` — **Every value can now be passed as a flag**, so switching models is one line:
  `/ak-review:setup --global --tool codex --model gpt-5.6-sol --effort xhigh`. Anything not passed is
  still asked, which keeps the interactive walk exactly as it was for anyone who wants it — the flags
  are shortcuts, not a second mode. A flag means the choice is already made, so the question is noise;
  it does **not** mean the safety nets go. A `--tool` that names no installed adapter is rejected
  rather than written and left to fail later inside `/ak-review:execute`, the previous file contents
  are still shown before and after a flag-driven overwrite so the change stays reversible, and the
  write is still verified to resolve. Speed is worth removing questions for, not proof.

### ♻️ Changed

- `ak-review:setup` — The skill described itself as **"Always interactive"**, which `--show` and the
  value flags made false in the same commit that introduced them. Rewritten to "interactive by
  default", along with the two other sentences that assumed a write always happens: the note claiming
  it "writes exactly one file", and the closing tip that hand-editing the JSON is faster than
  re-running the skill — which stopped being true the moment a one-line invocation existed.

## [1.24.3] - 2026-08-22

### 🐛 Fixed

All six items below came from an external review of `1.24.2`, run through `/ak-review:execute`'s own
codex adapter and verified against the code before being applied.

- `ak-review:execute` — **`SKILL.md` still told the calling agent that a startup stall is "not
  something to retry automatically", which `1.24.2` had just made false.** The adapter had gained a
  retry loop while the instruction describing the old behaviour stayed put — precisely the defect
  `AGENTS.md` warns about. Phase 3 now explains that a transient failure is retried _inside_ the
  adapter, so a surfaced `125` already means every attempt stalled and retrying again would repeat a
  failed strategy.

- `ak-review:execute` — **A `125` from opencode itself was reported as the adapter's own "never
  started" signal.** `125` is reserved for the marker-confirmed startup stall; passing the tool's use
  of it straight through told the caller "every attempt stalled, nothing to salvage" about an ordinary
  tool failure. It is now remapped to `1` with an explicit note, and the tool's stderr still carries
  the real reason.

- `ak-review:execute` — **A run killed at the startup probe could lose output it had just produced.**
  The probe checks for an empty file and then signals the process; a tool that flushes while being
  signalled lands in that gap, and the next attempt's `>` truncated it. Worse, the run could end as
  `125` with a _non-empty_ file, contradicting exactly what that code promises. Retry now requires the
  marker **and** a still-empty stream, and a killed run that did produce output is reported as `124`
  so the partial stream is salvaged.

- `ak-review:execute` — **A non-numeric `AK_REVIEW_*` value aborted mid-run with no diagnostic.** It
  reached `sleep`, failed under `set -e`, and killed the adapter before any of its error reporting
  ran. All four variables are now validated up front, naming the offending one.

- `ak-review:execute` — **A startup grace at or above the ceiling let the two watchdogs race**, so a
  genuine timeout could be recorded as a startup stall and retried. The adapter now rejects that
  configuration outright, since the startup probe is only meaningful if it fires first.

- `ak-review:execute` — **`AK_REVIEW_TIMEOUT_SECS` no longer bounds the whole invocation** once
  retries are enabled, which was true since `1.24.2` but undocumented. Each attempt gets a fresh
  ceiling and the retry waits sit outside it, so the worst case is
  `retries × (startup_grace + retry_wait) + timeout` — roughly 25 minutes at the defaults. Documented,
  with `AK_REVIEW_STARTUP_RETRIES=0` as the way to make the ceiling absolute again.

### ✅ Tests

- `ak-review:execute` — Four cases covering the above: a tool-originated `125`, a deterministic
  failure that must not be retried (stated in `1.24.2`'s commit message but never pinned), output
  flushed from a `SIGTERM` trap, and a rejected non-numeric env value. Existing timeout cases now set
  a startup grace explicitly, since they had relied on a combination the adapter now refuses.

## [1.24.2] - 2026-08-22

### ✨ Added

- `ak-review:execute` — **The opencode adapter now retries a startup stall instead of only reporting
  it.** `1.24.1` made that failure legible; this makes it survivable. The stall is transient — it
  appears in windows of minutes and then clears — so a retry is the one response that actually
  recovers the run. Two further attempts by default (`AK_REVIEW_STARTUP_RETRIES`, `0` disables), 60s
  apart (`AK_REVIEW_RETRY_WAIT_SECS`), which rides out a short window without the caller noticing.
  **Only exit `125` is retried.** A `124` already holds the partial stream that makes it salvageable
  and a retry would overwrite it; any other non-zero exit (bad model, missing credentials) is
  deterministic and would fail identically after the wait. Exit `125` now means every attempt stalled,
  and the message says how many were made.

### 📝 Documented

- `ak-review:execute` — **The codex adapter requires a git repository as its working directory**, which
  was true from the start but written down nowhere. Codex refuses to run outside one ("Not inside a
  trusted directory and `--skip-git-repo-check` was not specified") and the adapter deliberately does
  not pass that flag: reviewing an untracked directory is nearly always a wrong `cwd`, and failing in
  a fraction of a second with a clear message beats reviewing the wrong thing. Only affects
  `--path`/`--all` runs aimed outside a repository; any git-diff-based scope implies one already.

## [1.24.1] - 2026-08-22

### 🐛 Fixed

- `ak-review:execute` — **The opencode adapter could fail with zero bytes, no error, and a message
  that sent the reader after output which could not exist.** `opencode run` intermittently produces
  nothing at all and never returns; the adapter reported that as its ordinary 20-minute timeout, so
  every layer above it said "timed out — run the salvage path" against an empty file. It now caps
  _startup_ separately (90s, `AK_REVIEW_STARTUP_GRACE_SECS`) and exits **`125`** instead of `124` when
  no bytes have arrived, stating plainly that the run never reached the model and there is nothing to
  salvage. A run that produces output and _then_ hangs is unchanged: still `124`, still salvageable.

- `ak-review:execute` — **The adapter discarded the only diagnostic that exists for that failure.** On
  a stall, opencode's stderr is empty, which reads as "nothing went wrong" when in fact nothing
  happened. The adapter now passes `--print-logs --log-level DEBUG`; the output lands in
  `<raw-output-file>.stderr` and the JSON stream stays untouched (verified on a live run: every stdout
  line still parsed, 26 log lines went to the sidecar).

### 📝 Documented

- `ak-review:execute` — **Where the opencode stall actually happens**, which was previously unknown and
  is now pinned by measurement. The evidence is opencode's _own_ log
  (`~/.local/share/opencode/log/opencode.log`), not the event stream: a healthy run logs `init` then
  immediately `created id=ses_…`; a stalled one logs `init` and stops forever. It therefore dies inside
  **session creation**, before the model is ever called — and `opencode serve` started during a stall
  failed with `database is locked`, pointing the same way. The root cause is upstream in opencode
  (seen on `1.18.21`) and is _not_ fixed here. Ruled out by measurement, each with a paired control:
  the database, config and plugins, stale processes, run cadence, and a concurrent instance holding
  the DB. The Adapter Reference also records the methodological trap — the failure comes in windows of
  minutes during which everything stalls, so an unpaired comparison produces a confident wrong answer.

## [1.24.0] - 2026-08-22

### ✨ Added

- `ak-review:execute` — **A `codex` adapter, so the skill is no longer a one-tool abstraction.** The
  adapter convention existed from the start but had only ever been exercised by `opencode`, which meant
  a handful of `opencode`-shaped assumptions had quietly hardened into the contract. Codex differs in
  every one of them: a bare model name instead of `provider/model`, reasoning effort as
  `-c model_reasoning_effort=…` instead of a flag (`--reasoning-effort` was removed in codex v0.50),
  and a completely different event schema. Verified against `codex-cli 0.149.0`, including a live
  end-to-end run.

- `ak-review:execute` — **The codex adapter runs with `--sandbox read-only`.** `delegate`'s contract has
  always been that the external agent only reports and never edits, but with `opencode` that was an
  instruction the prompt gave and the permission config had to be trusted to honour. Codex can enforce
  it structurally: the agent cannot write to the repository even if something told it to. The adapter
  also passes `--ignore-user-config`, because a real `~/.codex/config.toml` drags MCP servers, hooks and
  plugins into the run — measured on one, that meant failing auth handshakes and the review's own
  context being crowded out by _"skill descriptions were shortened to fit the skills context budget"_.

- `ak-review:execute` — **`codex-preflight.sh` checks authentication, which `opencode-preflight.sh`
  deliberately does not.** That is not an inconsistency. opencode's auth check was removed in 1.17.1
  because the only available signal was human-readable TUI output, and parsing it hard-blocked correctly
  authenticated users; the rule that came out of it was "no auth check without a machine-readable
  signal". `codex login status` supplies exactly that — exit `0` authenticated, exit `1` not — so the
  verdict comes from an exit code and never from parsed text.

### ♻️ Changed

- `ak-review:execute` — **The output extractors are now part of the adapter, and named for it.**
  `extract-report.sh`, `extract-cost.sh` and `extract-subagents.sh` read `opencode`'s event schema and
  nothing else, but their generic names and unqualified call sites in `SKILL.md` presented them as
  shared infrastructure. Pointing one tool's extractor at another tool's stream does not error — it
  returns an empty report, which is indistinguishable from a clean review. They are now
  `opencode-extract-*.sh`, joined by `codex-extract-*.sh`, and the adapter contract table lists them
  alongside the adapter and preflight scripts.

- `ak-review:execute` — **Cost reporting no longer assumes the tool reports cost.** Codex emits token
  counts and no monetary figure at all, so `codex-extract-cost.sh` returns `"total_cost": null` and
  Phase 8 now says the tool reports no cost instead of printing `$0.00`. Zero and "not reported" are
  different claims and only one of them is true.

- `ak-review:setup` — **The model and effort prompts no longer describe only `opencode`'s formats.**
  Phase 4 presented `provider/model` as _the_ shape a model identifier has, and Phase 6 named
  `--variant` as _the_ effort mechanism. Both are per-adapter: codex takes a bare model name and one of
  `none|minimal|low|medium|high|xhigh|max`. Codex has no non-interactive model listing, so it uses the
  existing typed-entry fallback rather than shipping a `codex-models.sh` that could not work.

### 🐛 Fixed

- `ak-review:execute` — **The adapter watchdog leaked a `sleep` process on every single run, and could
  wedge a piped caller for 20 minutes.** Tearing the watchdog down killed the subshell but not the
  `sleep` it was blocked in, which survived as an orphan still holding whatever stdout it inherited. A
  caller reading the adapter's output through a pipe therefore never saw EOF and hung until the orphan
  timed out. Found while building the codex adapter from this code, where it turned the new test suite
  from failing into hanging. The watchdog now runs in its own process group and is killed by group, with
  its descriptors pointed at `/dev/null` so no watchdog process holds the caller's stdout at all. Fixed
  in both `opencode-adapter.sh` and `codex-adapter.sh`.

## [1.23.1] - 2026-08-20

### 🐛 Fixed

- `ak-review` — The plugin's markdown-format hook pinned `MD049` (italic emphasis) to `asterisk`,
  fighting any project that runs Prettier on Markdown: Prettier emits `_italic_`, so the two tools
  rewrote each other's output on every pass whenever a file's existing style happened to start with
  an asterisk. `MD049` now pins to `underscore`, matching Prettier's default, so the hook's `--fix`
  and Prettier agree on direction instead of taking turns overwriting one another. Projects that
  don't use Prettier for Markdown are unaffected in intent but will see existing `*italic*` text
  rewritten to `_italic_` on the next hook run. Documented alongside the existing `"fix": false` and
  `.prettierignore` alternatives in [validation-hooks.md](docs/hooks/ak-review/validation-hooks.md),
  now with calibrating the rules to Prettier's output as the primary recommendation.

## [1.23.0] - 2026-08-19

### ♻️ Changed

- `ak-meta:handoff` — **The skill only ever fit one moment: being stuck.** It looked for "the current
  unresolved problem", explicitly discarded anything already resolved, and had nothing to say about a
  session that simply ended. That covers the rarest case and misses the ordinary one — a session that
  reached its goal, or stopped half-way, and whose successor needs to know what was settled just as much
  as what is open. The skill now captures a _session_, not a problem, and detects which of three states
  it is in: `Blocked` (a problem that resisted several attempts), `In Progress` (moving but unfinished),
  or `Complete` (goal reached). The state shifts the document's emphasis; `--blocked`, `--wip` and
  `--done` override the detection when it guesses wrong. Resolved work is now recorded rather than
  dropped.

- `ak-meta:handoff` — **The handoff had no way to say what should happen next.** It described where the
  work stopped and left the successor to infer the rest, which is exactly the part a human already knows
  and the next agent cannot guess. `$ARGUMENTS` is now the mission for the next session, passed through
  verbatim — `/ak-meta:handoff continue with ABC-123` puts that instruction at the top of the document,
  ahead of any next step the skill would have derived on its own.

### ✨ Added

- `ak-meta:handoff` — **Three sections that answer what a fresh session actually asks first.** _Current
  State_ records the Git side — branch, uncommitted changes, commits made this session — which is the
  most common blind spot on a session switch: what sits on disk versus what is committed. _Files
  Touched_ names each file with one sentence on why. _Decisions & Assumptions_ separates a deliberate
  choice from an unverified premise, so the next agent neither re-litigates a settled question nor
  trusts something that was never checked.

- `ak-meta:handoff` — **A fixed home for the document.** Handoffs are written to
  `docs/handoffs/YYYY-MM-DD-<slug>.md`, mirroring `ak-meta:discover`'s `docs/discover/`, and a name
  collision appends `-2` rather than overwriting. The safety rule is restated to match: code and Git are
  read only, and the handoff document is the single file the skill writes — the old wording ("NEVER
  modify code") would have read as forbidding the write it now performs.

## [1.22.3] - 2026-08-19

### 🐛 Fixed

- `ak-review:execute` — **The 20-minute ceiling on an external review run was never enforced anywhere it
  could hold.** It existed only as an instruction to the calling agent in the skill, which is exactly the
  guarantee that breaks in an unattended run: a harness may background the call and take the timer with it.
  A hung `opencode` then ran for 83 minutes before a human asked about it. The ceiling now lives in the
  `opencode` adapter itself, which kills the run at 20 minutes (override with `AK_REVIEW_TIMEOUT_SECS`) and
  exits `124`, GNU `timeout`'s convention, so a caller can branch on the code instead of parsing text. The
  adapter contract records this as an adapter's job rather than a caller's.

- `ak-review:execute` — **A timeout killed one process and left the rest running.** `opencode` is several
  processes, not one; signalling only the direct child left survivors that had to be cleared by hand with
  `pkill`. The adapter now runs the tool in its own process group and signals the whole tree. A killed run
  is still not a lost run — the JSON stream is written as the run goes, so the existing salvage path
  recovers every finished sub-agent's findings from what is already on disk. The second stalled run held
  31832 characters of sub-agent findings behind a 416-character report, which is why a short report must
  never be read as "nothing was found".

## [1.22.2] - 2026-08-19

### 🐛 Fixed

- `ak-review` markdown-format hook — **The config detection listed two file names that
  `markdownlint-cli2` does not read.** `.markdownlint-cli2.json` and `.markdownlint-cli2.yml` have no
  such form (only `.jsonc`, `.yaml`, `.cjs`, `.mjs` do), yet the hook accepted both as a project
  config and therefore dropped the plugin config. The linter then ignored the file too, so a project
  using either name silently lost both rule sets and fell back to bare markdownlint defaults. The
  same list was missing `.markdownlint.cjs` and `.markdownlint.mjs`, which are valid. Both halves are
  corrected and the list now carries a note to keep it in sync with what the tool actually reads.

### ✨ Added

- `ak-review` docs — **How to override the Markdown rules per project.** The hook has always deferred
  to a project's own markdownlint config, but nothing said so. The hook documentation now covers the
  resolution order, the valid config file names, and the fact that a project config _replaces_ the
  plugin config rather than merging with it — including why `extends` cannot be used to inherit the
  AgentKit defaults.

- `ak-review` docs — **Running Prettier alongside the hook.** Projects that format Markdown with
  Prettier could end up in a rewrite loop with the hook. The cause is a single rule: the plugin
  config pins `MD049` to `asterisk` while Prettier emits `_italic_`; markdownlint's own defaults are
  Prettier-compatible. The documentation now shows both resolutions — `"fix": false` to make the hook
  report-only, or `*.md` in `.prettierignore` to keep the hook as the formatter — and names `fix` as
  the switch that decides which tool writes.

## [1.22.1] - 2026-08-16

### 🐛 Fixed

All three findings come from the first real run of `--audit` against a project whose hand-written
dependency skill predates the generator.

- `ak-review:deps` — **The audit could only see changes, never standing gaps.** Every check compared
  the project against what the skill already recorded, so a package that was _never_ pinned looked
  identical on every run and stayed invisible. The real run showed this exactly: Biome and Playwright
  were pinned exactly in both installs while TypeScript carried a caret in both — a compiler, whose
  version decides the result rather than merely what installs, and precisely what the methodology
  says to pin. Detection now asks the question outright by crossing the result-determining tools
  against the exact-pin list, and the audit table carries it as a standing check rather than a
  change check. It is reported as a project finding; the skill never pins anything as a side effect
  of writing a document.

- `ak-review:deps` — **Nothing stopped the generator from writing claims that expire.** The audited
  skill named a ticket as "the current one" for major bumps; that ticket had since closed, and the
  document had no way to notice. The audit now checks the status of any ticket, issue or milestone a
  skill calls current, and — the deeper half — the generator is told not to write such a claim in the
  first place, because the next ticket makes any number stale again. State the rule; cite closed
  tickets only where they are introduced as past examples.

- `ak-review:deps` — **The language rule was left unstated**, the same gap `setup` closed in 1.21.0.
  `deps` both interviews a person and writes a file, so it needed the rule more than either skill
  that already had it: the interview and the audit report follow the invoking session's language,
  while the generated file follows the target project's own instruction files and defaults to
  English. A generated skill outlives the session that produced it.

## [1.22.0] - 2026-08-16

### ✨ Added

- `ak-review:deps` — New skill that **generates a project-specific dependency update skill** at
  `.claude/skills/dependency-update/SKILL.md`, mirroring the generator/executor split that
  `workflow` and `finalize` already use. It never updates a dependency itself; it produces the
  procedure that does.

  The reason it generates rather than generalizes: a generic dependency skill can say "take a
  baseline", but not _which_ baseline — and that is where the safety lives. A dependency bump can
  pass every behavioural test and still be wrong, because tests assert behaviour and a CSS
  framework bump that moves a border leaves a full E2E suite green. Only a project that knows it
  has a pixel comparison can be told to run it.

  Detection covers four axes the existing tooling scan did not: **install boundaries** (manifests
  with their own lockfiles are separate projects), **the baseline** including a deliberate hunt for
  a _second_ kind of baseline (visual regression, bundle-size budget, benchmark, structural
  snapshot, Lighthouse budget) together with what each one fails to cover, **exact pins** versus
  ranges, and **couplings** — the same version string duplicated across manifests, CI config,
  Dockerfiles and documentation.

  What detection cannot find, it asks: at most six questions, and only those whose trigger actually
  fired. Where the user does not know an answer, it is written into the generated skill as an open
  question with the command to settle it — never as an invented rule.

  `--audit` re-runs detection against an existing skill and separates **project drift** (a coupling
  the skill guards has actually come apart — a real bug) from **skill drift** (the document is
  stale). Only the second is edited automatically.

  Verified against a real project whose hand-written equivalent was the model for this skill: the
  detection reconstructs both separate installs, the visual baseline via the `*-snapshots/` signal,
  and all five locations of the pinned package-manager version — including a CI header comment and
  an AGENTS.md prose line, the two that a manifest-only analysis would miss.

- `ak-review` knowledge — Two new reference files. `dependency-update-methodology.md` holds the
  transferable rules (baseline as numbers not pass/fail, three-tier classification, verify-instead-
  of-assume commands per ecosystem, one logical step per commit, pin what determines the result,
  and the fold-back loop that lets a generated skill accumulate project findings).
  `project-tooling-detection.md` holds the manifest, config-file and lockfile signals.

### ♻️ Changed

- `ak-review:workflow` — Step 3's manifest and config-file detection tables moved into the new
  shared `project-tooling-detection.md` rather than being duplicated into `deps`. Both skills now
  detect identically and the tables have one place to be maintained. No behavioural change to
  generated workflows.

### 📝 Docs

- The root `README.md` header claimed 24 skills and its `ak-review` knowledge table listed only the
  two original files. Both corrected alongside the new skill — 29 skills, four knowledge files.

## [1.21.1] - 2026-08-16

### 📝 Documentation

- `AGENTS.md` — New convention: when you add a case to something, hunt down every sentence that still
  describes only the old one. Derived from this repo's own history rather than from principle: the
  pattern occurred five times while building the `setup` skill for 1.21.0 — a stale claim left in a
  contract table, in a doc page, in an adjacent paragraph, in a phase that consumed the changed
  output — every one caught by a review and none by the author, and the fifth created by the fix for
  the fourth. Adding the branch is the easy half.

## [1.21.0] - 2026-08-16

### ✨ Added

- `ak-review:setup` — New skill that configures `ak-review:execute` interactively. No configuration
  ships with the plugin, deliberately, so the first run always fails with a guidance message; this
  turns that dead end into a guided setup. It asks where the config should live (global, the file you
  copy to another machine, or project-local), which model to use — picked from the list the tool
  itself reports, never one this plugin suggests — and how aggressive auto-fixing should be. Then it
  writes the file, reads it back from disk, and proves it resolves, because a config written without
  proof is how a typo ships. It is a separate skill rather than a flag on `execute`, following the
  `workflow`/`finalize` precedent in this plugin: the generator is not the consumer.

  **`setup` is always interactive; `execute` still never is.** A missing config in `execute` fails
  fast rather than prompting — a prompt would hang a cron or remote run forever. Interactivity is
  opted into by invoking `setup`, never inferred from the session.

- **Adapter preflight**, wired into `execute`'s Phase 1, so a missing tool is caught before the prompt
  is built and any repository is read. It checks whether the tool is on PATH and **deliberately does
  not check authentication** — that check existed and was removed after three attempts. `opencode auth
  list` exits 0 in both states, so only its ANSI-decorated output distinguishes them, and three
  successive escape-stripping patterns were each defeated by a different escape class, every time by
  wrongly hard-blocking a _correctly authenticated_ user. Deriving a gate from human-readable TUI
  output is unbounded. An unauthenticated tool fails instantly and for free and says so itself, so the
  check bought a nicer message at the cost of the worst failure mode there is.

- **A three-script adapter convention** — `<tool>-adapter.sh`, `<tool>-preflight.sh`, `<tool>-models.sh`
  — documented in `execute`'s Adapter Reference. The filesystem is the registry: adding a tool needs no
  list updated anywhere. Preflight and models are optional, and the skills handle their absence.

- `extract-subagents.sh` — recovers findings from a run that hung. The external tool dispatches one
  sub-agent per review dimension and merges them only at the end, so a stalled run still holds
  everything the finished sub-agents produced — in `tool_use` parts the report extractor cannot see.
  Measured on a real stalled run of this very branch: the report extractor recovered 91 characters of
  narration while 4085 characters of findings sat unread. `execute`'s Phase 3 now has an explicit
  timeout branch that salvages instead of falling through.

### 🐛 Fixed

- `docs/README.md` had drifted since 1.18.0 — 9 plugins (10), 21 skills (28), 10 agents (13),
  `ak-meta` at 3 skills (4), and `ak-js` missing from the table entirely. Every number re-counted from
  the filesystem rather than copied from another document.

## [1.20.1] - 2026-08-16

### 🐛 Fixed

- `ak-review:execute` — The "no tool or model configured" message is now enough to act on. No
  config ships with the plugin, deliberately, so this message is what every new user meets first,
  and it previously said only which keys were missing. It now names both config paths and which
  one wins, shows a copy-pasteable skeleton, lists the adapters that exist (`opencode`) and says how
  to find models for one (`opencode models`) — but still names **no** model, because printing one
  would be the default this design exists to avoid.

## [1.20.0] - 2026-08-16

### ✨ Added

- `ak-review:execute` — New skill running the full **delegate → external agent → advise → fix**
  loop unattended, closing the manual hand-off that `delegate` and `advise` deliberately left open.
  It builds the review prompt with `delegate`'s logic, runs it against an external coding-agent CLI,
  verifies every finding against the real code with `advise`'s logic, auto-fixes the confirmed
  high-value ones using `coderabbit`'s Apply/Adapt/Skip framework, validates with the project's own
  tests, and reports one compact summary. `--report-only` reduces it to report-and-verify.

  **The external tool and model are never hardcoded.** They resolve from CLI flags, then a project
  `.claude/ak-review.local.json`, then a global `~/.claude/ak-review.local.json` — and the skill stops
  with guidance when unresolved rather than defaulting. Installing or updating this plugin therefore
  never forces a specific tool or model on anyone. `fix_threshold` defaults to `high` (matching
  `coderabbit`); `effort` has no default at all, being adapter-specific.

  Ships one adapter, `opencode`, as four small guarded shell scripts under `skills/execute/scripts/`.
  Two of its properties come from failures observed while building it, not from theory:
  `opencode run` **auto-rejects** permission-gated paths instead of prompting, reports it only on
  stderr, and still exits 0 — so a review that never read the repository would have produced a
  confident, uninformed report. The adapter now captures stderr beside the JSON stream and warns on
  `auto-rejecting`. And a run can hang after its sub-agents finish, so the report and cost extractors
  tolerate a truncated stream rather than dying on it, making the documented salvage path real.
  `--auto` is never passed: it would approve the destructive commands a user's own OpenCode config
  deliberately gates.

## [1.19.1] - 2026-08-13

### 🐛 Fixed

- `ak-review` markdown-format hook — `plugins/ak-review/hooks/config/.markdownlint-cli2.jsonc`
  had a top-level `"globs": ["**/*.md"]` field, which markdownlint-cli2 merges with (rather
  than overrides for) the single file path the hook passes on the command line. Every
  Write/Edit/MultiEdit on one Markdown file therefore triggered a `--fix` pass across every
  `.md` file in the repo, silently reformatting unrelated files (observed repeatedly reflipping
  `_underscore_` emphasis to `*asterisk*` in unrelated CHANGELOG.md sections while editing
  AGENTS.md). Removed the `globs` field so the hook's own file-path argument is authoritative;
  `ignores` alone does not reintroduce repo-wide scanning.

## [1.19.0] - 2026-08-13

### ✨ Added

- `ak-review:workflow` — Generate and Audit modes now produce a "pointer form" Task
  Completion Workflow: the full step list is written to
  `.claude/skills/task-completion/SKILL.md` (a lazy-loaded skill body, read only when
  invoked) instead of being inlined into AGENTS.md/CLAUDE.md, which is resent in full on
  every prompt regardless of whether the workflow is needed that turn. Audit mode still
  recognizes the old inline form, flags it as a Conciseness gap, checks drift between the
  pointer's step-name summary and the skill file, and offers to migrate it to pointer
  form. This repo's own `AGENTS.md` was migrated to pointer form as the reference example.
- `ak-review:finalize` — Resolves the pointer automatically (reading
  `.claude/skills/task-completion/SKILL.md`) before parsing and executing workflow steps,
  and now stops with an explicit error instead of silently executing zero steps when the
  pointer is broken or the section has no actionable content.
- `ak-knowledge:agents-md-improver` — The Task Completion Workflow check now accepts
  pointer form as passing and flags a still-inline workflow as a Conciseness finding,
  pointing at `/ak-review:workflow --audit` for the fix.

## [1.18.3] - 2026-08-12

### 🐛 Fixed

- `ak-review:coderabbit` — CodeRabbit CLI 0.7.0 removed the `--prompt-only`, `--type` and
  `--plain` flags (plain text is the default output now), so the skill's documented review
  command errored with `unknown option '--plain'`/`'--type'`. `--type uncommitted|committed|all`
  now maps to the CLI's own `--uncommitted`/`--committed`/no-flag scope. The same stale command
  was still referenced as the "Other tools" fallback in this repo's own `AGENTS.md`, fixed
  alongside it.

## [1.18.2] - 2026-07-16

### 🐛 Fixed

- `ak-react:react-best-practices` — The guide's dynamic-import examples used `ssr: false`
  in files without a `'use client'` directive. In "Defer Non-Critical Third-Party
  Libraries" the example marked **Correct** placed it next to a `RootLayout`, which is
  always a Server Component, so the recommended code threw at runtime
  (`ssr: false is not allowed with next/dynamic in Server Components`) while the
  **Incorrect** example above it worked — the guide advised trading working code for
  breaking code. The Correct example is now split into a `'use client'` module that the
  layout imports, keeping the layout a Server Component, and the section states outright
  that `ssr: false` throws in Server Components. The Monaco example in "Dynamic Imports
  for Heavy Components" gained the missing directive.
- `ak-js:config-doctor` — The analyzer listed a missing `autoprefixer` as a PostCSS
  finding without any version qualifier. Tailwind v4 prefixes via Lightning CSS inside
  `@tailwindcss/postcss` and needs no autoprefixer, so the check could produce wrong
  advice on v4 projects — which have no `tailwind.config.*` but do have a
  `postcss.config.*`. Both v4 markers were already in the analyzer's input, so the
  exception costs no extra scanning.
- `ak-react:react-best-practices` — Corrected the rule count: the skill claimed 65 rules
  and the guide abstract still said "40+"; both now say 66, matching the guide.

## [1.18.1] - 2026-07-08

### 🐛 Fixed

- `ak-review:explain` — Bare `/ak-review:explain` (no pasted snippet) failed with "no code
  was given" even when the user had text selected in a connected IDE (e.g. the VS Code
  extension), because the skill only checked `$ARGUMENTS` and never looked for the
  IDE-injected selection context. The skill now checks for an IDE selection first, falls
  back to typed/pasted input, and only asks the user to select or paste code when neither
  is present.

## [1.18.0] - 2026-07-03

### ✨ Added

- `ak-review:explain` — New skill that explains a code snippet to a developer: what it
  does, why it's built that way, and what's notable about it. Ported from the pt-ai
  `explain` skill. Explains the current editor selection, or whatever is passed as
  arguments (an optional introductory sentence before the snippet is ignored). Output
  follows a fixed structure — Purpose, How it works, and an optional Noteworthy section
  — capped at ~250 words, without improvement suggestions or assumptions beyond the
  visible code.

## [1.17.0] - 2026-06-06

### ✨ Added

- `ak-review:delegate` — New **Phase 2.5: Discover Requirements Context** automatically
  discovers and embeds requirements context in every generated review prompt — no flags
  needed. Three sources are checked in order:
  1. **Jira tickets** — searches branch name and commit messages for ticket IDs
     (pattern `[A-Z]{2,}-\d+`) and fetches details via Atlassian MCP (summary,
     type/status, description, acceptance criteria). Skipped if MCP is unavailable.
  2. **Spec / task Markdown files** — scans the working tree for files whose name or
     directory matches task/spec patterns (`TODO`, `TASK`, `SPEC`, `tasks/`, etc.)
     and any Markdown files modified in the current diff scope.
  3. **Fallback summary** — when neither source yields results, synthesizes a one-paragraph
     summary from commit messages so the review agent always has requirements context.

  Fetched content is always embedded directly in the generated prompt to keep it
  self-contained, regardless of whether the reviewing agent has its own Atlassian MCP
  access. The generated prompt uses composable sub-sections (Jira tickets, Specification
  documents, Summary) that are included or omitted based on what was discovered.

## [1.16.1] - 2026-06-06

### 🔄 Changed

- `ak-review:delegate` — Generated prompt now includes a dedicated **Approach** section
  (section 3) instructing the foreign agent to dispatch one sub-agent per review dimension
  (Security, Performance, Tests, …) and merge findings before producing the final report.
- `ak-review:advise` — Phase 2 now recommends dispatching one sub-agent per group of ≤8
  tightly related findings (for lists >5), replacing the previous "internal groups of ≈8"
  workaround. This avoids cross-issue context mixing and enables parallel validation.

## [1.16.0] - 2026-06-05

### ✨ Added

- `ak-knowledge:agents-md` — After creating a symlink (converted or consolidated), the skill
  now automatically inserts a notice `` > `CLAUDE.md` is a symlink pointing to this file. ``
  at the top of `AGENTS.md` (directly after the `# AGENTS.md` heading, skipped if already
  present).

### 🐛 Fixed

- `ak-review:workflow` + `AGENTS.md` — Review workflow bullet renamed from
  **"Optional delegated review"** to **"Delegated review"**: the "Optional" label caused
  agents to skip the entire bullet (including the mandatory user prompt) rather than just
  making the _execution_ optional. Asking the user is now framed as a required step.
- `ak-knowledge:agents-md-improver` — Added Common Issues item 8: checks that `AGENTS.md`
  carries the symlink notice when `CLAUDE.md` is a symlink pointing to it. Removed a
  redundant prose block in Phase 1 that duplicated the same rule already expressed in
  the checklist.

## [1.15.2] - 2026-06-04

### 🐛 Fixed

- `ak-knowledge:agents-md-improver` — workflow audit is now mandatory: agents must always
  invoke `/ak-review:workflow --audit` when a workflow section exists, rather than relying
  on manual command checks that miss template drift (e.g., new optional steps, changed
  bullet structure). Both the skill and its docs were updated to enforce this.

### 🔄 Changed

- `README.md` — Semgrep MCP Server link updated to point to the GitHub source repository.

## [1.15.1] - 2026-06-04

### 🔄 Changed

- `ak-review` workflow step extended: local `/ak-review:coderabbit` review is now the explicit
  default, with an optional delegated review prompt via `/ak-review:delegate` for external
  agents (Kimi, Codex, etc.). Applied to both `AGENTS.md` and the `ak-review:workflow` skill
  template so generated workflows include this pattern automatically.

## [1.15.0] - 2026-06-04

### ✨ Added

- `ak-review:delegate` — Generates a self-contained, project-specific code-review prompt for
  any foreign coding agent (Kimi, Codex, etc.). Analyzes the current project (instructions,
  languages, test/lint commands, docs) and the requested scope, then emits a ready-to-paste
  prompt. Scope flags mirror CodeRabbit semantics (`--type all|committed|uncommitted`,
  `--base <ref>`) plus `--path`/`--all`; report-only by default, `--fix` opts into direct
  fixing, `--out <path>` writes the prompt to a file. The prompt forces a Markdown + JSON
  findings report consumable by `ak-review:advise`.
- `ak-review:advise` — Validates a foreign agent's code-review findings against the real code
  and returns a per-finding verdict (`confirmed`, `false_positive`, `needs_more_context`,
  `uncertain`) with confidence and a fix hint. Read-only: never modifies code and never
  invents new findings. Accepts findings via `--in <path>` or pasted content. Together with
  `delegate` this forms a two-agent review loop (foreign agent reviews → Claude validates →
  foreign agent fixes).

## [1.14.0] - 2026-05-17

### ✨ Added

- `ak-git:operations` — Auto-detects the commit-prefix style already used on the current
  branch and continues it consistently. If any prior commit on the branch matches
  `^\[<ticket-id>\]` (e.g., `[FOO-1] feat: ...`), new commits use bracket style
  (`[ABC-1234] type(scope): description`); otherwise plain style is used
  (`ABC-1234 type(scope): description`). Style detection uses `git merge-base` against
  `origin/HEAD`, `origin/main`, or `origin/master` — with a graceful fallback to the
  last 10 commits when no common ancestor is resolvable.

### 🔄 Changed

- `ak-git:operations` — Branch-name pattern matching now explicitly covers bare
  ticket refs with a description suffix (e.g., `FOO-123_description`) in addition to
  the existing `fix/ABC-1234` and `feature/FOO-99_description` patterns.
- `docs/skills/ak-git/operations.md` — Updated overview and best-practices to document
  the new bracket-vs-plain style auto-detection behavior.

## [1.13.4] - 2026-05-10

### 🗑️ Removed

- `ak-review` validation hooks — removed the **Skill Suggestion prompt hook** (`PostToolUse`
  on `Write|Edit|MultiEdit`) that asked Claude after every file edit whether an AgentKit
  skill would be a helpful next step. The hook interrupted mid-workflow executions, causing
  Claude to stop continuation instead of proceeding. The three command-based validation
  hooks (Markdown, JSON, ShellCheck) are unaffected.

## [1.13.3] - 2026-05-02

### 🔄 Changed

- `ak-review:workflow` — Significantly expanded optional-step detection: the skill now
  scans for a `docs/` directory (activates a Docs step) and for `CHANGELOG.md` /
  multi-file `version` field patterns (activates a Version & Changelog step with
  "release commit MUST be final" note). Template updated with `/bump-version` and
  `/ak-meta:changelog` as preferred/fallback invocations. Adaptation rules extended with
  `{typecheck_cmd}`, `{project_specific_validations}`, and step-number skip-clause
  guidance. Audit-mode checklist updated to verify optional steps and correct skill
  references (`/simplify` instead of `code-simplifier:code-simplifier`).
- `ak-review:finalize` — Removed the duplicated inline workflow template; the skill now
  delegates directly to `/ak-review:workflow` when a new workflow needs to be created,
  keeping the single source of truth in one place.
- `ak-knowledge:agents-md-improver` — Added a dogfooding-check reminder: when auditing
  a project that ships workflow templates to others (e.g., AgentKit itself), verify that
  the project's own `AGENTS.md` workflow reflects its latest published template.
- `docs/solutions/best-practices/skill-shell-absolute-paths-2026-04-07.md` — Added
  Rule 7: always run a live `zsh` test in the target shell before marking a skill as
  released, to catch shell-portability regressions that unit-style reviews miss.

## [1.13.2] - 2026-04-07

### 🐛 Fixed

- `ak-js:config-doctor` Phase 0 Step 2 — **exit-code propagation**. The workspace-type
  detection block ended with a chain of `test -f` commands (`lerna.json`, `turbo.json`,
  `nx.json`). When the last-checked file did not exist, the whole Bash tool call
  returned a non-zero exit status and was reported as a failure — even though the
  detection correctly printed the detected workspace kind. Each test is now wrapped in
  `|| true` and the block ends with a `true` terminator. Added an "exit-code
  discipline" note describing the rule for all future bash blocks.
- `ak-js:config-doctor` Phase 0 Step 3 — **shell glob / brace expansion rejected by
  zsh**. Patterns like `tsconfig.*.json` and `next.config.{js,mjs,ts}` are aborted by
  zsh (the macOS default) with `no matches found` **before** the command runs, because
  the `nomatch` option is on by default — which means `2>/dev/null` cannot suppress
  the error. Replaced all glob/brace patterns in Phase 0 Step 3 with `find -name … -o
  -name …` chains, which are POSIX-portable and treat "no match" as an empty result.
  Explicit path lists (fixed filenames) remain safe and are kept as-is.
- `ak-js:config-doctor` Phase 0 Step 3 monorepo scan — added `vitest.config.{js,ts}`
  to the framework config scan (discovered during the same live test).
- `docs/solutions/best-practices/skill-shell-absolute-paths-2026-04-07.md` — extended
  to 6 rules with the two new shell-portability lessons (Rule 5: use `find`, not shell
  globs; Rule 6: end conditional-detection blocks with `true`).

## [1.13.1] - 2026-04-07

### 🐛 Fixed

- `ak-js:config-doctor` Phase 0 Step 3 — **shell `cd` stacking bug** that produced broken
  paths like `packages/web/packages/web` on real-world monorepos. The inventory scanner
  now captures `PROJECT_ROOT` once and always uses absolute paths; monorepo package scans
  run inside subshells so `cd` state never leaks between packages.
- `ak-js:config-doctor` Phase 1a Parse Check — **JSONC false-positives** on
  `tsconfig.json`, `tsconfig.*.json`, `biome.jsonc`, and `*.jsonc` files. TypeScript
  officially allows `//` and `/* */` comments in tsconfig files, and several configs use
  the `.jsonc` extension by convention. Added a string-aware JSONC stripper that removes
  comments and trailing commas while preserving comment-like substrings inside string
  literals, and documented the list of JSONC-by-convention file patterns.
- `ak-js:config-doctor` inventory scanner now picks up `tsconfig.*.json` variants
  (`tsconfig.base.json`, `tsconfig.app.json`, etc.) via an explicit glob.

## [1.13.0] - 2026-04-07

### ✨ Added

- New plugin `ak-js` — JavaScript project configuration doctor
  - New skill `/ak-js:config-doctor` — zero-config audit of JS/Node project configuration files
    with a 0-100 scored report, A-F grade, and severity-grouped findings (Critical / High /
    Medium / Suggestion)
  - New agent `framework-config-analyzer` — Phase-2 worker for JS/TS framework config
    analysis (Next.js, Vite, Astro, Nuxt, SvelteKit, Tailwind, ESLint Flat Config, PostCSS)
  - 10 bundled JSON Schemas from SchemaStore / canonical upstreams (package.json,
    tsconfig.json, biome.json, vercel.json, turbo.json, nx.json, prettierrc, web-manifest,
    eslintrc, pnpm-workspace) with SchemaStore fallback for extended coverage
  - `.npmrc` INI-format validator with 145-entry npm config keys whitelist and plaintext
    credential detection (flags `_authToken`, `_password`, etc. as Critical)
  - 11 custom cross-file rules catching mismatches no single-file tool sees: missing script
    deps, incompatible `engines.node` vs `tsconfig.target`, `packageManager` lockfile drift,
    publishable-field checks, `type: module` consistency, workspace glob validity, multiple
    lockfile detection, and workspace dependency version drift for singleton libs
    (react/react-dom/vue/svelte/solid-js/rxjs/zustand)
  - Monorepo-aware from day 1 — auto-detects npm/pnpm/yarn/bun/lerna/turbo/nx workspaces
    and reports per-package + workspace-wide findings
  - Read-only by design — never modifies files; fixes are applied by Claude in the
    surrounding conversation
- Marketplace now lists 10 plugins (was 9); top-level description updated to reflect the
  new JavaScript plugin

## [1.12.0] - 2026-04-07

### 🔄 Changed

- Extended `agents-md-improver` skill (ak-knowledge) with Task Completion Workflow check
  - Phase 2: audits existing workflow sections for stale commands, removed skills, renamed tools, and redundant steps
  - Phase 4: delegates missing or stale workflow generation/audit to `/ak-review:workflow` (or `--audit` mode) instead
    of duplicating detection logic
  - Common Issues: new entry #8 for missing or outdated task completion workflow
- Overhauled Task completion workflow in `AGENTS.md` with explicit Validate, Re-validate, and Version & Changelog steps
  - Step 1 Validate: documents JSON/shellcheck/markdown validation explicitly
  - Step 2 Simplify: prefers `/simplify` skill over `refactoring-expert` agent fallback
  - Step 3 Review: adds critical CodeRabbit evaluation reminder
  - Step 6 Version & Changelog: delegates to `/bump-version` (full automation: 11 files + changelog + commit + tag) with
    `/ak-meta:changelog` as manual fallback

## [1.11.0] - 2026-04-05

### ✨ Added

- New skill `quality` in ak-meta for assessing plugin component quality across 8 weighted dimensions
  - Two-layer assessment: instant structural review (Layer 1) + expert agent scoring (Layer 2)
  - `--quick` mode for fast structural feedback during development
  - `--compare` mode for side-by-side component comparison with delta analysis
  - Tier ratings: Platinum (90+), Gold (80+), Silver (70+), Bronze (60+)
  - Detects 7 quality issues (RIGID_LANGUAGE, WEAK_DESCRIPTION, MISSING_ACTIVATION, etc.)
- New agent `quality-assessor` in ak-meta for expert scoring on 4 dimensions with anchored rubrics
- New agent `diagram-creator` in ak-meta for Mermaid diagram generation (flowcharts, sequences, ERDs, state diagrams,
  C4, and more)
- New knowledge file `hypothesis-debugging.md` in ak-improve with structured root cause analysis framework (6 failure
  mode categories, evidence standards, arbitration protocol)
- New knowledge file `review-dimensions.md` in ak-review with 5 structured review dimensions (Security, Performance,
  Architecture, Testing, Accessibility) and 58 checklist items
- New knowledge file `wcag-audit-patterns.md` in ak-review with comprehensive WCAG 2.2 coverage across all 4 POUR
  principles (60+ criteria, remediation patterns, automated testing)

## [1.10.1] - 2026-04-04

### 🔄 Changed

- Renamed `document` skill to `log` in ak-knowledge for clearer intent (`/ak-knowledge:log`)
- Removed `--compact` mode from `log` skill (ak-knowledge) — single execution mode only
- Removed all arguments from `handoff` skill (ak-meta) — simplified to zero-config usage
- Updated all cross-references, documentation, and agent paths for the skill rename

## [1.10.0] - 2026-04-04

### ✨ Added

- New skill `workflow` in ak-review for generating and auditing Task Completion Workflows
  - Default mode: scans project tooling and generates a tailored 6-step workflow for AGENTS.md
  - Audit mode (`--audit`): verifies existing workflow against current project state
  - Detects build tools, test runners, linters, formatters, type checkers, and review tools
  - Falls back to self-review when CodeRabbit CLI is not available

## [1.9.1] - 2026-04-04

### 🔄 Changed

- Rewrote `discover` skill (ak-meta) with fresh terminology and unique phrasing
- Rephrased `performance-optimizer` and `refactoring-expert` agents (ak-improve) with distinct wording
- Simplified root README and expanded AGENTS.md conventions
- Updated ak-git:operations skill documentation for `--` prefixed arguments
- Added hyperlinks to skills, agents, and hooks in README plugin tables
- Aligned discover skill documentation with new terminology

## [1.9.0] - 2026-04-03

### Added

- New plugin `ak-security` with 3 skills (code-security, llm-security, semgrep) and 43 knowledge files covering OWASP
  Top 10, LLM security, and Semgrep static analysis
- New plugin `ak-react` with 2 skills (react-best-practices, react-doctor) and Vercel Engineering performance guide
- New skill `discover` in ak-meta for divergent idea generation with adversarial filtering
- New skill `agents-md-improver` in ak-knowledge for auditing and improving AGENTS.md files
- New operation `pr` / `ship` in ak-git:operations for commit-push-PR in one step with adaptive PR descriptions
- Git provider auto-detection (GitHub `gh` / GitLab `glab`) in PR creation workflow
- Commit classification (feature vs fix-up) for cleaner PR descriptions

### Changed

- ak-git:operations now supports 5 operations: commit, review, resolve, pr, ship
- ak-meta now has 3 skills (added discover alongside changelog and handoff)
- ak-knowledge now has 4 skills (added agents-md-improver)
- Marketplace expanded from 7 to 9 plugins
- bump-version command updated from 7 to 11 files

## [1.8.0] - 2026-04-03

### Changed

- **BREAKING**: Dissolved `ak-core` plugin — components redistributed to focused plugins
- `ak-review` now includes `finalize` skill and file validation hooks (from ak-core)
- `ak-knowledge` now includes `agents-md` skill (from ak-core)
- Consolidated `validate-all` into `finalize` workflow

### Added

- New plugin `ak-improve` with refactoring-expert and performance-optimizer agents
- New plugin `ak-notifications` with macOS sound and banner notification hooks

### Removed

- Plugin `ak-core` (replaced by ak-review, ak-improve, ak-notifications)
- Standalone `validate-all` skill (consolidated into finalize)

### Migration

Users with ak-core installed should:

1. Uninstall ak-core
2. Install ak-review, ak-improve, ak-notifications

## [1.7.0] - 2026-03-03

### Added

- ✨ ak-git: Automatic ticket detection from branch names — extracts issue IDs (e.g., `ABC-1234`) and prefixes commit
  messages automatically

## [1.6.0] - 2026-02-27

### Added

- ✨ ak-git: `--force-push` flag for operations skill — uses `git push --force-with-lease` for safe force pushes

### Changed

- 🔄 ak-meta: Changelog skill now commits by default — replaced `--commit` with `--no-commit` opt-out, removed `--fast`
  and `--update-version` flags
- 📝 README: Added Superpowers Extended to recommended plugins

## [1.5.0] - 2026-02-24

### Added

- ✨ ak-core: agents-md skill now consolidates both CLAUDE.md and AGENTS.md when both exist — identifies the more
  comprehensive file as base and merges unique sections from the other

## [1.4.0] - 2026-02-22

### Added

- ✨ README: New "Recommended Plugins" section with Chrome DevTools MCP as first companion plugin

### Fixed

- 🐛 README: Corrected ak-core skill count from 1 to 3 (finalize, validate-all, agents-md)
- 🐛 README: Added language specifiers to fenced code blocks (MD040)
- 🐛 markdownlint: Disabled MD060 table column style rule — incompatible with standard Markdown table formatting

## [1.3.0] - 2026-02-22

### Added

- ✨ ak-core: Finalize skill now offers to create a task completion workflow when none exists — detects project tooling
  and generates project-specific steps

## [1.2.1] - 2026-02-22

### Fixed

- 🐛 ak-core: Removed `Read` from prompt hook matcher — prevents false security blocks when reading .env files

## [1.2.0] - 2026-02-22

### Added

- ✨ ak-core: New `/ak-core:agents-md` skill — converts CLAUDE.md files to AGENTS.md with backward-compatible symlinks
- ✨ Bump-version command now creates git tags after committing

### Changed

- 🔄 Skill count updated from 11 to 12 across the marketplace

## [1.1.3] - 2026-02-22

### Fixed

- 🐛 ak-core: Removed unreliable Stop hook that caused intermittent "JSON validation failed" errors

### Added

- ✨ Project-local `/bump-version` command for synchronized version management across all 7 files

## [1.1.1] - 2026-02-21

### Fixed

- 🐛 ak-core: Changed notification sound to Glass and lowered volume to 50%
- 🐛 ak-core: Strengthened Stop hook JSON response instruction for reliability

### Changed

- 🔄 ak-core: Simplified new hooks and validate-all skill after review

## [1.1.0] - 2026-02-21

### Added

- ✨ JSON syntax validation hook — blocks saving broken JSON files (PostToolUse)
- ✨ ShellCheck validation hook — lints shell scripts on save (PostToolUse)
- ✨ Notification hooks — sound on permission prompt, macOS notification on idle
- ✨ validate-all skill — bundles markdown, JSON, and shell script validation in one command
- ✨ GitHub MCP server recommended as user-global integration

### Changed

- 🔄 ak-core now provides 2 skills (finalize, validate-all) and 3 file validation hooks
- 🔄 Skill count updated from 10 to 11 across the marketplace

## [1.0.1] - 2026-02-21

### Fixed

- 🐛 README.md: Corrected plugin installation instructions (use `/plugin` commands, not CLI)
- 🐛 Stop hook: Fixed JSON validation error by adding required `{"ok": true/false}` response format for prompt-type hooks

## [1.0.0] - 2026-02-21

Initial release as AgentKit — a lean, audited plugin marketplace for Claude Code.

### Added

- ✨ 5 plugins: ak-core, ak-git, ak-meta, ak-review, ak-typo3
- ✨ 10 skills across all plugins
- ✨ 9 specialized agents with active Edit/Write capabilities
- ✨ Markdown formatting hook (markdownlint-cli2)
- ✨ Context-aware skill suggestion hook
- ✨ Quality gate hook for task completeness

### Changed

- 🔄 Rebranded from Claude Code Toolkit to AgentKit
- 🔄 All agents upgraded from read-only to active (Edit/Write tools enabled)
- 🔄 Finalize skill streamlined (removed unused flags and phases)
- 🔄 Skill suggestion prompt generalized (no longer hardcoded skill names)
- 🔄 CKEditor knowledge files referenced in sitepackage skill

### Removed

- 🗑️ ak-security plugin (secure skill, debugging/security agents, Semgrep MCP)
- 🗑️ ak-frontend plugin (frontend/tailwind agents, Alpine.js/Tailwind knowledge)
- 🗑️ ak-core: 4 skills (understand, improve, create, ship)
- 🗑️ ak-core: 10 agents (code-architect, project-planner, documentation-specialist, and others)
- 🗑️ ak-meta: mcp skill and manage-mcp.sh script
- 🗑️ ak-typo3: project-setup-context.md knowledge file
