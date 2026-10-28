# Mod switcher (`ak-mods`)

Turns AgentKit mods on or off for the current chat, and draws the one band they share.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Command

`/ak-mods` opens the **Mods** pane, or closes it while it is the pane shown. A Mods pane behind
another tab is brought forward.

## Pane

One row per mod that declared itself: title and summary, then three buttons. A switched-on mod
that publishes a segment also shows it in its row, in its band colour and with the segment's
button, and its detail after it, dimmed; the pane draws on every surface, so this is where a
segment is always visible.

| Button | Effect |
|--------|--------|
| ○ Off / ● On | Switches the mod for this chat; the label shows its state |
| ☆ Standard / ★ Standard | Marks or unmarks the mod to start on in every new chat; ★ means marked |
| More / Less | Shows or hides the mod's details |

## Band

`ak-mods` owns one band above the prompt for all AgentKit mods. Each switched-on mod contributes one
short segment: a text, a tone, and at most one button. The text may come in parts, each in its own
tone, so a label sits dim beside its value. On the desktop app a segment may draw in a richer form:
runs as the parts are, any of them a ring filled to a share, such as `◔ 42% 5h`. The terminal draws
the text. With the pointer over a segment, the desktop app shows a card above it: the mod's title,
then its rows, labels dim in one column beside their values, or else its detail. A button runs the
mod's slash command, so pressing it does what the command does. The band ends with a `mods` button,
hotkey `m`, that does what `/ak-mods` does: it opens the Mods pane, or closes it while it is shown.
No mod's button takes the hotkey `m` in the band. With no switched-on mod showing a segment, there
is no band and no button; `/ak-mods` still opens the pane.

The band stays quiet at rest. Colour marks only what needs attention: `ok` draws in the text colour,
`warn` in the theme's warning colour, `alert` in its error colour, `info` in its suggestion colour,
and `dim` dimmed. The colours are theme keys, so they follow a light or a dark theme. A ring takes
the same tone in colours of its own, which follow the desktop app's light or dark appearance. Three
cells of space part the segments, with no rule between them. Digits draw at one width, so a figure
that counts down does not shift. The `mods` button sits dimmed at the right edge of the last row.

When the segments do not fit the width, the band degrades in steps:

1. All segments fit: one row.
2. They do not fit: two rows, never more.
3. They still do not fit: the segments with the lowest priority drop out, and the `mods` button
   counts them: `mods +2`.

The last row always keeps room for the button.

The Mods pane then names the dropped mods in a dim line, `N mods do not fit the band: …`, so you can
switch some off. The pane counts with the band's width as it was last recorded: pressing the `mods`
button records the band's own width, and `/ak-mods` records the terminal's, less the five columns of
the band's `[-]`. Before either, the pane counts with its own width. The button's count and that line
are the only signals; there is no toast.

The band draws on the terminal and on the desktop app. Every row of the Mods pane also shows its
mod's current segment and button, so a mod's state and its action are reachable on every surface.

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
