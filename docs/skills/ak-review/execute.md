# Execute External Review

> Run the full delegate → external agent → advise → fix loop unattended, with a configurable external coding-agent CLI.

## Overview

Closes the loop `/ak-review:delegate` and `/ak-review:advise` deliberately left manual: this skill builds
the delegate prompt, runs it against a configured external tool (OpenCode or Codex), verifies every
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
say so rather than returning an empty report that would read as "no issues found".

A run that never starts is treated as its own failure, separate from a timeout. The OpenCode adapter
also caps _startup_ (90 s, override with `AK_REVIEW_STARTUP_GRACE_SECS`) and exits `125` when the tool
has produced no output at all by then — because that means it never reached the model, so there is no
partial stream and nothing to salvage. Reporting it as a timeout sent readers after output that could
not exist, and cost a full ceiling per attempt. See the skill's Adapter Reference for the measurements
behind this and for how to tell the two failures apart in OpenCode's own log.

## Usage

```text
/ak-review:execute [flags]
```

**Flags:** `--type all|committed|uncommitted` (default: all), `--base <ref>`, `--path <…>`, `--all`,
`--tool <name>`, `--model <model>`, `--effort <level>`, `--fix-threshold critical|high|medium|low`
(default: high), `--report-only`

`--model` and `--effort` take the _adapter's_ format, not a shared one: OpenCode wants `provider/model`
and its own variant levels, Codex wants a bare model name and one of `none|minimal|low|medium|high|xhigh|max`.

## Configuration

```json
// ~/.claude/ak-review.local.json  (global default; also copy to a remote machine to reuse it there)
// .claude/ak-review.local.json    (project override, gitignored)
{
  "external_review": {
    "tool": "opencode",
    "model": "opencode-go/glm-5.3",
    "effort": "high",
    "fix_threshold": "high"
  }
}
```

`tool` and `model` are required from some layer (or via flags) — there's no built-in default. Without
either, the skill stops and reports exactly which flag or config key to set.

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

One-off run against a specific tool/model, without touching any config file. Note the differing model
formats — Codex takes no provider prefix.

```text
/ak-review:execute --report-only
```

Runs delegate + external tool + advise, prints the report and verdicts, but fixes nothing — a supervised
first run before trusting auto-fix on a new tool/model combination.

```text
/ak-review:execute --fix-threshold medium
```

Widens auto-fixing to confirmed Medium findings and above (default is High and above).

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
- Raw adapter output is kept on disk after each run for debugging and for re-running `/ak-review:advise`
  without repeating the external tool call

## Requirements

- `jq` for the config resolution and output-extraction scripts
- The external CLI for the adapter you configure, installed and authenticated:
  - `opencode` for the `opencode` adapter
  - `codex` for the `codex` adapter (verified against `codex-cli 0.149.0`)

## Related

- [setup](./setup.md) -- guided configuration for this skill
- [delegate](./delegate.md) -- the prompt-building logic this skill's Phase 2 follows
- [advise](./advise.md) -- the verification logic this skill's Phase 5 follows
- [coderabbit](./coderabbit.md) -- the CodeRabbit-specific equivalent; this skill's Phase 6 reuses its fix framework
