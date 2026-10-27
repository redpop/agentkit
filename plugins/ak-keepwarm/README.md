# ak-keepwarm

Keeps this chat's prompt cache warm. A mod: it draws a band above the prompt and answers
`/keepwarm`. Needs `ak-mods`, which installs with it and switches the mod on or off per chat.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Install

```text
/plugin install ak-keepwarm@ak-marketplace
```

## Use

- `/keepwarm` keeps the cache warm for 4 hours; `/keepwarm 2` for 2 hours (at most 24).
- `/keepwarm off` stops it. `/keepwarm` with no argument stops it while it runs.
- The band above the prompt shows the cache state, the context size and what a rewrite would cost,
  with a **keep warm** / **stop warm** button (key `1`).

See [the mod docs](../../docs/mods/ak-keepwarm/keepwarm.md).

## Credit

Based on the keepwarm part of Cache Keeper by Nate Herk (MIT, see [LICENSE](LICENSE)). The board,
the cold-send guard and the handoff of the original are not part of this mod.

## Development

```bash
claude plugin validate plugins/ak-keepwarm
claude plugin test plugins/ak-keepwarm
```
