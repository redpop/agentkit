# Execute External Review

> Run the full delegate → external agent → advise → fix loop unattended, with a configurable external coding-agent CLI.

## Overview

Closes the loop `/ak-review:delegate` and `/ak-review:advise` deliberately left manual: this skill builds
the delegate prompt, runs it against a configured external tool (currently OpenCode), verifies every
finding against the real code the same way `/ak-review:advise` does, auto-fixes the confirmed
high/critical ones using `/ak-review:coderabbit`'s Apply/Adapt/Skip framework, validates with the
project's own tests/lint, and reports one compact summary — no manual copy-paste, no checkpoints mid-run.

The external tool and model are never hardcoded in the plugin. They resolve from, in order: CLI flags,
a project-local `.claude/ak-review.local.json`, then a global `~/.claude/ak-review.local.json`. Installing
or updating `ak-review` therefore never forces a specific tool or model on anyone — see Configuration.

## Usage

```text
/ak-review:execute [flags]
```

**Flags:** `--type all|committed|uncommitted` (default: all), `--base <ref>`, `--path <…>`, `--all`,
`--tool <name>`, `--model <provider/model>`, `--effort <level>`, `--fix-threshold critical|high|medium|low`
(default: high), `--report-only`

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

`/ak-review:setup` writes this file interactively, including picking a model from the list your tool
actually reports — use it instead of hand-writing the JSON if you prefer being walked through it.

## Examples

```text
/ak-review:execute --type uncommitted
```

Runs the full loop against your current uncommitted work, using whatever tool/model your config resolves to.

```text
/ak-review:execute --tool opencode --model opencode-go/glm-5.3 --effort high
```

One-off run against a specific tool/model, without touching any config file.

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
  the skill's Adapter Reference) — this skill never passes `--auto`
- Raw adapter output is kept on disk after each run for debugging and for re-running `/ak-review:advise`
  without repeating the external tool call

## Requirements

- `jq` for the config resolution and output-extraction scripts
- The OpenCode CLI (`opencode`), authenticated, for the `opencode` adapter

## Related

- [setup](./setup.md) -- guided configuration for this skill
- [delegate](./delegate.md) -- the prompt-building logic this skill's Phase 2 follows
- [advise](./advise.md) -- the verification logic this skill's Phase 5 follows
- [coderabbit](./coderabbit.md) -- the CodeRabbit-specific equivalent; this skill's Phase 6 reuses its fix framework
