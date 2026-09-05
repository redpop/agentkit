# Execute External Review

> Run the full delegate → external agent → advise → fix loop unattended, with a configurable external coding-agent CLI.

## Overview

Closes the loop `/ak-review:delegate` and `/ak-review:advise` deliberately left manual: this skill builds
the delegate prompt, runs it against a configured external tool (OpenCode, Codex or Claude Code), verifies every
finding against the real code the same way `/ak-review:advise` does, auto-fixes the confirmed
high/critical ones using `/ak-review:coderabbit`'s Apply/Adapt/Skip framework, validates with the
project's own tests/lint, and reports one compact summary — no manual copy-paste, no checkpoints mid-run.

The external tool and model are never hardcoded in the plugin. They resolve from, in order: CLI flags,
a project-local `.claude/ak-review.local.json`, then a global `~/.claude/ak-review.local.json`. Installing
or updating `ak-review` therefore never forces a specific tool or model on anyone — see Configuration.

Before any of that work happens, Phase 1 also runs the resolved adapter's preflight check (if it has
one), confirming the tool can actually run before the prompt is built and any tickets are fetched — a
missing tool would otherwise surface as a cryptic shell error mid-run. And because a hung run is not an
empty run, the adapter itself caps execution at a 20-minute ceiling (override with
`AK_REVIEW_TIMEOUT_SECS`) and exits `124` when it fires — enforced inside the adapter rather than left to
the calling agent, because an unattended harness may background the call and lose the timer. On a timeout
the skill salvages what already finished instead of discarding a paid, mostly-done run. How much that
recovers depends entirely on the tool: OpenCode dispatches sub-agents and merges late, so completed
sub-agent findings are recoverable first (`opencode-extract-subagents.sh`) from event-stream parts the
normal report extractor cannot see. Codex has no sub-agents and emits its answer as a single message at
the end, so a killed Codex run usually has nothing to salvage — its report extractor exits non-zero to
say so rather than returning an empty report that would read as "no issues found". Claude Code sits with
OpenCode here: it dispatches sub-agents too, so a killed run leaves recoverable work behind.

A run that never starts is treated as its own failure, separate from a timeout. The OpenCode adapter
also caps _startup_ (90 s, override with `AK_REVIEW_STARTUP_GRACE_SECS`) and exits `125` when the tool
has produced no output at all by then — because that means it never reached the model, so there is no
partial stream and nothing to salvage. Reporting it as a timeout sent readers after output that could
not exist, and cost a full ceiling per attempt. Since that failure is transient, the adapter retries it
automatically (2 further attempts, `AK_REVIEW_STARTUP_RETRIES`, 60 s apart via
`AK_REVIEW_RETRY_WAIT_SECS`), so a short stall window passes unnoticed; only `125` is retried, never a
`124` whose partial output is worth keeping. See the skill's Adapter Reference for the measurements
behind this and for how to tell the two failures apart in OpenCode's own log.

Two further signals exist, both added after a pair of real failed runs. **Exit `126` means the tool
itself refused** — a usage quota exhausted mid-run, a spend cap reached, a model unavailable. The
adapters read that out of the event stream and print the tool's own reason, because the exit code alone
never carried it: one run spent 25 minutes before hitting a quota and reported only a bare failure.
Unlike `125` it is not transient, so retrying immediately hits the same wall.

When a salvaged run has recovered its dimension output but lost only the merge, the skill now runs a
short **consolidation pass**: the same adapter, a prompt built from the recovered text, no
repository access needed. This is the common shape of a timeout — the fan-out finishes long before
the merge does, so a killed run holds nearly every dimension and lacks only the step that combines
them. Measured on the run this came from: five of six dimensions complete, 60 KB recovered, and the
missing piece was the most valuable one. The pass is skipped when the tool refused (`126`), since a
second call hits the same wall. Its output carries two caveats into the summary: the severities are
the sub-agents' own, rated without seeing each other, and coverage is whatever survived — a merge
over five of six dimensions is not a complete review and is not reported as one.

**A report extractor exiting `3` means the output is real but unfinished** — it has no `findings[]`
block, so it is the model's running narration rather than its review. The prose is still returned, but
the skill skips the auto-fix phase and says the run was cut short. Before this, such a run passed the
"is it empty?" check and was handed on as a finished report, which is the more dangerous failure: a
review that is confidently wrong beats one that honestly stops.

## Usage

```text
/ak-review:execute [flags]
```

**Flags:** `--type all|committed|uncommitted` (default: all), `--base <ref>`, `--path <…>`, `--all`,
`--tool <name>`, `--model <model>`, `--effort <level>`, `--no-effort`,
`--fix-threshold critical|high|medium|low` (default: high), `--timeout-secs <n>`, `--report-only`

`--model` and `--effort` take the _adapter's_ format, not a shared one: OpenCode wants `provider/model`
and its own variant levels, Codex a bare model name, and Claude Code an alias such as `opus` or a full
model name.

Effort levels are the adapter's own vocabulary and do not overlap cleanly — Codex has `none` and
`minimal` where Claude Code starts at `low`, and OpenCode's variants belong to the provider behind the
model rather than to OpenCode. So `effort` is configured keyed by tool:

```json
"effort": { "codex": "xhigh", "claude": "high" }
```

The entry for the tool actually running applies; a tool the map does not name runs with no effort,
which is always valid. A plain string still works and means "for the tool configured beside it" —
switching to another tool then stops with an error instead of carrying the level across. Use
`--no-effort` to drop it for one run. (`--effort ""` does not do that and says so; it used to be
ignored silently.)

Separately, Codex and Claude Code declare which values they accept at all, and a value outside that
list is refused before the run. OpenCode declares none, because any list would be a guess.

## Configuration

```json
// ~/.claude/ak-review.local.json  (global default; also copy to a remote machine to reuse it there)
// .claude/ak-review.local.json    (project override, gitignored)
{
  "external_review": {
    "tool": "opencode",
    "model": "opencode-go/glm-5.3",
    "effort": { "opencode": "high" },
    "fix_threshold": "high",
    "timeout_secs": 1200,
    "model_overrides": {
      "opencode-go/glm-5.3-flash": { "timeout_secs": 1800 }
    }
  }
}
```

`tool` and `model` are required from some layer (or via flags) — there's no built-in default. Without
either, the skill stops and reports exactly which flag or config key to set.

`model_overrides` applies settings only when its key is the model actually being used, which is what
makes a per-model timeout possible: a model that reliably runs longer than the adapter's 20-minute
ceiling gets more time, while every other model keeps a ceiling short enough that a genuine hang is
still noticed quickly. An entry may set `effort`, `fix_threshold` and `timeout_secs` — not `tool` or
`model`, which would contradict the key it is stored under. A `--timeout-secs` flag still overrides it
for a single run. Setting a key to `null` unsets it instead of replacing it, which drops an inherited
`effort` for one model permanently; `--no-effort` does the same for one run.

`/ak-review:setup` writes this file interactively, guiding you to pick or type a model depending on
what your tool supports — use it instead of hand-writing the JSON if you prefer being walked through it.

## Examples

```text
/ak-review:execute --type uncommitted
```

Runs the full loop against your current uncommitted work, using whatever tool/model your config resolves to.

```text
/ak-review:execute --tool opencode --model opencode-go/glm-5.3 --effort high
```

```text
/ak-review:execute --tool codex --model gpt-5.6-sol --effort high
```

```text
/ak-review:execute --tool claude --model opus --effort xhigh
```

One-off run against a specific tool/model, without touching any config file. Note the differing model
formats — only OpenCode takes a provider prefix.

```text
/ak-review:execute --report-only
```

Runs delegate + external tool + advise, prints the report and verdicts, but fixes nothing — a supervised
first run before trusting auto-fix on a new tool/model combination.

```text
/ak-review:execute --fix-threshold medium
```

Widens auto-fixing to confirmed Medium findings and above (default is High and above).

```text
/ak-review:execute --timeout-secs 1800
```

Raises the per-attempt ceiling for one run. Prefer a `model_overrides` entry when a specific model
always needs it — a flag has to be remembered every time, and the run it is forgotten on is the one
that gets killed just short of finishing.

## When to Use

- You want a full review-and-fix cycle without manually pasting a prompt into another agent and its
  findings back into this session
- You've already validated `/ak-review:delegate` + `/ak-review:advise` manually and trust the loop for a
  given tool/model
- You're running this unattended (e.g. via Claude Remote on a server) and need one compact result, not a
  multi-step conversation

## Best Practices

- Run once with `--report-only` on a new tool/model pairing before trusting the default auto-fix behavior
- Keep the global config (`~/.claude/ak-review.local.json`) for your personal default, and only add a
  project-local override when a specific repo genuinely needs a different tool or model
- The OpenCode adapter needs a working, non-interactive-friendly OpenCode permission config first (see
  the skill's Adapter Reference) — this skill never passes `--auto`. The Codex adapter needs no such
  preparation: it runs with `--sandbox read-only`, which makes the report-only contract structural
- Codex reports token counts but no monetary cost, so the run summary shows tokens only for that adapter
- **OpenCode does not report what its sub-agents cost.** They run in their own sessions and only the
  parent session's spend reaches the stream, so a run that dispatched sub-agents — which the delegate
  prompt asks for by default — has no total. Measured across two runs: USD 1.17 reported against
  USD 3.17 charged. The summary therefore reports the parent's spend as a partial figure and names how
  many sub-agent sessions went uncounted, rather than presenting the part as the whole. Runs without
  sub-agents are unaffected and report a real total.
- The Claude Code adapter is by far the most expensive — roughly $0.26–0.61 for a trivial prompt against
  about $0.002 through OpenCode. It therefore ships with a **$5 spend cap on by default**; raise it with
  `AK_REVIEW_MAX_BUDGET_USD`, or remove it with `AK_REVIEW_MAX_BUDGET_USD=none` (not `0`). Hitting the cap
  ends the run without a report, which the adapter reports explicitly rather than leaving it to look like
  an empty review. Note the cap is a ceiling rather than a guarantee: spend is checked between turns, so a
  run stops just _after_ exceeding it — overshoot is bounded by one turn's cost. Set it with headroom, and
  use the Anthropic Console's spend controls if you need a genuinely hard limit
- Raw adapter output is kept on disk after each run for debugging and for re-running `/ak-review:advise`
  without repeating the external tool call

## Requirements

- `jq` for the config resolution and output-extraction scripts
- The external CLI for the adapter you configure, installed and authenticated:
  - `opencode` for the `opencode` adapter
  - `codex` for the `codex` adapter (verified against `codex-cli 0.149.0`)
  - `claude` for the `claude` adapter (verified against Claude Code `2.1.240`)

## Related

- [setup](./setup.md) -- guided configuration for this skill
- [delegate](./delegate.md) -- the prompt-building logic this skill's Phase 2 follows
- [advise](./advise.md) -- the verification logic this skill's Phase 5 follows
- [coderabbit](./coderabbit.md) -- the CodeRabbit-specific equivalent; this skill's Phase 6 reuses its fix framework
