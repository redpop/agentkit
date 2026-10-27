# Mod switcher (`ak-mods`)

Turns AgentKit mods on or off for the current chat, and draws the one band they share.

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

## Band

`ak-mods` owns one band above the prompt for all AgentKit mods. Each switched-on mod contributes
one short segment: a text, a tone, and at most one button. A button runs the mod's slash command,
so pressing it does what the command does. With no switched-on mod showing a segment, there is no
band.

When the segments do not fit the width, the band degrades in steps:

1. All segments fit: one row.
2. They do not fit: two rows, never more.
3. They still do not fit: the segments with the lowest priority drop out, and a `+N` chip ends the
   band. Pressing the chip opens the Mods pane.

The Mods pane then names the dropped mods in a dim line, `N mods do not fit the band: …`, so you can
switch some off. The pane counts with the band's width as `/ak-mods` last ran: the terminal's, less
the five columns of the band's `[-]`. The chip and that line are the only signals; there is no
toast.

On the desktop app the footer label is the path: `ak-mods` appends one label to the footer with the
segments' texts joined by ` · `, one line only. A segment with a button ends with the button's
slash command (`/keepwarm`), which is how you act there. Segments that do not fit drop out the same
way and the label ends with `+N`. The footer's width (60 characters) is provisional until it is
checked on the desktop app.

## Session rules

- A new chat starts with the standard mods on and all others off.
- `/clear` returns to that starting set.
- A resumed chat gets its own switches back, at launch or with `/resume` in a running session,
  including after a `/clear` earlier in it.
- Standard marks are global, not per chat.
- Only AgentKit mods are listed: installed from `ak-marketplace` or loaded with `--plugin-dir`.
  The `ak-` name prefix decides only when the source is unknown.

## What off means

- The mod draws nothing, and its segment leaves the band.
- Its own slash command turns it on.
- Its model tools are registered once it is switched on. After a switch-off a tool stays
  registered but is deferred with a note that the mod is off, and answers a call that the mod is
  off in this chat.
- Its agent types are hidden.

Without `ak-mods`, a mod runs as on (fail-open) and draws its own single band instead of a
segment. The contract a mod follows is in
[Writing an AgentKit mod](../writing-a-mod.md).

## Tests

```bash
claude plugin test plugins/ak-mods
claude plugin test plugins/ak-mods/tests/fixture
```

The second command loads the fixture mod without `ak-mods` and proves it fails open.
