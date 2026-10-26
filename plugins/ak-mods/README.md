# ak-mods

Mod switcher for Claude Code. A mod changes Claude Code's own interface: a band above the prompt,
a pane, a status entry, a slash command. `ak-mods` lists every AgentKit mod in a **Mods** pane and
turns each on or off for the current chat.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Install

```text
/plugin install ak-mods@ak-marketplace
```

## Use

Run `/ak-mods` to open the pane. Each mod has three buttons:

- **○ Off** / **● On** switches the mod for this chat; the label shows its state.
- **☆ Standard** / **★ Standard** marks or unmarks the mod to start on in every new chat; the
  filled star means it is marked.
- **More / Less** shows or hides the mod's details.

## Rules

- Switches reset in a new chat and after `/clear`. They are kept when a chat is resumed,
  at launch or with `/resume`.
- Standard marks are global: they apply to every chat.
- Only AgentKit mods are listed: installed from `ak-marketplace` or loaded with `--plugin-dir`.
  The `ak-` name prefix decides only when the source is unknown.
- An off mod draws nothing. Its own slash command turns it on. Its tools are registered once it is
  switched on; after a switch-off they stay registered but are deferred with a note that the mod is
  off, and answer a call with that message. Its agent types are hidden.
- A mod without `ak-mods` installed runs as on (fail-open).

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
