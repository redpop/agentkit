---
name: setup
description: This skill should be used when the user asks to "set up ak-review:execute", "configure the external review tool", "which model should execute use", "which models can I choose from", "what is currently configured", when /ak-review:execute reports no tool or model is configured, or when they want to see or change that configuration.
---

# Set Up External Review

Walk the user through configuring `/ak-review:execute`, then write the config file and prove it
resolves. **Never runs a review.** Interactive by default: every value not supplied as a flag is
asked, and `--show` only reports.

No configuration ships with this plugin, deliberately: defaulting would pick someone's coding-agent
CLI and model for them, and an update would silently change it. This skill is how that choice gets
made — by the user, once, in a minute.

## Arguments

Parse `$ARGUMENTS`:

| Flag | Effect |
|------|--------|
| `--show` | Report what is configured and what is available, then **stop**. Writes nothing |
| `--global` | Skip the scope question; write `~/.claude/ak-review.local.json` |
| `--project` | Skip the scope question; write `.claude/ak-review.local.json` |
| `--tool <name>` | Use this adapter instead of asking |
| `--model <model>` | Use this model instead of asking |
| `--effort <level>` | Use this effort instead of asking |
| `--fix-threshold <level>` | Use this threshold instead of asking |

**Any value not supplied as a flag is still a question.** The values remain the user's choices, not
the plugin's — a flag only means the user has already made that choice, so asking again would be
noise. `/ak-review:setup` with no arguments behaves exactly as it always has: a full interactive walk.

Two things never become flags: this skill never invents a model, and it never skips the write
verification in Phase 7. Speed is worth removing questions for, not proof.

## Workflow

**Ask and report in the language of the invoking session** — the same rule `/ak-review:execute`
follows for its summary. Whatever is still asked, is asked in the language the person is working in
— and `--show`'s report follows the same rule. Only the conversation follows the session: file contents, key
names and values are written exactly as specified here and are never translated.

### Phase 0: Show (only if `--show` was passed — then stop)

Report the current state and stop. **Write nothing, ask nothing, change nothing.** This exists so
checking what is configured, or what a tool offers, is free of consequences — the rest of this skill
always writes, which makes it the wrong instrument for a look.

Report, in this order:

1. **What is configured now.** Run, from the repository root:

   ```bash
   ${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/resolve-config.sh
   ```

   Show the resolved JSON and **say which layer each value came from** — `cat` both
   `.claude/ak-review.local.json` and `~/.claude/ak-review.local.json` (naming the absolute path of
   the global one) so the precedence is visible rather than asserted. If the script exits non-zero,
   nothing is configured: show its message, which already explains what to do, and continue to step 2
   rather than stopping — the point of `--show` is to be informative when the setup is incomplete.

2. **Which adapters exist**, discovered from the filesystem, never from a list kept here:

   ```bash
   ls ${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/*-adapter.sh
   ```

3. **Which models are available**, for each adapter that can say. Run `<tool>-models.sh` where it
   exists. Where it does not, state that the tool offers no non-interactive listing and that the model
   must be typed — do not fill the gap with models of your own. Name the format each adapter expects
   (`provider/model` for `opencode`, a bare name for `codex`, an alias or full name for `claude`); a
   value in the wrong shape is rejected
   mid-run, long after this point.

If the listing is long, summarise or group it, but keep full identifiers visible — the reader's next
step is copying one into a command.

Close by showing how to use a value without changing anything, and how to make it permanent:

```bash
/ak-review:execute --report-only --tool <tool> --model <model> --effort <level>
/ak-review:setup --global --tool <tool> --model <model> --effort <level>
```

Then **stop**. Do not fall through into the phases below.

### Phase 1: Scope (skip if `--global` or `--project` was passed)

Ask where the configuration should live:

- **Global** — `~/.claude/ak-review.local.json`. The default, and the file to copy to another
  machine (a remote server, a second laptop) to carry the same setup.
- **Project** — `.claude/ak-review.local.json`, this repository only. Overrides the global file.

### Phase 2: Check for an existing configuration

Read the file that will be written to (determined by Phase 1). If it exists, show its current
contents and ask whether to **replace** it or **cancel**. Do not proceed without an answer,
and never overwrite silently. If the _other_ scope's file exists (project when configuring global,
or global when configuring project), mention it without asking about it, and note that the project
file overrides the global one.

**When a scope flag and every value came in as flags**, the replacement was already authorised — the
user spelled out what they want written — so do not ask. **Still show the previous contents**, before
and after, so the change is visible and reversible. "Do not ask" and "do not show" are different
things, and only the first is implied by a flag: a value silently replaced is a value that cannot be
put back, which is the failure this phase exists to prevent.

### Phase 3: Tool (skip the question if `--tool` was passed)

**If `--tool` was passed**, verify that `<tool>-adapter.sh` actually exists before accepting it. A
typo'd adapter name would otherwise be written to the config and only surface when
`/ak-review:execute` fails to find it. If it does not exist, say so, list what does, and stop —
do not fall back to asking, because the user's stated intent was unambiguous and guessing past a typo
is how the wrong tool gets configured.

Discover the implemented adapters:

```bash
ls ${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/*-adapter.sh
```

The tool name is the filename minus `-adapter.sh`. The filesystem is the registry — do not keep a
list anywhere. If no adapters are found, **stop immediately**: report that this installation has no
external review adapters, so there is nothing to configure. If exactly one adapter exists, state
which one is being configured rather than asking a question with one possible answer. If several
exist, ask.

### Phase 4: Model (skip the question if `--model` was passed)

**If `--model` was passed**, take it as given and skip the listing entirely — do not spend a tool call
proving a choice the user already made. Still apply the shape check at the end of this phase, which
costs nothing and catches the common paste error.

Check whether the adapter has a model lister:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/execute/scripts/<tool>-models.sh
```

**If the script does not exist:** this adapter offers no automatic model listing. Tell the user so,
then ask them to type the model identifier themselves. Name the format the adapter expects, which is
**per-adapter** — read its entry in `execute`'s Adapter Reference rather than assuming:

- `opencode` — `provider/model`: a provider name (e.g. `opencode-go`), a slash, then the model name.
- `codex` — a bare model name, with **no** provider prefix and no slash. Codex has no model listing
  command, so this branch is the only path for it.
- `claude` — a Claude Code alias (`opus`, `sonnet`, `fable`) or a full model name such as
  `claude-opus-5`. Claude Code has no listing command either, so this branch covers it too.

Do not suggest a specific model.

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

**Before writing, in either branch:** confirm the chosen value has the shape the _resolved adapter_
expects — `provider/model` for `opencode`, a bare name for `codex`, an alias such as `opus` or a full
model name for `claude`. A model lister's output format is
the tool's own and is not guaranteed to already match. If the chosen entry does not have the expected
shape, ask the user to confirm the exact string to write rather than assuming the listed line is it.

### Phase 5: Fix threshold (skip the question if `--fix-threshold` was passed)

Ask, proposing `high`:

- `critical` / `high` — only findings that are confirmed _and_ at least this severe are changed
  automatically. `high` is the recommended default.
- `medium` / `low` — more gets fixed unattended, and more of it will be wrong. Findings at these
  levels are disproportionately matters of taste, and a reviewer is least reliable there.

### Phase 6: Effort (optional; skip the question if `--effort` was passed)

Ask whether to pin a reasoning-effort level for the adapter, offering to skip. Leaving it unset uses
the tool's own default. The accepted values are the tool's, not this skill's:

- `opencode` — becomes `--variant` (e.g. `high`).
- `codex` — becomes `-c model_reasoning_effort=…`, one of `none`, `minimal`, `low`, `medium`, `high`,
  `xhigh`, `max`.

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
- It writes at most one file and changes nothing else — and with `--show`, no file at all.
- To change a single value later, pass it as a flag — `/ak-review:setup --global --tool codex
  --model gpt-5.6-sol --effort xhigh` rewrites the file in one step and still proves it resolves,
  which hand-editing the JSON does not.
- `--show` is the read-only counterpart: use it to see what is set and what a tool offers before
  deciding anything.

## Related

- [execute](../execute/SKILL.md) -- the skill this configures; its no-config message points here
- [delegate](../delegate/SKILL.md) -- the manual, supervised path that needs no configuration at all
