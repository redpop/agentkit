# ak-session-id

Copies this session's id, so an agent in another session can be told which one is meant. A mod: it
shows the id's end in the shared band above the prompt and answers `/session-id`. Needs `ak-mods`,
which installs with it, switches the mod on or off per chat and draws the band.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Install

```text
/plugin install ak-session-id@ak-marketplace
```

## Use

- `/session-id` copies the id: in the desktop app the `local_…` id the session tools address,
  elsewhere the engine id.
- `/session-id engine` copies the engine id even in the desktop app.
- Its segment in the band above the prompt shows the id's last six characters with a **copy**
  button (key `c`). Without `ak-mods` the mod draws its own band with the same button.

See [the mod docs](../../docs/mods/ak-session-id/session-id.md).

## Development

```bash
claude plugin validate plugins/ak-session-id
claude plugin test plugins/ak-session-id
```
