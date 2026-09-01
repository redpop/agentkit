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
| `--timeout-secs <n>` | Per-attempt ceiling for this run, overriding config and the adapter's own default |
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
  [--tool <val>] [--model <val>] [--effort <val>] [--fix-threshold <val>] [--timeout-secs <val>]
```

The script reads `.claude/ak-review.local.json` and `~/.claude/ak-review.local.json` itself. If it exits
non-zero, print its stderr message verbatim and **stop** — do not guess a tool or model. On success it
prints resolved JSON:
`{"tool":..., "model":..., "effort":..., "fix_threshold":..., "timeout_secs":...}`.

`timeout_secs` is `null` unless the config or a flag set one — including through a `model_overrides`
entry for the resolved model, which is how a model that is reliably slower than the adapter's default
ceiling gets a longer one without slowing every other model down. Carry the value to Phase 3; do not
substitute a number of your own when it is `null`, because the adapter's own default is the one place
that number is written down.

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

**Measure the scope before running, and say so if it is large.** Count the files and commits in the
resolved scope and the size of the assembled prompt. A review of ~100 files across dozens of commits
with six dimensions does not fit a single fixed ceiling: measured, such a run consumed 25 minutes of
quota and a 30-minute timeout without ever reaching consolidation. Report the figures, name the
ceiling that applies, and — when the scope is plainly large — offer to split it (per app, per ticket
group) before starting rather than after failing. Do not silently rescale the timeout: a limit that
moves on its own is worse than one the user chose knowing the size.

### Phase 3: Execute

Look up the resolved `tool` in the Adapter Reference below and run its adapter:

```bash
[AK_REVIEW_TIMEOUT_SECS=<resolved>] \
  ${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-adapter.sh \
  "$PROMPT_FILE" "$MODEL" "$EFFORT" "$RAW_OUTPUT_FILE"
```

(Omit `$EFFORT` entirely, not as an empty string, when Phase 1 resolved it to `null`. Likewise omit the
`AK_REVIEW_TIMEOUT_SECS` prefix entirely when Phase 1 resolved `timeout_secs` to `null` — an unset
variable is what selects the adapter's own default, and an empty one is a validation error.) If `tool`
matches no adapter, stop and report which are implemented. The run is long and produces no
intermediate output; do not babysit it.

**The adapter owns the ceiling, not you.** It enforces its own timeout (20 min,
`AK_REVIEW_TIMEOUT_SECS`) because a ceiling the caller holds is the one that breaks when a harness
backgrounds the call and takes the timer with it. Passing `timeout_secs` in the environment does not
move that ownership: it only tells the adapter which number to enforce, and the enforcement still
happens inside the adapter where the timer cannot be lost. Pass a generous backstop of your own anyway, but
treat the exit code as definitive:

| Exit | Meaning | What to do |
|------|---------|------------|
| `124` | Ran, then hung. A partial stream exists | **Salvage** — see below |
| `125` | Produced nothing; never reached the model | **Stop.** Nothing to salvage, and the extractors would only confirm the emptiness. Report the adapter's stderr verbatim. Do not call it "the review found nothing" — no review took place |
| `126` | **The tool refused** — quota exhausted, budget cap hit, model unavailable | **Stop, and say why.** The adapter prints the tool's own reason. Retrying now hits the same wall; unlike `125` this is not transient. Whatever was produced first is still worth salvaging if the adapter has a sub-agent extractor |
| other | The tool's own failure | Report it and stop |

**Never retry a `125` yourself.** An adapter whose failure is transient retries internally, so a
surfaced `125` already means every attempt stalled. Coming back later is the user's call.

**Salvage path.** Attempt it whenever the adapter has a `<tool>-extract-subagents.sh` **and** the raw
file is non-empty — not only on `124`. The exit code says how the run ended; only the extractor's
existence says whether anything survived it. A quota refusal (`126`) or an ordinary crash can leave
just as many finished sub-agents behind as a timeout, and the old rule silently discarded them.
The one exception is `125`: the file is empty by definition, so there is nothing to run.

Kill the process if it still runs — `$RAW_OUTPUT_FILE` is written as the run goes, so it survives. Do
**not** fall through to Phase 4. Run every extractor the adapter provides, sub-agents **first**:

```bash
# only if the adapter has one — opencode and claude do, codex does not
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-extract-subagents.sh "$RAW_OUTPUT_FILE" > "$SUBAGENTS_FILE"
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-extract-report.sh "$RAW_OUTPUT_FILE" > "$REPORT_FILE"
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-extract-cost.sh "$RAW_OUTPUT_FILE" > "$COST_FILE"
```

**How much this recovers depends entirely on the tool** — `opencode` and `claude` dispatch sub-agents
and merge late, so plenty survives; `codex` emits one message at the end, so usually nothing does. A
short `report.md` is therefore not evidence that the review found nothing. See the Adapter Reference.

Then continue to Phase 3b.

### Phase 3b: Consolidate a Salvaged Run

**When to run this — all three must hold:**

1. `$SUBAGENTS_FILE` exists and is non-empty (the salvage path recovered dimension output), **and**
2. the report extractor exited `3` (output exists but has no `findings[]` block — the merge never
   happened), **and**
3. the adapter did **not** exit `126`. A refusal means the tool is unavailable; a second call hits
   the same wall.

Otherwise skip straight to Phase 4.

**Why this exists.** The fan-out finishes long before the merge does, so a run killed near the end
holds nearly every dimension's findings and lacks only the step that combines them — measured: five
of six dimensions complete, 60 KB recovered, and the one thing missing was the most valuable. That
merge does not need the original run, the repository, or write access. It needs the prose that is
already on disk, which makes it a cheap second call rather than a repetition of an expensive one.

**Run the same adapter again**, with a prompt built from what was salvaged. Write it to
`consolidate-prompt.md` in the same run directory and send the output to `consolidated-report.md`:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-adapter.sh \
  "$RUN_DIR/consolidate-prompt.md" "$MODEL" "$EFFORT" "$RUN_DIR/consolidated-raw.jsonl"
```

Use a short ceiling — this is a merge, not a review. `AK_REVIEW_TIMEOUT_SECS=300` is generous.

**The prompt:**

````text
# Consolidate Review Findings

A code review of the repository "[REPO_NAME]" ran across several dimensions but was cut short before
it could merge its results. Every dimension's raw output is below. Your only job is to turn it into
the final report — do NOT review any code yourself, and do NOT add findings that are not below.

You may read the cited files to check a claim's line numbers or drop one that the code plainly
contradicts. Do not go looking for new issues; anything you add that is not traceable to the text
below is out of scope.

## Recovered dimension output

[contents of $SUBAGENTS_FILE]

## What to produce

1. Merge duplicates. Dimensions overlap — the same defect often appears two or three times under
   different headings. Keep the clearest statement and note that it was found more than once.
2. Assign severity per finding: critical / high / medium / low. The dimension agents rated in
   isolation and could not see each other's work; a defect several of them hit independently usually
   deserves the higher of their ratings, not the average.
3. State plainly which dimensions are represented and, if you can tell, which are missing — a merge
   over five of six dimensions must not read as a complete review.

Then, as the LAST thing in your response, a single fenced JSON block:

```json
{
  "findings": [
    {
      "id": "F1",
      "title": "short title",
      "severity": "critical|high|medium|low",
      "category": "correctness|security|tests|maintainability|docs|performance",
      "file": "path/to/file",
      "start_line": 0,
      "end_line": 0,
      "claim": "what is wrong",
      "evidence": "what in the code or the recovered output shows it",
      "suggested_fix": "what to do"
    }
  ]
}
```

If the recovered output contains no actionable findings, return an empty array rather than inventing
entries to fill it.

````

**Then run the report extractor against the consolidation output.** If it now exits `0`, use
`consolidated-report.md` as `$REPORT_FILE` for Phase 4 onward and say in Phase 8 that the findings
came from a consolidation pass. If it exits `3` again, the merge failed too: keep the original
`$SUBAGENTS_FILE` and continue as an unconsolidated salvage, per Phase 5.

**Two limits to carry into Phase 8, because they change what the report is worth:**

- **The severities are the sub-agents', not a coordinator's.** They rated without seeing each other,
  so cross-dimension deduplication is weaker than in a run that merged normally.
- **Coverage is whatever survived.** A consolidation over five of six dimensions is not a complete
  review, and the summary must say which one is missing rather than presenting the result as whole.

Add the consolidation's own cost to the run's total — it is a second paid call, however short.

### Phase 4: Parse the Report

Normal path — the run completed within the timeout, so there is no `$SUBAGENTS_FILE`:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-extract-report.sh "$RAW_OUTPUT_FILE" > "$REPORT_FILE"
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-extract-cost.sh "$RAW_OUTPUT_FILE" > "$COST_FILE"
```

The extractors are **per-adapter**, not shared: each external tool emits its own event schema, and a
mismatched extractor silently yields an empty report rather than an error. Use the ones named after
the resolved `tool`.

**A report extractor exiting `3` means the output is real but UNFINISHED** — it carries no
`findings[]` block, so it is the model's narration rather than its review. The prose is still written
to `$REPORT_FILE`, deliberately, but it must not be treated as findings: **skip Phase 6 entirely**,
show the user what was recovered, and say the run was cut short. Measured on a real run: a review that
hit a usage limit after 25 minutes left 1441 bytes of _"I'll review this as a report-only audit…"_,
which the old empty-check passed as a finished report. Verifying narration against code produces
confident nonsense; that is the failure this code exists to prevent.

Read only `$REPORT_FILE` and `$COST_FILE` — never read `$RAW_OUTPUT_FILE` directly, it carries the
adapter's full internal event trace and is far larger than what's needed. From `$REPORT_FILE`, take the
trailing ` ```json ` findings block (delegate's schema: `findings[]` with `id, title, severity, category,
file, start_line, end_line, claim, evidence, suggested_fix`).

### Phase 5: Verify

Follow `/ak-review:advise`'s Phase 2 exactly against the parsed `findings[]`: read the cited file/lines
for each finding, check the claim against the real code, assign a verdict (`confirmed | false_positive |
needs_more_context | uncertain`).

**If Phase 3b consolidated successfully**, treat its output as an ordinary report: it has a
`findings[]` block with severities, so Phase 5 and Phase 6 work normally — while remembering that the
severities came from sub-agents that never saw each other's work, which makes cross-dimension
judgement weaker than in a run that merged on its own.

**If the salvage path ran and consolidation did not** (skipped, or it exited `3` again), read
`$SUBAGENTS_FILE` — but not the same way. It is the
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
  tool reports no cost, rather than printing `USD 0.00`. Zero and "not reported" are different claims,
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
| `<tool>-extract-report.sh <raw-output-file>` | Prints the agent's report to stdout. Exit `1` = the stream carries no report at all; exit `3` = output exists but has no `findings[]` block, so it is narration from a run that was cut short. `3` still prints what it found — the caller must show it without treating it as findings. Neither is a parse failure, and neither may be smoothed into an empty report. | Yes |
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

- `model` — `provider/model`, e.g. `opencode-go/glm-5.3` · `effort` — OpenCode's `--variant`
- **Prerequisite:** an `opencode.jsonc` permission config that allows non-interactive bash for
  read-only/test/lint commands, with destructive ones gated to `"ask"`. This skill never passes
  `--auto`; if a run stalls, fix the permission config rather than reaching for it.
- **Preflight checks PATH only, never authentication** — deliberately, and do not add it back without a
  machine-readable signal. The script header records what the parsing attempt cost.
- **Run it with the reviewed repository as the working directory.** Paths outside the cwd are
  **auto-rejected, not prompted**, in non-interactive mode, so the review silently proceeds without
  reading them and still exits 0. Those rejections appear only on stderr (as `auto-rejecting`), which
  the adapter captures to `<raw-output-file>.stderr` and warns about. **Check that warning before
  trusting a report** — a silently uninformed review is this adapter's most dangerous failure.
- **Two distinct failures, opposite advice.** Exit `124` = ran, then hung: a partial stream exists and is
  worth salvaging. Exit `125` = produced nothing at all: it never reached the model, so there is nothing
  to recover. Reserved codes are the adapter's own; a `125` from opencode itself is remapped to `1`, and
  a `125` from the adapter always means an empty output file.
- **The startup stall is transient and retried automatically** (2 attempts, 60s apart). Exit `125`
  therefore means every attempt stalled. Upstream bug, unidentified; database, config, plugins, stale
  processes and concurrent instances were each ruled out by measurement. It comes in windows of minutes
  during which everything stalls — **so any comparison without a control run in the same minute will
  produce a confident, wrong answer.** That has misled two investigations already.
- **On a `124`, run `opencode-extract-subagents.sh` first.** Sub-agent findings live in `tool_use` parts
  the report extractor cannot see. Measured on two stalled runs: the report held 91 and 416 characters
  of narration against 4085 and **31832** characters of unread sub-agent findings. A short `report.md`
  is not evidence that the review found nothing.
- A hung opencode is **several** processes; manual cleanup needs `pkill -f opencode`.

### `codex`

OpenAI's Codex CLI. Verified against `codex-cli 0.149.0`.

- `model` — a bare name, e.g. `gpt-5.6-sol`. **No provider prefix**; a slashed value is rejected.
- `effort` — passed as `-c model_reasoning_effort=…`, **not** as a flag (`--reasoning-effort` was removed
  in v0.50). Values: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`.
- **Prerequisite: the working directory must be a git repository.** Codex refuses otherwise, and the
  adapter withholds `--skip-git-repo-check` on purpose: reviewing an untracked directory is almost always
  a wrong cwd. Only affects `--path`/`--all` runs aimed outside a repo.
- **Read-only is structural:** the adapter passes `--sandbox read-only`, so the agent cannot write even if
  told to. Never relax this. It also passes `--ignore-user-config`, which keeps MCP servers, hooks and
  plugins from crowding out the review's own context.
- **Preflight checks authentication too** — legitimate here, unlike opencode, because `codex login status`
  exits `0`/`1` rather than requiring output to be parsed.
- **No model listing** (`codex models` is not a subcommand), so `/ak-review:setup` asks for the name.
- **Cost is not reported** — token counts only, so `total_cost` is `null`. Phase 8 must say the tool
  reports no cost rather than printing a zero.
- **A killed run usually salvages nothing.** No sub-agents: the answer comes as one `agent_message` at the
  very end, so a killed run holds only reasoning and command output — scratch work, not findings, and it
  must never reach Phase 5 as though it were. The report extractor exits non-zero to say so.

### `claude`

Anthropic's Claude Code, headless. Verified against `2.1.240`.

- `model` — an alias (`opus`, `sonnet`) or full name (`claude-opus-5`) · `effort` — Claude Code's own
  `--effort`: `low`…`max`
- **Read-only rests on an allowlist, not the permission mode.** Measured: `--permission-mode plan` alone
  still allowed a file to be created. The adapter allows only reading tools plus four read-only `git`
  invocations, and denies `Write`/`Edit`/`NotebookEdit`. **Never grant `Bash` wholesale** — an
  unrestricted shell is a write path no deny-list can close.
- **Sub-agents work headless**, so a `124` is salvageable via `claude-extract-subagents.sh`. They are
  identified solely by `parent_tool_use_id` being set.
- **Preflight checks PATH only** — Claude Code exposes no machine-readable login status.
- **No model listing**, so `/ak-review:setup` asks for the name.
- **Cost is reported in money** (`total_cost_usd`), unlike codex.
- **By far the most expensive adapter, so a spend cap is on by default: USD 5.** Measured: USD 0.26–0.61
  for a single trivial prompt, against roughly USD 0.002 through opencode. Override with
  `AK_REVIEW_MAX_BUDGET_USD`; remove it with `=none`, **not** `0`, which means zero dollars and aborts
  instantly. **The cap is a ceiling, not a guarantee:** spend is checked between turns, so a run stops
  just after exceeding it, overshooting by up to one turn's cost. A cap below the price of one turn
  cannot bind at all and is flagged. For a hard limit, use the Anthropic Console's spend controls.
- **Hitting the cap produces no report** (`result: null`), which the adapter reports explicitly so it is
  not mistaken for an empty review. Finished sub-agents remain salvageable.
- **A denied tool call does not fail the run** — Claude Code records it in `permission_denials` and
  carries on, so an uninformed review still exits 0. The adapter counts them and warns.
  **Check that warning before trusting a report.**

> Each adapter script carries a comment header with the measurements and the reasoning behind these
> decisions. Read it before changing one — several encode failures that cost a day to diagnose.

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
    "fix_threshold": "high",
    "timeout_secs": 1200,
    "model_overrides": {
      "opencode-go/glm-5.3-flash": { "timeout_secs": 1800 }
    }
  }
}
```

`tool` and `model` are required (from some layer, or via flags) — there is no built-in default, so
installing or updating this plugin never forces a specific tool or model on anyone. `fix_threshold`
defaults to `high` if unset anywhere. `effort` has no default; if unresolved, the adapter is invoked
without an effort flag. `timeout_secs` has no default here either — unset means the adapter's own
ceiling applies, which keeps that number in exactly one place.

### Per-model overrides

`model_overrides` maps a model id to settings that apply **only when that model is the resolved one**.
It exists because runtime limits are a property of the model, not of the setup: a model that reliably
needs longer than the adapter's ceiling would otherwise force a global timeout that makes every faster
model's hang cost that much more to detect. The example above is that case — a slower model gets 1800 s,
everything else keeps 1200 s.

An entry may set `effort`, `fix_threshold` and `timeout_secs`, and nothing else. Setting one to
`null` **unsets** the inherited value rather than overriding it with a value — which is the only way
to make a per-model entry safe across tools, because `effort` vocabularies are the adapter's own: a
`codex` `xhigh` inherited by an `opencode` run becomes a `--variant` that tool never defined. `tool` and `model` are
rejected with an error rather than ignored: the map is keyed on the model that has already been
resolved, so an entry able to change it would mean the applied entry is not the one the resolved model
points at. Precedence is global file < project file < matching `model_overrides` entry < CLI flags —
the override is a per-model default, not a lock, so `--timeout-secs` still wins for one run. The project
layer extends the global map key by key rather than replacing it.

**`model` and `effort` are adapter-specific — the example above is `opencode`'s shape, not a universal
one.** `opencode` takes `provider/model` and its own `--variant` levels; `codex` takes a bare model
name and the reasoning-effort enum; `claude` takes an alias (`opus`, `sonnet`) or a full model name,
with Claude Code's own effort enum. Check the tool's entry in the Adapter Reference before writing
either value, and note that a wrong `model` surfaces only when the adapter rejects it mid-run.

### Environment variables

Runtime limits live in the environment rather than the config file, because they tune a single run
rather than describing a setup. **They are adapter-specific**, and an adapter silently ignores any it
does not implement — setting `AK_REVIEW_STARTUP_RETRIES` for `codex` does nothing at all.

`AK_REVIEW_TIMEOUT_SECS` is the one exception, and only in one direction: Phase 1 may resolve a
`timeout_secs` from the config and Phase 3 sets the variable from it, so a per-model ceiling survives
without the user having to remember an env prefix at the prompt. A variable already set in the
environment is not overwritten — the adapter reads whatever it is given.

| Variable | Default | Adapters | Effect |
|---|---|---|---|
| `AK_REVIEW_TIMEOUT_SECS` | `1200` | all | Ceiling for **one attempt**, after which the adapter kills the process group and exits `124`. Also settable per model via `timeout_secs` / `model_overrides` (see Configuration) |
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
  re-running `/ak-review:advise` later without repeating the (paid) external tool call. **It lives in
  `/tmp` and therefore does not survive a reboot** — on macOS `/tmp` is cleared at boot. If a run is
  worth re-examining later, copy its directory somewhere durable before the machine restarts; the
  evidence for two failed runs was lost exactly this way.

## Related

- [delegate](../delegate/SKILL.md) -- Phase 2 of this skill follows delegate's prompt-building logic
- [advise](../advise/SKILL.md) -- Phase 5 of this skill follows advise's verification logic
- [coderabbit](../coderabbit/SKILL.md) -- Phase 6 of this skill reuses coderabbit's fix decision framework; coderabbit is the CodeRabbit-specific equivalent of this more general skill
