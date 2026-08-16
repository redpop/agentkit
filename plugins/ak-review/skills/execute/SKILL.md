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

### Phase 1: Resolve Configuration

Run (only pass flags the user actually supplied):

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/resolve-config.sh \
  [--tool <val>] [--model <val>] [--effort <val>] [--fix-threshold <val>]
```

The script reads `.claude/ak-review.local.json` and `~/.claude/ak-review.local.json` itself. If it exits
non-zero, print its stderr message verbatim and **stop** — do not guess a tool or model. On success it
prints resolved JSON: `{"tool":..., "model":..., "effort":..., "fix_threshold":...}`.

### Phase 2: Build the Prompt

Follow `/ak-review:delegate`'s Phase 1–3 exactly: resolve scope (this skill's `--type`/`--base`/`--path`/
`--all`, same semantics), capture project context, discover requirements context, assemble the prompt.
The generated prompt is always report-only (delegate template §7) — the external agent never edits code.
Write the assembled prompt to a scratch file, e.g. `/tmp/ak-review-execute/<timestamp>/prompt.md`. If
the resolved scope is empty, `delegate`'s own "say so and stop" behavior applies here too.

### Phase 3: Execute

Look up the resolved `tool` in the Adapter Reference below and run its recipe, e.g. for `opencode`:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/opencode-adapter.sh \
  "$PROMPT_FILE" "$MODEL" "$EFFORT" "$RAW_OUTPUT_FILE"
```

(Omit the `$EFFORT` argument entirely, not as an empty string, when Phase 1 resolved it to `null`.)

If `tool` matches no known adapter, stop and report which tools are implemented. Use a generous timeout
(20 minutes) — this is long-running and produces no intermediate output; do not attempt to babysit it.

### Phase 4: Parse the Report

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

### Phase 6: Fix (skip if `--report-only`)

For findings with verdict `confirmed` **and** `severity` at or above the resolved `fix_threshold`
(order: `critical > high > medium > low`), apply `/ak-review:coderabbit`'s Phase 4 decision framework
(Apply / Adapt / Skip). Everything else — other verdicts, or `confirmed` below the threshold — is left
untouched and recorded for the summary with its reason.

### Phase 7: Validate (skip if `--report-only`)

Run the project's own test and lint commands (already captured by `delegate`'s Phase 2 project-context
step) after fixing. Record pass/fail; do not revert fixes automatically on failure — report it and let
the user decide, since reverting a fix that exposed a real pre-existing failure would hide information.

### Phase 8: Summarize

Produce one compact report, in the language of the invoking session:

- Findings by verdict and severity (counts)
- What was fixed, one line each with the reason it qualified
- What was skipped, one line each with the reason (false positive / below threshold / needs context / uncertain)
- Validation result (tests/lint pass?), only if Phase 7 ran
- Total cost and tokens from `$COST_FILE`

No raw JSON dump in the final message — this is the human-facing digest.

## Adapter Reference

No adapter plugin/registry system — this table is the whole abstraction. Adding a tool means adding a
subsection here plus one script under `scripts/`, following the same shape as the entry below.

### `opencode`

- Script: `${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/opencode-adapter.sh <prompt-file> <model> [effort] <raw-output-file>`
- `model` — an OpenCode `provider/model` string, e.g. `opencode-go/glm-5.3`
- `effort` — passed as OpenCode's `--variant` (e.g. `high`); omit to use OpenCode's own default
- **Prerequisite:** a working OpenCode permission config (`opencode.jsonc`, project- or user-level) that
  allows non-interactive bash execution for read-only/test/lint commands, with destructive commands
  (`rm -rf`, `git reset --hard`, `git push --force`, …) gated to `"ask"`. This skill never passes
  `--auto` — that would silently approve those too. If a run stalls, fix the permission config; do not
  reach for `--auto`.
- **Run the adapter with the reviewed repository as the working directory.** OpenCode gates paths outside
  the cwd behind its `external_directory` permission, and in non-interactive `run` mode a gated path is
  **auto-rejected, not prompted** — the review then proceeds without ever reading the files, exits 0, and
  produces a confident-looking report based on nothing.
- Those rejections are reported on **stderr**, never in the JSON stream, so the adapter captures stderr to
  `<raw-output-file>.stderr` and, once the run ends, forwards it and prints a warning when it finds
  `auto-rejecting` there. **Check that warning before trusting a report** — a silently uninformed review is
  this adapter's most dangerous failure mode.
- Output is a newline-delimited JSON event stream, always redirected straight to a file — see Phase 3/4.
- **A run can hang.** Observed in practice: every review sub-agent completed, then no final event for over
  two hours at ~0% CPU. If the Phase 3 timeout expires, kill the process and treat the partial stream as
  partial — `extract-report.sh`/`extract-cost.sh` both handle a truncated stream — rather than waiting it out.
  After an external kill the adapter never reaches its own warning, so read `<raw-output-file>.stderr`
  directly in that case; the file is written by the OS as the run goes and survives the kill.

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
