---
name: execute
description: This skill should be used when the user asks to "run a review end-to-end", "delegate and fix automatically", "automated external review with fixes", "run this through OpenCode/GLM/Codex and fix it", or wants the full delegate → external agent → advise → fix loop run unattended, without manual copy-paste between agents.
---

# Execute External Review

Run the full external code-review loop unattended: build the `/ak-review:delegate` prompt, execute it
against a configured external coding-agent CLI, verify the findings with `/ak-review:advise`, auto-fix
the confirmed high-value ones, validate, and report one compact summary. No user checkpoints during
the run — `/ak-review:delegate` and `/ak-review:advise` remain the manual, supervised path for anyone
who wants one; this skill is the unattended path.

**Never forces a specific external tool or model.** Installing/updating `ak-review` must not change
what tool or model someone else's project uses — see Configuration.

## Arguments

Parse `$ARGUMENTS`:

| Flag | Effect |
|------|--------|
| `--type all\|committed\|uncommitted` | Same as `/ak-review:delegate`. Default `all` |
| `--base <ref>` | Base ref for diffs (auto-detected if omitted) |
| `--path <glob/dir/file …>` | Review specific paths instead of a git diff |
| `--all` | Review the entire project |
| `--tool <name>` | External tool adapter to use (overrides config) |
| `--model <model>` | Model passed to the adapter, in _that adapter's_ format (overrides config) |
| `--effort <level>` | Reasoning-effort/variant passed to the adapter, in _that adapter's_ vocabulary (overrides config) |
| `--fix-threshold critical\|high\|medium\|low` | Minimum severity to auto-fix (overrides config; default `high`) |
| `--report-only` | Skip Phase 6–7 (fixing + validation); only report and verify |

**Scope precedence:** same as `delegate` — `--path`/`--all` override `--type`.

## Workflow

### Phase 1: Resolve Configuration and Check the Adapter

Run this, and every other script in this workflow, with the reviewed repository as the working directory
— `resolve-config.sh` reads the project config layer from the cwd-relative `.claude/ak-review.local.json`,
so a wrong cwd silently drops that layer and falls back to global with no error (the same requirement the
Adapter Reference states for the external tool itself).

Run (only pass flags the user actually supplied):

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/resolve-config.sh \
  [--tool <val>] [--model <val>] [--effort <val>] [--fix-threshold <val>]
```

The script reads `.claude/ak-review.local.json` and `~/.claude/ak-review.local.json` itself. If it exits
non-zero, print its stderr message verbatim and **stop** — do not guess a tool or model. On success it
prints resolved JSON: `{"tool":..., "model":..., "effort":..., "fix_threshold":...}`.

Then confirm the resolved adapter can actually run, before any work is done.

**Check whether the adapter has a preflight script:**

```bash
[ -f "${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-preflight.sh" ]
```

**If the script does not exist:** skip the rest of this Phase and continue to Phase 2.

**If the script exists:** run it:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-preflight.sh
```

Exit 0 means ready — or not provably unready; the adapter either dropped an unreliable check or
noted the gap on stderr, so stderr may or may not carry anything. If exit is 0 and stderr is
non-empty, print it as a warning and continue to Phase 2 — the adapter is flagging a gap it could
not check, not blocking the run. A non-zero exit means it cannot run: print the script's stderr
verbatim and **stop**. Do not attempt to install, authenticate or repair anything, and do not
proceed hoping it will work.

This phase runs before Phase 2 on purpose: building the prompt reads the repository and may fetch
tickets, which is wasted if the tool is not there.

### Phase 2: Build the Prompt

Follow `/ak-review:delegate`'s Phase 1–3 exactly: resolve scope (this skill's `--type`/`--base`/`--path`/
`--all`, same semantics), capture project context, discover requirements context, assemble the prompt.
The generated prompt is always report-only (delegate template §7) — the external agent never edits code.
Write the assembled prompt to a scratch file at `/tmp/ak-review-execute/<timestamp>/prompt.md`. Use that
same `<timestamp>` directory for every other artifact this run produces — `$RAW_OUTPUT_FILE`
(`raw-output.jsonl`), `$REPORT_FILE` (`report.md`), `$COST_FILE` (`cost.json`) in Phase 3/4, and
`$SUBAGENTS_FILE` (`subagents.md`, written only if Phase 3's timeout branch runs) — so the whole run's
evidence lives in one place. If the resolved scope is empty, `delegate`'s own "say so and stop" behavior
applies here too.

### Phase 3: Execute

Look up the resolved `tool` in the Adapter Reference below and run its adapter:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-adapter.sh \
  "$PROMPT_FILE" "$MODEL" "$EFFORT" "$RAW_OUTPUT_FILE"
```

(Omit the `$EFFORT` argument entirely, not as an empty string, when Phase 1 resolved it to `null`.)

If `tool` matches no known adapter, stop and report which tools are implemented. This is long-running
and produces no intermediate output; do not attempt to babysit it.

**Where the ceiling is enforced:** an adapter is expected to enforce its own timeout and to exit `124`
(GNU `timeout`'s convention) when it fires, because a ceiling the _caller_ has to hold is the one that
breaks in an unattended run — a harness may background the call and take the timer with it. All three
implemented adapters do this (20 min, override with `AK_REVIEW_TIMEOUT_SECS`). Still pass a generous
timeout of your own as a backstop for an adapter that does not, but treat exit `124` as the definitive
timeout signal.

**If the adapter exits `125`, the run never started — stop, and do not salvage.** This is a distinct
failure from a timeout: the tool produced no bytes at all, so there is no partial stream and nothing
to recover. Report the adapter's stderr verbatim and stop; do not run the extractors, and do not
describe the result as "the review found nothing", because no review took place.

**Do not retry a `125` yourself.** An adapter whose failure is transient retries internally and only
surfaces `125` once _every_ attempt has stalled — `opencode` does exactly this, and its message states
how many were made. Reaching this point therefore already means retrying did not help, so trying again
in the same run would just repeat a failed strategy. Whether to come back later is the user's call.

**If the run times out** (exit `124`, or your own backstop fires): kill the process if it is still
up — `$RAW_OUTPUT_FILE` is written incrementally by the OS as the run goes, so it survives the kill.
Do **not** fall through to the normal Phase 4 path below; go to the salvage path instead. Run every
extractor the resolved adapter provides, `$SUBAGENTS_FILE` first where one exists:

```bash
# only if the adapter has one — opencode and claude do, codex does not
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-extract-subagents.sh "$RAW_OUTPUT_FILE" > "$SUBAGENTS_FILE"
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-extract-report.sh "$RAW_OUTPUT_FILE" > "$REPORT_FILE"
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-extract-cost.sh "$RAW_OUTPUT_FILE" > "$COST_FILE"
```

**How much a timeout salvages depends entirely on the tool, and the implemented adapters sit at
opposite extremes.** Check the Adapter Reference before concluding anything from a short salvaged
report:

- `opencode` dispatches one sub-agent per review dimension and merges them only at the end, so a run
  killed before that still holds every finished sub-agent's output — in `tool_use` parts that
  `opencode-extract-report.sh` cannot see. Running `opencode-extract-subagents.sh` first is what
  recovers them; the `opencode` entry below measures how much the report alone misses.
- `claude` behaves like `opencode` here: it dispatches sub-agents via its Task tool and merges late, so
  `claude-extract-subagents.sh` recovers whatever the finished ones produced. The adapter passes
  `--forward-subagent-text` precisely so that output reaches the stream at all.
- `codex` has no sub-agents and emits its answer as a single `agent_message` at the very end. A killed
  codex run usually has **nothing** to recover, and `codex-extract-report.sh` exits non-zero to say so
  rather than printing an empty report. That is an honest signal, not a failure to parse.

Then continue to Phase 5 with whatever files exist — see Phase 5 for how `$SUBAGENTS_FILE` and
`$REPORT_FILE` differ.

### Phase 4: Parse the Report

Normal path — the run completed within the timeout, so there is no `$SUBAGENTS_FILE`:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-extract-report.sh "$RAW_OUTPUT_FILE" > "$REPORT_FILE"
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-extract-cost.sh "$RAW_OUTPUT_FILE" > "$COST_FILE"
```

The extractors are **per-adapter**, not shared: each external tool emits its own event schema, and a
mismatched extractor silently yields an empty report rather than an error. Use the ones named after
the resolved `tool`.

Read only `$REPORT_FILE` and `$COST_FILE` — never read `$RAW_OUTPUT_FILE` directly, it carries the
adapter's full internal event trace and is far larger than what's needed. From `$REPORT_FILE`, take the
trailing ` ```json ` findings block (delegate's schema: `findings[]` with `id, title, severity, category,
file, start_line, end_line, claim, evidence, suggested_fix`).

### Phase 5: Verify

Follow `/ak-review:advise`'s Phase 2 exactly against the parsed `findings[]`: read the cited file/lines
for each finding, check the claim against the real code, assign a verdict (`confirmed | false_positive |
needs_more_context | uncertain`).

**If Phase 3 took the salvage path**, also read `$SUBAGENTS_FILE` — but not the same way. It is the
recovered sub-agents' **prose**, not the delegate `findings[]` schema: no `id`, `severity`, `category`
or line range to carry through. Read each block as an individual claim and verify it directly against
the cited code the way a human reviewer would, rather than trying to parse it. Because it carries no
`severity`, nothing in it can be matched against Phase 6's `fix_threshold` automatically — treat every
salvaged claim as needing a manual judgment call before any fix is applied.

### Phase 6: Fix (skip if `--report-only`)

For findings with verdict `confirmed` **and** `severity` at or above the resolved `fix_threshold`
(order: `critical > high > medium > low`), apply `/ak-review:coderabbit`'s Phase 4 decision framework
(Apply / Adapt / Skip). Everything else — other verdicts, or `confirmed` below the threshold — is left
untouched and recorded for the summary with its reason.

A claim recovered via Phase 3's salvage path carries no `severity`, so `fix_threshold` cannot gate it —
Phase 5's manual verification stands in for that gate instead. A salvaged claim Phase 5 judged genuine
gets the same Apply/Adapt/Skip framework as a normal confirmed finding; one it could not verify, or
judged not genuine, is left untouched and recorded like everything else.

### Phase 7: Validate (skip if `--report-only`)

Run the project's own test and lint commands (already captured by `delegate`'s Phase 2 project-context
step) after fixing. Record pass/fail; do not revert fixes automatically on failure — report it and let
the user decide, since reverting a fix that exposed a real pre-existing failure would hide information.

### Phase 8: Summarize

Produce one compact report, in the language of the invoking session:

- Findings by verdict and severity (counts) for `findings[]`; a separate count of salvaged claims, if
  Phase 3 took that path, noting they carry no severity
- What was fixed, one line each with the reason it qualified
- What was skipped, one line each with the reason (false positive / below threshold / needs context / uncertain)
- Validation result (tests/lint pass?), only if Phase 7 ran
- Cost and tokens from `$COST_FILE`. **Report only what the file actually contains.** `total_cost` is
  `null` for an adapter whose tool does not report money — `codex` is one — and in that case say the
  tool reports no cost, rather than printing `$0.00`. Zero and "not reported" are different claims,
  and only one of them is true
- The path to `$RAW_OUTPUT_FILE` — it is kept on disk after the run (see Notes) and this is the only place
  that path is surfaced to the user; without it, re-running `/ak-review:advise` against the kept output
  means hunting for a `/tmp/ak-review-execute/<timestamp>/` directory rather than reading it off the report

No raw JSON dump in the final message — this is the human-facing digest.

## Adapter Reference

No adapter plugin/registry system — this table is the whole abstraction, and the filesystem is the
registry: an adapter is the set of scripts named after its tool under `scripts/`.

| Script | Contract | Required? |
|--------|----------|-----------|
| `<tool>-adapter.sh <prompt-file> <model> [effort] <raw-output-file>` | Runs the review, writing the tool's raw output to the given file. Exits with the tool's own exit code, except for two reserved codes: `124` when its own ceiling fires (process group killed, partial stream salvageable) and `125` when the tool produced **no bytes at all** and never started (nothing to salvage). **Enforcing both is the adapter's job, not the caller's:** an unattended caller may lose the timer, and the two failures need opposite advice. | Yes |
| `<tool>-preflight.sh` | Exit 0 = ready, _or not provably unready_. Non-zero = cannot run, with the reason and the concrete fix on stderr. **An adapter must not block on a check it cannot make reliably — it either drops the check or notes the gap on stderr.** See the `opencode` entry for why this matters. | Optional; skipped if absent |
| `<tool>-extract-report.sh <raw-output-file>` | Prints the agent's report to stdout. Exits non-zero when the stream carries no report at all — that is an honest signal, not a parse failure, and must not be smoothed into an empty report. | Yes |
| `<tool>-extract-cost.sh <raw-output-file>` | Prints `{"total_cost":…,"total_tokens":…}`. `total_cost` is `null` when the tool reports no money — never `0`, which would falsely claim the run was free. Extra keys are fine. Must degrade to zeros on a truncated stream rather than failing, so a salvaged report is not lost with it. | Yes |
| `<tool>-extract-subagents.sh <raw-output-file>` | Recovers finished sub-agent output from a killed run. Only meaningful for tools that dispatch sub-agents and merge late. | Optional; omit when the tool has no such concept |
| `<tool>-models.sh` | Prints one candidate per line, to stdout; the format is the tool's own and is not guaranteed. Used by `/ak-review:setup`. | Optional; setup asks the user to type a model if absent |

**The extractors are part of the adapter, not shared infrastructure.** Each tool emits its own event
schema, and pointing one tool's extractor at another's stream produces an empty report rather than an
error — a silent failure that looks exactly like a clean review. They were unprefixed while `opencode`
was the only adapter; the names now carry the tool.

Adding a tool means adding those scripts plus a subsection here, following the shape of the entries
below.

### `opencode`

- Script: `${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/opencode-adapter.sh <prompt-file> <model> [effort] <raw-output-file>`
- `model` — an OpenCode `provider/model` string, e.g. `opencode-go/glm-5.3`
- `effort` — passed as OpenCode's `--variant` (e.g. `high`); omit to use OpenCode's own default
- **Prerequisite:** a working OpenCode permission config (`opencode.jsonc`, project- or user-level) that
  allows non-interactive bash execution for read-only/test/lint commands, with destructive commands
  (`rm -rf`, `git reset --hard`, `git push --force`, …) gated to `"ask"`. This skill never passes
  `--auto` — that would silently approve those too. If a run stalls, fix the permission config; do not
  reach for `--auto`.
- **Preflight:** `opencode-preflight.sh` checks one thing — whether `opencode` is on PATH — and hard-fails if it
  is not. It deliberately does **not** check authentication. That check existed and was removed: it had to parse
  `opencode auth list`'s human-readable output (the exit code is 0 either way), and three successive
  escape-stripping patterns were each defeated by a different ANSI class, every time by wrongly hard-blocking a
  _correctly authenticated_ user. An unauthenticated opencode fails instantly, for free, and says so itself, so
  the check bought a marginally nicer message at the cost of the worst failure mode there is. Do not add it back
  without a machine-readable signal (a documented exit code or a `--json` mode). The script's own comment header
  carries the full account.
- **Models:** `opencode-models.sh` wraps `opencode models`, and fails loudly when `opencode models` itself errors.
- **Run the adapter with the reviewed repository as the working directory.** OpenCode gates paths outside
  the cwd behind its `external_directory` permission, and in non-interactive `run` mode a gated path is
  **auto-rejected, not prompted** — the review then proceeds without ever reading the files, exits 0, and
  produces a confident-looking report based on nothing.
- Those rejections are reported on **stderr**, never in the JSON stream, so the adapter captures stderr to
  `<raw-output-file>.stderr` and, once the run ends, forwards it and prints a warning when it finds
  `auto-rejecting` there. **Check that warning before trusting a report** — a silently uninformed review is
  this adapter's most dangerous failure mode.
- Output is a newline-delimited JSON event stream, always redirected straight to a file — see Phase 3/4.
- **A run can also stall at startup and produce nothing at all — exit `125`, not `124`.** Distinct from
  the hang below, and far more confusing, because it yields zero bytes and no error. Measured
  repeatedly on opencode `1.18.21`. What localises it is opencode's **own log**
  (`~/.local/share/opencode/log/opencode.log`), not the event stream: a healthy run logs `init` and
  then immediately `created id=ses_…`, `loop`, `stream`; a stalled run logs `init` and stops forever.
  So it dies inside **session creation** — before the model is ever called. (`opencode serve` started
  during one stall failed outright with `database is locked`, pointing the same way.)
  The root cause is upstream and remains unidentified; these were ruled out **by measurement**, each
  with a paired control run: the database (moved aside — still stalled), config and plugins (empty
  `XDG_CONFIG_HOME` — still stalled once re-tested), stale processes (none survived), and a concurrent
  instance holding the DB (no effect). It appears in windows of minutes during which _everything_
  stalls, and disappears just as broadly — **so any single comparison is worthless unless paired with
  a control run in the same minute.** An unpaired bisect will produce a confident, wrong answer; that
  has already happened twice on this bug. The adapter caps startup at 90s
  (`AK_REVIEW_STARTUP_GRACE_SECS`) and passes `--print-logs --log-level DEBUG`, whose output lands in
  `<raw-output-file>.stderr` and is the only diagnostic that exists on a stall.
  **Because the failure is transient, the adapter also retries it automatically** — 2 further attempts
  by default (`AK_REVIEW_STARTUP_RETRIES`, `0` disables) waiting 60s between them
  (`AK_REVIEW_RETRY_WAIT_SECS`), so an ordinary run rides out a short stall window without the caller
  noticing. Only exit `125` is retried: a `124` already holds the partial stream that makes it
  salvageable and a retry would overwrite it, and any other non-zero exit (bad model, missing
  credentials) is deterministic and would fail identically after the wait. Exit `125` therefore now
  means _every_ attempt stalled, and the message says how many were made.
- **`AK_REVIEW_TIMEOUT_SECS` bounds one attempt, not the whole invocation.** With retries on, the worst
  case is `retries × (startup_grace + retry_wait) + timeout` — about 25 minutes at the defaults, not 20.
  Size any backstop of your own against that figure, or set `AK_REVIEW_STARTUP_RETRIES=0` to make the
  ceiling absolute again.
- **`124` and `125` belong to the adapter, which will not pass through the tool's own use of them.** If
  `opencode` itself exits `125`, the adapter remaps it to `1` and says so: letting it through would tell
  the caller "every startup attempt stalled, nothing to salvage" about what was really an ordinary tool
  failure. Its stderr is forwarded either way and carries the real reason. A `125` from the adapter also
  guarantees an **empty** raw output file — if a killed run turns out to have flushed something after
  all, it is reported as `124` instead, so the partial stream gets salvaged rather than discarded.
- **A run can hang, and a hung run is not an empty run.** Observed three times: the process sits at ~0% CPU
  and emits no further events, once for over two hours, once for 83 minutes before a human asked about it.
  Since then the adapter enforces its own ceiling (see above), so this should surface as exit `124` rather
  than as an open-ended wait. Note that a hung `opencode` is **several** processes, not one — the adapter
  kills the whole process group, and a manual cleanup needs `pkill -f opencode`, not a single `kill`.
  Two measurements minutes apart tell a hang from a slow call — a single CPU reading cannot — and the
  absence of any open network connection is what proves it is waiting on nothing. When the Phase 3
  timeout expires, follow Phase 3's salvage path above — kill the process, then run the extractors in
  this order:
  1. `opencode-extract-subagents.sh` **first.** The tool dispatches one sub-agent per review dimension and merges
     them only at the end, so a run that stalls before that still holds every finding the finished
     sub-agents produced. Those live in `tool_use` parts, which `opencode-extract-report.sh` cannot see.
  2. `opencode-extract-report.sh` for whatever prose exists. On a stall before synthesis this is usually just
     narration — do not read a short result as "nothing was produced".
  3. `opencode-extract-cost.sh`, which works on a partial stream and reports what the run actually cost.

  Measured on two real stalled runs: `opencode-extract-report.sh` returned 91 characters of narration against
  4085 characters of unread sub-agent findings in the first, and 416 against **31832** in the second —
  five completed sub-agents whose entire output the normal path cannot see. A short `report.md` is not
  evidence that the review found nothing. After an external kill the adapter
  never reaches its own warning, so read `<raw-output-file>.stderr` directly in that case; the file is
  written by the OS as the run goes and survives the kill.

### `codex`

OpenAI's Codex CLI. Verified against `codex-cli 0.149.0`.

- Script: `${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/codex-adapter.sh <prompt-file> <model> [effort] <raw-output-file>`
- `model` — a bare model name, e.g. `gpt-5.6-sol`. **Not** `provider/model`: unlike `opencode`, codex
  takes no provider prefix, and a slashed value is rejected.
- `effort` — passed as `-c model_reasoning_effort="<value>"`, **not** as a flag. `--reasoning-effort`
  was removed in codex v0.50 and passing it would be silently wrong on every current version. Valid
  values, from the API's own enum: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. (The
  "Ultra" offered in codex's interactive model picker is not among them.) Omit to use codex's default.
- **Prerequisite: the working directory must be a git repository.** Codex refuses to run outside one
  ("Not inside a trusted directory and `--skip-git-repo-check` was not specified") and the adapter does
  not pass that flag, deliberately: a review of an untracked directory is almost always a wrong cwd,
  and failing in a fraction of a second with a clear message beats reviewing the wrong thing. This only
  bites `--path`/`--all` runs aimed outside a repo; every git-diff-based scope implies one already.
- **Prerequisite:** nothing else beyond an authenticated `codex`. There is no permission config to prepare —
  the adapter passes `--sandbox read-only`, which makes delegate's report-only contract _structural_:
  the external agent cannot write to the repository even if its prompt told it to. Never relax this.
- **Preflight:** `codex-preflight.sh` checks PATH **and** authentication. The auth check is legitimate
  here, where opencode's was not, for one reason: `codex login status` exits `0` authenticated and `1`
  unauthenticated, so the verdict comes from an exit code and never from parsing decorated output. If
  a future release stops distinguishing those codes, delete the check rather than parsing text — see
  `opencode-preflight.sh` for what that costs.
- **Models:** there is no `codex-models.sh`. Codex has no non-interactive model listing (`codex models`
  is not a subcommand; it is read as a prompt), so `/ak-review:setup` falls back to asking the user to
  type the model name.
- The adapter passes `--ignore-user-config`. A user's `~/.codex/config.toml` pulls in MCP servers,
  hooks, plugins and skills, none of which serve an unattended review: measured on a real config, a run
  emitted failing MCP auth handshakes, hook-timeout warnings, and _"skill descriptions were shortened
  to fit the skills context budget"_ — the review's own context being crowded out by unrelated tooling.
  Authentication is unaffected, resolving through `CODEX_HOME` independently of this flag.
- The prompt is passed on **stdin** with `-` as the prompt argument, not as an argv element: a delegate
  prompt carries project context and full diffs and can approach `ARG_MAX`. This also stops codex from
  blocking on an inherited stdin in a backgrounded run.
- Output is a newline-delimited JSON event stream (`thread.started`, `turn.started`, `item.completed`,
  `turn.completed`), always redirected straight to a file — see Phase 3/4.
- **Cost is not reported.** `turn.completed.usage` carries token counts only, with no price attached
  anywhere in the stream. `codex-extract-cost.sh` therefore emits `"total_cost": null` — Phase 8 must
  say codex reports no cost rather than printing `$0.00`.
- **A killed run usually salvages nothing**, and this is the sharpest difference from `opencode`.
  Codex has no sub-agents: it emits its answer as a single `agent_message` at the very end, so a run
  killed at the ceiling typically holds only `reasoning` and `command_execution` items — the model's
  scratch work, which is not findings and must never be fed to Phase 5 as though it were.
  `codex-extract-report.sh` reads only `agent_message` items and exits non-zero when there are none,
  which is the honest signal that the run produced no answer at all. Do not read that as "the review
  found nothing".

### `claude`

Anthropic's Claude Code, run headless. Verified against `2.1.240`.

- Script: `${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/claude-adapter.sh <prompt-file> <model> [effort] <raw-output-file>`
- `model` — an alias (`opus`, `sonnet`, `fable`) or a full name (`claude-opus-5`). No provider prefix.
- `effort` — passed as Claude Code's own `--effort`: `low`, `medium`, `high`, `xhigh`, `max`. Omit to
  use its default.
- **Read-only is enforced by an allowlist, not by the permission mode — and that distinction was
  measured, not assumed.** A probe run with `--permission-mode plan` alone _successfully created a
  file_: plan mode governs how Claude Code works, not what it may touch. The adapter therefore passes
  an explicit allowlist (`Read`, `Glob`, `Grep`, `Task`, `WebFetch`, and four read-only `git`
  invocations) plus a denial of `Write`/`Edit`/`NotebookEdit`. **Never grant `Bash` wholesale here:**
  an unrestricted shell is a write path no deny-list can close, since `touch`, `>`, `sed -i` and the
  rest cannot be enumerated. Verified with the allowlist in place, the agent reports it has no
  permitted way to create a file while `git log` and file reads work normally.
- `--permission-mode dontAsk` is what makes that workable unattended: nothing may sit waiting for a
  prompt that no one will answer. Plan mode is deliberately **not** used — it wants to write a plan
  file of its own, which the allowlist then blocks, producing a confusing complaint mid-report.
- **Sub-agents work headless**, which is why this adapter has a `-extract-subagents.sh` and `codex`
  does not. Confirmed on a real run: sub-agent messages arrive with `parent_tool_use_id` set, which is
  also the only thing distinguishing them from the coordinating agent's own text. The adapter passes
  `--forward-subagent-text` to get them into the stream at all.
- **Preflight:** `claude-preflight.sh` checks PATH only. No authentication check: Claude Code exposes
  no machine-readable login status the way `codex login status` does, and parsing human-readable
  output to gate a run is exactly the mistake `opencode-preflight.sh` documents.
- **Models:** there is no `claude-models.sh`; Claude Code has no listing command, so `/ak-review:setup`
  falls back to asking for the name.
- Output is a newline-delimited JSON event stream. The finished answer arrives in a single `result`
  event as `.result`, alongside `total_cost_usd`, `num_turns` and `usage`.
- **Cost is reported in money**, unlike `codex` — `total_cost_usd` comes straight from the tool, so
  nothing has to be inferred from token counts.
- **This is by far the most expensive adapter, so a spend cap is ON by default: $5.** Measured: about
  **$0.26–0.61 for a single trivial prompt**, because Claude Code loads substantial context before
  doing anything. Compare roughly $0.002 for the same shape of work through `opencode`. Override with
  `AK_REVIEW_MAX_BUDGET_USD`, or remove the cap with `AK_REVIEW_MAX_BUDGET_USD=none` — **not** with
  `0`, which would read as "zero dollars" and abort instantly. This is the only adapter whose tool can
  stop itself on cost rather than on time, which is why the ceiling lives here rather than in prose.
- **The cap is a ceiling, not a guarantee — it can be exceeded, by design.** Claude Code checks spend
  _between_ turns, never before committing to one, so a run stops once it has already gone over. The
  overshoot is bounded by the cost of a single turn, not open-ended. Measured: a `$0.01` cap ended a
  run at `$0.28` after `turns=1` — which is one turn, not a runaway. The practical rule is that a cap
  bounds spend to roughly _itself plus one turn_, so set it with that headroom rather than at the exact
  figure you cannot exceed. A cap below the price of one turn cannot bind at all; the adapter says so
  rather than letting it look like protection. For a genuinely hard limit, use the spend controls in
  the Anthropic Console — those sit outside this plugin and outside the tool.
- **Hitting the cap produces no report at all.** Claude Code ends the run with
  `terminal_reason: budget_exhausted` and `result: null`, so the report extractor would otherwise only
  be able to say that nothing was found — never that the cap is the reason. The adapter detects this
  and says so explicitly, naming the actual spend (which can overshoot the cap slightly before the run
  stops) and how to lift it. Sub-agents that finished beforehand are still in the stream, so
  `claude-extract-subagents.sh` is worth running on such a run.
- **A denied permission does not fail the run.** Claude Code records it in `permission_denials` and
  carries on, so a review that could not read what it needed still exits 0 with a confident-looking
  report — the same danger as opencode's silent auto-rejection. The adapter counts them and warns.
  **Check that warning before trusting a report.**
- Running this adapter from inside a Claude Code session is fine: it is a separate process with its own
  permissions, and the allowlist above applies to it regardless of what the outer session may do.

## Configuration

Resolved by `scripts/resolve-config.sh`, precedence CLI flags > project file > global file:

- Project: `.claude/ak-review.local.json` (gitignore this — it's machine/account-specific)
- Global: `~/.claude/ak-review.local.json` (portable — copy it to another machine, e.g. a remote server, to carry the same defaults)

```json
{
  "external_review": {
    "tool": "opencode",
    "model": "opencode-go/glm-5.3",
    "effort": "high",
    "fix_threshold": "high"
  }
}
```

`tool` and `model` are required (from some layer, or via flags) — there is no built-in default, so
installing or updating this plugin never forces a specific tool or model on anyone. `fix_threshold`
defaults to `high` if unset anywhere. `effort` has no default; if unresolved, the adapter is invoked
without an effort flag.

**`model` and `effort` are adapter-specific — the example above is `opencode`'s shape, not a universal
one.** `opencode` takes `provider/model` and its own `--variant` levels; `codex` takes a bare model
name and the reasoning-effort enum; `claude` takes an alias (`opus`, `sonnet`) or a full model name,
with Claude Code's own effort enum. Check the tool's entry in the Adapter Reference before writing
either value, and note that a wrong `model` surfaces only when the adapter rejects it mid-run.

### Environment variables

Runtime limits live in the environment rather than the config file, because they tune a single run
rather than describing a setup. **They are adapter-specific**, and an adapter silently ignores any it
does not implement — setting `AK_REVIEW_STARTUP_RETRIES` for `codex` does nothing at all.

| Variable | Default | Adapters | Effect |
|---|---|---|---|
| `AK_REVIEW_TIMEOUT_SECS` | `1200` | all | Ceiling for **one attempt**, after which the adapter kills the process group and exits `124` |
| `AK_REVIEW_STARTUP_GRACE_SECS` | `90` | `opencode` | How long a run may produce **no bytes at all** before it counts as stalled at startup. Must be below the timeout |
| `AK_REVIEW_STARTUP_RETRIES` | `2` | `opencode` | Further attempts after a startup stall. `0` disables retrying; only exit `125` is ever retried |
| `AK_REVIEW_RETRY_WAIT_SECS` | `60` | `opencode` | Wait between those attempts |
| `AK_REVIEW_MAX_BUDGET_USD` | `5` | `claude` | Spend cap in dollars. `none` removes it — **not** `0`, which means zero dollars and aborts instantly |

Two things the table cannot convey, both measured:

- **The timeout bounds an attempt, not the invocation.** With `opencode`'s retries on, the worst case
  is `retries × (startup_grace + retry_wait) + timeout`, roughly 25 minutes at the defaults. Size any
  backstop of your own against that, or set `AK_REVIEW_STARTUP_RETRIES=0`.
- **The budget cap is a ceiling, not a guarantee.** Claude Code checks spend between turns, so a run
  stops just _after_ exceeding it; the overshoot is bounded by one turn's cost. A cap below the price
  of a single turn cannot bind at all, and the adapter says so. See the `claude` entry above.

## Notes

- This skill writes code (Phase 6) — unlike `delegate` and `advise`, which never do.
- `--report-only` reduces this skill to "delegate + execute + advise, no fixing" — useful for a first,
  supervised run before trusting the auto-fix phase on a given tool/model combination.
- The raw adapter output file is kept on disk after the run (not deleted) for debugging or for
  re-running `/ak-review:advise` later without repeating the (paid) external tool call.

## Related

- [delegate](../delegate/SKILL.md) -- Phase 2 of this skill follows delegate's prompt-building logic
- [advise](../advise/SKILL.md) -- Phase 5 of this skill follows advise's verification logic
- [coderabbit](../coderabbit/SKILL.md) -- Phase 6 of this skill reuses coderabbit's fix decision framework; coderabbit is the CodeRabbit-specific equivalent of this more general skill
