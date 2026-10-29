# ak-pause

Shows how long you have worked without a break, counted across every Claude Code session. A mod:
one segment in the shared band above the prompt, a ring that fills to an hour beside the time
(`52 min am Stück`). Needs `ak-mods`, which installs with it, switches the mod on or off per chat
and draws the band.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Install

```text
/plugin install ak-pause@ak-marketplace
```

## Use

- Ten minutes without input count as a break: the next input starts a new block. There is no
  button to press for it.
- The segment draws plain for the first 50 minutes, then in the info, warning (60) and error (90)
  colours.
- After 45 minutes a water hint joins, with a **Drank** button that clears it; from 22:00 a dim
  `Call it a day?`.
- Once a block it nudges at a quiet moment: a toast after a turn from 60 minutes, or a notification
  while a turn has run for 3 minutes from 50.
- Nothing of it reaches Claude's context.

See [the mod docs](../../docs/mods/ak-pause/pause.md).

## Development

```bash
claude plugin validate plugins/ak-pause
claude plugin test plugins/ak-pause
```
