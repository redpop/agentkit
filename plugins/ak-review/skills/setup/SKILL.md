---
name: setup
description: This skill should be used when the user asks to "set up ak-review:execute", "configure the external review tool", "which model should execute use", when /ak-review:execute reports no tool or model is configured, or when they want to change that configuration.
---

# Set Up External Review

Walk the user through configuring `/ak-review:execute`, then write the config file and prove it
resolves. **Always interactive, and never runs a review.**

No configuration ships with this plugin, deliberately: defaulting would pick someone's coding-agent
CLI and model for them, and an update would silently change it. This skill is how that choice gets
made — by the user, once, in a minute.

## Arguments

Parse `$ARGUMENTS`:

| Flag | Effect |
|------|--------|
| `--global` | Skip the scope question; write `~/.claude/ak-review.local.json` |
| `--project` | Skip the scope question; write `.claude/ak-review.local.json` |

Everything else is a question. That is the point of this skill — the values are the user's choices,
not the plugin's.

## Workflow

### Phase 1: Scope (skip if `--global` or `--project` was passed)

Ask where the configuration should live:

- **Global** — `~/.claude/ak-review.local.json`. The default, and the file to copy to another
  machine (a remote server, a second laptop) to carry the same setup.
- **Project** — `.claude/ak-review.local.json`, this repository only. Overrides the global file.

### Phase 2: Check for an existing configuration

Read the file that will be written to (determined by Phase 1). If it exists, show its current
contents and ask whether to **replace** it or **cancel**. Do not proceed without an answer,
and never overwrite silently. If the *other* scope's file exists (project when configuring global,
or global when configuring project), mention it without asking about it, and note that the project
file overrides the global one.

### Phase 3: Tool

Discover the implemented adapters:

```bash
ls ${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/*-adapter.sh
```

The tool name is the filename minus `-adapter.sh`. The filesystem is the registry — do not keep a
list anywhere. If no adapters are found, **stop immediately**: report that this installation has no
external review adapters, so there is nothing to configure. If exactly one adapter exists, state
which one is being configured rather than asking a question with one possible answer. If several
exist, ask.

### Phase 4: Model

Check whether the adapter has a model lister:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-models.sh
```

**If the script does not exist:** this adapter offers no automatic model listing. Tell the user so,
then ask them to type the model identifier themselves. Name the format the adapter expects — for
`opencode`, that is `provider/model`. Do not suggest a specific model.

**If the script exists:** run it to list the models. Present the list and let the user choose. If
the list is long, group or summarise it — but the value must come from that output, never from a
suggestion of your own. **Do not recommend a specific model.** If the script fails, show its stderr
and stop: a config naming a model the tool does not have is worse than no config.

### Phase 5: Fix threshold

Ask, proposing `high`:

- `critical` / `high` — only findings that are confirmed *and* at least this severe are changed
  automatically. `high` is the recommended default.
- `medium` / `low` — more gets fixed unattended, and more of it will be wrong. Findings at these
  levels are disproportionately matters of taste, and a reviewer is least reliable there.

### Phase 6: Effort (optional)

Ask whether to pin a reasoning-effort level for the adapter, offering to skip. For `opencode` this
becomes `--variant` (e.g. `high`); leaving it unset uses the tool's own default.

### Phase 7: Write and verify

Write the file:

```json
{
  "external_review": {
    "tool": "<chosen>",
    "model": "<chosen>",
    "effort": "<chosen, or omit the key entirely if skipped>",
    "fix_threshold": "<chosen>"
  }
}
```

Then read the file back from disk and prove it resolves, from the repository root:

```bash
ls -l <absolute path to the file>
cat <absolute path to the file>
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/resolve-config.sh
```

Show the resolved JSON. If it does not resolve, the file is wrong — fix it before reporting success.
Writing a config without proving it resolves is how a typo ships.

### Phase 8: Report

Show the user, concretely, what now exists — they should never have to go looking for it:

1. **The absolute path**, expanded — `/Users/you/.claude/ak-review.local.json`, not
   `~/.claude/ak-review.local.json`. A tilde is ambiguous when several accounts or a remote server
   are in play, and this file's whole purpose is being copied between machines.
2. **The file's actual contents**, `cat`-ed back from disk in Phase 7 — not a reproduction of what
   was meant to be written. The point is to show what is really there; those two differ exactly when
   something went wrong, which is the case worth catching.
3. **The resolved result** from `resolve-config.sh`, which proves the file is not merely present but
   valid and reachable.
4. **What each value does**, in one line each — a user who is shown four keys they did not choose
   understandingly will not touch the file again.

If the file is project-local, remind the user to gitignore it — it is machine- and account-specific.
If it is global, say in one line that this is the file to copy to another machine.

Then state what to run next: `/ak-review:execute --report-only` for a first supervised run.

## Notes

- This skill never runs a review and never calls a paid model. Listing models is free.
- It writes exactly one file and changes nothing else.
- To change a single value later, editing the JSON directly is usually faster than re-running this.

## Related

- [execute](../execute/SKILL.md) -- the skill this configures; its no-config message points here
- [delegate](../delegate/SKILL.md) -- the manual, supervised path that needs no configuration at all
