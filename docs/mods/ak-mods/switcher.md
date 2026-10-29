# Mod switcher (`ak-mods`)

Turns AgentKit mods on or off for the current chat, and draws the one band they share.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Command

`/ak-mods` opens the **Mods** pane, or closes it while it is the pane shown. A Mods pane behind
another tab is brought forward.

## Pane

One row per mod that declared itself. Its head is the title with a small triangle after it, `▸`
closed and `▾` open, as the desktop app's own cards have it, and on the right the standard star,
then the on/off switch; the summary follows. A switched-on mod that publishes a segment also shows
it below, in its band colour and with the segment's button, and its detail after it, dimmed; the
pane draws on every surface, so this is where a segment is always visible. A press on the triangle
opens the row's details; one row is open at a time, so opening one closes any other and the pane
stays short. In a narrow pane the title wraps and the star and the switch keep their size. On the
desktop app a segment with card rows shows no detail there: opened, the row lists the card's rows
under the segment, labels dim in one column, each value once, above the mod's details. There each
mod sits on a faint rounded surface of its own; the terminal parts the mods by space. A note on how
the switches reset ends the pane, small and dim.

| Button | Effect |
| -------- | -------- |
| ○ Off / ● On | Switches the mod for this chat; the label shows its state |
| ☆ / ★ | Marks or unmarks the mod to start on in every new chat; ★ means marked |
| ▸ / ▾ | Shows or hides the mod's details, and on the desktop app its card rows |

## Band

`ak-mods` owns one band above the prompt for all AgentKit mods. Each switched-on mod contributes one
short segment: a text, a tone, and at most one button. The text may come in parts, each in its own
tone, so a label sits dim beside its value. On the desktop app a segment may draw in a richer form:
runs as the parts are, any of them a ring filled to a share, such as `◔ 42% 5h`. The terminal draws
the text. On the desktop app the text of a segment with a card is a plain button, marked under the
pointer as buttons are: a press opens the Mods pane with that mod's row open alone and scrolled into
view, where the card's rows show, or else its detail. A second press closes the row and the pane.
The band cuts off what a mod draws outside it, so no card floats above it. A button runs the mod's
slash command, so pressing it does what the command does. The band ends with a `mods` button, hotkey
`m`, that does what `/ak-mods` does: it opens the Mods pane, or closes it while it is shown. No
mod's button takes the hotkey `m` in the band. With no switched-on mod showing a segment, there is
no band and no button; `/ak-mods` still opens the pane.

The band stays quiet at rest. Colour marks only what needs attention: `ok` draws in the text colour,
`warn` in the theme's warning colour, `alert` in its error colour, `info` in its suggestion colour,
and `dim` dimmed. On the terminal the colours are theme keys, so they follow a light or a dark theme;
the desktop app paints no theme key on text, so there the text takes fixed colours that read on
either appearance. A ring takes
the same tone in colours of its own, which follow the desktop app's light or dark appearance. Three
cells of space part the segments on the terminal, two on the desktop app, with no rule between them.
Digits draw at one width, so a figure that counts down does not shift. The `mods` button sits dimmed
at the right edge of the last row.

When the segments do not fit the width, the band degrades in steps:

1. All segments fit: one row.
2. They do not fit: every segment that has a compact form switches to it, the whole band together,
   and the band stays one row.
3. Compact, they still do not fit: two rows, never more.
4. They still do not fit: the segments with the lowest priority drop out, and the `mods` button
   counts them: `mods +2`.

A compact segment's button is its text on the desktop app, with no hotkey; the terminal leaves it
out, and the Mods pane keeps it. A segment without a compact form draws in full in every step.

The last row always keeps room for the button. Each segment counts as wide as it draws: on the
terminal its text, on the desktop app its rich runs, a ring or an icon as three cells, and a button
on its text adds nothing there.

The Mods pane then names the dropped mods in a dim line, `N mods do not fit the band: …`, so you can
switch some off. The pane counts with the band's width as it was last recorded: pressing the `mods`
button records the band's own width, and `/ak-mods` records the terminal's, less the five columns of
the band's `[-]`. Before either, the pane counts with its own width. The button's count and that line
are the only signals; there is no toast.

The band draws on the terminal and on the desktop app. Every row of the Mods pane also shows its
mod's current segment and button, so a mod's state and its action are reachable on every surface.

The pane, the band's `mods` button and the answers of `/ak-mods` follow Claude Code's `language`
setting, else `LC_ALL`, `LC_MESSAGES` or `LANG`: German or English. Each mod declares its title and
summary in that language at the start of the session.

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
