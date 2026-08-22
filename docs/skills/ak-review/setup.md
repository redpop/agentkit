# Set Up External Review

> Guided, interactive configuration for `/ak-review:execute` — writes the config file and proves it resolves.

## Overview

`/ak-review:execute` needs to know which external coding-agent CLI to run the review with, and which
model. No configuration ships with the plugin on purpose: a default would pick someone's tool and
model for them, and a plugin update would silently change it. This skill is how that choice gets
made — interactively, once.

It asks where the config should live, which model to use, and how aggressive auto-fixing should be.
For the model: if the tool publishes a list of available models, you pick from it; if not, you type
the model identifier in the format the tool expects, and the skill repeats it back for you to confirm.
Then it writes the file and runs the resolver against it, so a typo surfaces immediately rather than
on the next review.

**It never runs a review and never calls a paid model.** Listing models (when available) is free.

## Usage

```text
/ak-review:setup [--global | --project]
```

**Flags:** `--global` (write `~/.claude/ak-review.local.json`), `--project` (write
`.claude/ak-review.local.json`). Without either, the skill asks.

## Examples

```text
/ak-review:setup
```

The full guided flow — asks for scope, model, fix threshold and effort, then writes and verifies.

```text
/ak-review:setup --global
```

Skips the scope question and configures the global default, the file you copy to another machine.

## When to Use

- `/ak-review:execute` reported that no tool or model is configured
- You want to change the model or the fix threshold and would rather be walked through it
- You are setting up a second machine (though copying `~/.claude/ak-review.local.json` also works)

## Best Practices

- Prefer the **global** config, and only add a project-local one when a specific repository genuinely
  needs a different tool or model
- Keep `fix_threshold` at `high` — at lower levels a growing share of findings are matters of taste,
  and a reviewer is least reliable exactly there
- Gitignore any project-local config; it is machine- and account-specific
- Follow up with `/ak-review:execute --report-only` for a first supervised run

## Requirements

- The chosen tool's CLI, installed and authenticated — `opencode auth login` for `opencode`,
  `codex login` for `codex`. Not needed at setup time if you are writing a global config for a machine
  where the tool is not installed yet; the skill falls back to typing the model name by hand
- `jq`, used by the config resolver

## Related

- [execute](./execute.md) -- the skill this configures
- [delegate](./delegate.md) -- the manual path, which needs no configuration
