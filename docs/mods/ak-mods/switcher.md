# Mod switcher (`ak-mods`)

Turns AgentKit mods on or off for the current chat.

Requires Claude Code with hooks-module support (tested on 2.1.309).

## Command

`/ak-mods` opens the **Mods** pane.

## Pane

One row per mod that declared itself: title and summary, then three buttons.

| Button | Effect |
|--------|--------|
| On / Off | Switches the mod for this chat |
| Standard | Marks the mod to start on in every new chat |
| More / Less | Shows or hides the mod's details |

## Session rules

- A new chat starts with the standard mods on and all others off.
- `/clear` returns to that starting set.
- A resumed chat gets its own switches back, including after a `/clear` earlier in it.
- Standard marks are global, not per chat.
- Only AgentKit mods (`ak-` prefix, `ak-marketplace`) are listed.

## What off means

- The mod draws nothing.
- Its own slash command turns it on.
- Its model tools are registered only while it is on. After a switch-off a tool stays registered
  but is deferred and answers that the mod is off in this chat.
- Its agent types are hidden.

Without `ak-mods`, a mod runs as on (fail-open). The contract a mod follows is in
[Writing an AgentKit mod](../writing-a-mod.md).

## Tests

```bash
claude plugin test plugins/ak-mods
claude plugin test plugins/ak-mods/tests/fixture
```

The second command loads the fixture mod without `ak-mods` and proves it fails open.
