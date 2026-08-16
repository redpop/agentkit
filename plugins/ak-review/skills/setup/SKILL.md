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

**Ask and report in the language of the invoking session** — the same rule `/ak-review:execute`
follows for its summary. This is an interactive setup, so the person answering should be asked in
the language they are working in. Only the conversation follows the session: file contents, key
names and values are written exactly as specified here and are never translated.

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
`opencode`, that is `provider/model`: a provider name (e.g., `opencode-go`), then a slash, then
the model name. Do not suggest a specific model.

**Caution — in this branch, the typed value cannot be verified here**, because this adapter offers
no authoritative list. Repeat back the exact string the user gave, and ask them to confirm it before
it is written to the config file. If the value turns out wrong, the symptom will surface later when
`/ak-review:execute` runs the adapter and it rejects the model — so it is worth getting right now,
rather than debugging a failing review after the fact.

**If the script exists:** run it to list the models. Present the list and let the user choose. If
the list is long, group or summarise it — but ensure the user can unambiguously name a choice.
If grouping strips prefixes, keep the full identifier visible on each line, or number the entries
and invite a number. Show at least one real, complete example by quoting one line verbatim from the
script's own output, so the expected shape is concrete without naming a model of the skill's choosing.
If the user gives a bare model name that matches more than one provider in the list, show which
providers have it and ask which one they mean. The value must come from the output, never from a
suggestion. **Do not recommend a specific model.**

If the script fails, read its stderr. When it reports the tool itself is missing (as
`opencode-models.sh` does when `opencode` is not on PATH), do not hard-stop — this is exactly the
portable-global-file case Phase 1 advertises: writing a config on a machine where the tool is not
installed yet. Fall through to the same typed-entry flow as the "script does not exist" branch above,
with the same caution about being unable to verify the value here. If instead the stderr reports the
tool ran and the listing itself failed (e.g. `opencode models` erroring, an auth problem) — a real
listing error, not a missing binary — show it and stop: a config naming a model the tool does not
have is worse than no config.

**Before writing, in either branch:** confirm the chosen value looks like `provider/model` (a name,
one `/`, another name) — the shape `opencode` (and any adapter following the same convention) expects.
A model lister's output format is the tool's own and is not guaranteed to already look this way. If
the chosen entry does not have that shape, ask the user to confirm the exact string to write rather
than assuming the listed line is it.

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
```

Then resolve it. `resolve-config.sh` merges global → project → flags with the project layer winning,
so which call proves the file just written depends on which file Phase 1 wrote:

- **Wrote the global file:** pass `--project-config /dev/null`, so a project config elsewhere in this
  repo cannot win the merge and print values that don't match what was just `cat`-ed:

  ```bash
  ${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/resolve-config.sh --project-config /dev/null
  ```

- **Wrote the project file:** call it bare — the project layer winning over any global file is exactly
  what should be proven here:

  ```bash
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
   valid and reachable — and **say which layer supplied it**: "these are the values from the file just
   written" for a global write (verified with `--project-config /dev/null`), or "the project file's
   values win, per precedence" for a project write. Without that label, the `cat`-ed file and the
   resolved JSON sit side by side and can be misread as contradicting each other whenever a project
   config elsewhere in the repo differs from the global file just written.
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
