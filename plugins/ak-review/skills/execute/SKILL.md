---
name: execute
description: This skill should be used when the user asks to "run a review end-to-end", "delegate and fix automatically", "automated external review with fixes", "run this through OpenCode/GLM and fix it", or wants the full delegate → external agent → advise → fix loop run unattended, without manual copy-paste between agents.
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
| `--model <provider/model>` | Model passed to the adapter (overrides config) |
| `--effort <level>` | Reasoning-effort/variant passed to the adapter (overrides config) |
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

Look up the resolved `tool` in the Adapter Reference below and run its recipe, e.g. for `opencode`:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/opencode-adapter.sh \
  "$PROMPT_FILE" "$MODEL" "$EFFORT" "$RAW_OUTPUT_FILE"
```

(Omit the `$EFFORT` argument entirely, not as an empty string, when Phase 1 resolved it to `null`.)

If `tool` matches no known adapter, stop and report which tools are implemented. Use a generous timeout
(20 minutes) — this is long-running and produces no intermediate output; do not attempt to babysit it.

**If the timeout expires:** kill the process — `$RAW_OUTPUT_FILE` is written incrementally by the OS as
the run goes, so it survives the kill. Do **not** fall through to the normal Phase 4 path below; go to
the salvage path instead:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/extract-subagents.sh "$RAW_OUTPUT_FILE" > "$SUBAGENTS_FILE"
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/extract-report.sh "$RAW_OUTPUT_FILE" > "$REPORT_FILE"
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/extract-cost.sh "$RAW_OUTPUT_FILE" > "$COST_FILE"
```

Run `extract-subagents.sh` **first**, in that order. The tool dispatches one sub-agent per review
dimension and merges them only at the end, so a run killed before that still holds every finished
sub-agent's output — and that output lives in `tool_use` parts that `extract-report.sh` cannot see (it
reads `text` parts, which carry only the coordinating agent's narration). See the `opencode` entry in
the Adapter Reference below for a measurement of exactly how much that narration misses. Then continue
to Phase 5 with both `$SUBAGENTS_FILE` and `$REPORT_FILE` in hand — see Phase 5 for how they differ.

### Phase 4: Parse the Report

Normal path — the run completed within the timeout, so there is no `$SUBAGENTS_FILE`:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/extract-report.sh "$RAW_OUTPUT_FILE" > "$REPORT_FILE"
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/extract-cost.sh "$RAW_OUTPUT_FILE" > "$COST_FILE"
```

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
- Total cost and tokens from `$COST_FILE`
- The path to `$RAW_OUTPUT_FILE` — it is kept on disk after the run (see Notes) and this is the only place
  that path is surfaced to the user; without it, re-running `/ak-review:advise` against the kept output
  means hunting for a `/tmp/ak-review-execute/<timestamp>/` directory rather than reading it off the report

No raw JSON dump in the final message — this is the human-facing digest.

## Adapter Reference

No adapter plugin/registry system — this table is the whole abstraction, and the filesystem is the
registry: an adapter is the set of scripts named after its tool under `scripts/`.

| Script | Contract | Required? |
|--------|----------|-----------|
| `<tool>-adapter.sh <prompt-file> <model> [effort] <raw-output-file>` | Runs the review, writing the tool's raw output to the given file. Exits with the tool's own exit code. | Yes |
| `<tool>-preflight.sh` | Exit 0 = ready, *or not provably unready*. Non-zero = cannot run, with the reason and the concrete fix on stderr. **An adapter must not block on a check it cannot make reliably — it either drops the check or notes the gap on stderr.** See the `opencode` entry for why this matters. | Optional; skipped if absent |
| `<tool>-models.sh` | Prints one candidate per line, to stdout; the format is the tool's own and is not guaranteed. Used by `/ak-review:setup`. | Optional; setup asks the user to type a model if absent |

Adding a tool means adding those scripts plus a subsection here, following the shape of the entry
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
  *correctly authenticated* user. An unauthenticated opencode fails instantly, for free, and says so itself, so
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
- **A run can hang, and a hung run is not an empty run.** Observed twice: the process sits at ~0% CPU and
  emits no further events, once for over two hours. Two measurements minutes apart tell a hang from a slow
  call — a single CPU reading cannot — and the absence of any open network connection is what proves it is
  waiting on nothing. When the Phase 3 timeout expires, follow Phase 3's salvage path above — kill the
  process, then run the extractors in this order:
  1. `extract-subagents.sh` **first.** The tool dispatches one sub-agent per review dimension and merges
     them only at the end, so a run that stalls before that still holds every finding the finished
     sub-agents produced. Those live in `tool_use` parts, which `extract-report.sh` cannot see.
  2. `extract-report.sh` for whatever prose exists. On a stall before synthesis this is usually just
     narration — do not read a short result as "nothing was produced".
  3. `extract-cost.sh`, which works on a partial stream and reports what the run actually cost.

  Measured on a real stalled run: `extract-report.sh` returned 91 characters of narration while 4085
  characters of findings sat unread in a completed sub-agent result. After an external kill the adapter
  never reaches its own warning, so read `<raw-output-file>.stderr` directly in that case; the file is
  written by the OS as the run goes and survives the kill.

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
