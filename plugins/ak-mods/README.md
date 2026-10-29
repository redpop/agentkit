# ak-mods

Mod switcher for Claude Code. A mod changes Claude Code's own interface: a segment in the band
above the prompt, a pane, a status entry, a slash command. `ak-mods` lists every AgentKit mod in a
**Mods** pane, turns each on or off for the current chat, and draws the one band they share.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Install

```text
/plugin install ak-mods@ak-marketplace
```

## Use

Run `/ak-mods` to open the pane, and again to close it. Each mod's head has three controls:

- **○ Off** / **● On** switches the mod for this chat; the label shows its state.
- **☆** / **★** marks or unmarks the mod to start on in every new chat; the filled star means it
  is marked.
- **▶** / **▼** after the title shows or hides the mod's details.

Each switched-on mod shows one segment in a single band above the prompt. The band ends with a
`mods` button (hotkey `m`) that opens the pane, or closes it while it is shown. When the segments do
not fit, every segment with a compact form switches to it, then the band grows to two rows, then
drops the lowest-priority segments, and the button counts them: `mods +2`. The pane then names the
mods that do not fit. With no segment there is no band, and `/ak-mods` is the way in. The band draws
on the terminal and the desktop app. Every row of the pane also shows its mod's current segment and
button, on every surface.

## Rules

- Switches reset in a new chat and after `/clear`. They are kept when a chat is resumed,
  at launch or with `/resume`.
- Standard marks are global: they apply to every chat.
- Only AgentKit mods are listed: installed from `ak-marketplace` or loaded with `--plugin-dir`.
  The `ak-` name prefix decides only when the source is unknown.
- An off mod draws nothing, and its segment leaves the band. Its own slash command turns it on.
  Its tools are registered once it is switched on; after a switch-off they stay registered but are
  deferred with a note that the mod is off, and answer a call with that message. Its agent types
  are hidden.
- A mod without `ak-mods` installed runs as on (fail-open) and draws its own single band.

See [the switcher docs](../../docs/mods/ak-mods/switcher.md) and
[Writing an AgentKit mod](../../docs/mods/writing-a-mod.md).

## Development

```bash
claude plugin validate plugins/ak-mods
claude plugin test plugins/ak-mods
claude plugin test plugins/ak-mods/tests/fixture
```

The second test command proves the fixture mod fails open with `ak-mods` absent.
`tests/fixture/` is a test-only harness (version 0.0.0), not part of the marketplace.
