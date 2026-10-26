# Mod switcher (`ak-mods`)

Turns AgentKit mods on or off for the current chat.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Command

`/ak-mods` opens the **Mods** pane.

## Pane

One row per mod that declared itself: title and summary, then three buttons.

| Button | Effect |
|--------|--------|
| ○ Off / ● On | Switches the mod for this chat; the label shows its state |
| ☆ Standard / ★ Standard | Marks or unmarks the mod to start on in every new chat; ★ means marked |
| More / Less | Shows or hides the mod's details |

## Session rules

- A new chat starts with the standard mods on and all others off.
- `/clear` returns to that starting set.
- A resumed chat gets its own switches back, at launch or with `/resume` in a running session,
  including after a `/clear` earlier in it.
- Standard marks are global, not per chat.
- Only AgentKit mods are listed: installed from `ak-marketplace` or loaded with `--plugin-dir`.
  The `ak-` name prefix decides only when the source is unknown.

## What off means

- The mod draws nothing.
- Its own slash command turns it on.
- Its model tools are registered once it is switched on. After a switch-off a tool stays
  registered but is deferred with a note that the mod is off, and answers a call that the mod is
  off in this chat.
- Its agent types are hidden.

Without `ak-mods`, a mod runs as on (fail-open). The contract a mod follows is in
[Writing an AgentKit mod](../writing-a-mod.md).

## Tests

```bash
claude plugin test plugins/ak-mods
claude plugin test plugins/ak-mods/tests/fixture
```

The second command loads the fixture mod without `ak-mods` and proves it fails open.
