# ak-keepwarm

Keeps this chat's prompt cache warm. A mod: it shows its state in the shared band above the
prompt and answers `/keepwarm`. Needs `ak-mods`, which installs with it, switches the mod on or off
per chat and draws the band.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Install

```text
/plugin install ak-keepwarm@ak-marketplace
```

## Use

- `/keepwarm` keeps the cache warm for 4 hours; `/keepwarm 90m`, `2h30m` or `2` for a span of your
  own (at most 24 hours).
- `/keepwarm always` keeps every chat warm until 6 hours after its last turn, in later sessions too.
- `/keepwarm off` stops it and ends `always`. `/keepwarm` with no argument stops it while it runs.
- Keep warm survives a restart and a reload of the mod. A ping the API turns away as busy is sent
  again after 1, 2 and 4 minutes while it can still land.
- The Mods pane counts the pings and the rewrites of a lost cache, each with its cost.
- Its segment in the band above the prompt shows the cache state, and what a rewrite would cost
  while the cache cools or is cold, with a **keep warm** / **stop** button (key `1`). Without
  `ak-mods` the mod draws its own band, which also shows the context size.

See [the mod docs](../../docs/mods/ak-keepwarm/keepwarm.md).

## Credit

Based on the keepwarm part of Cache Keeper by Nate Herk (MIT, see [LICENSE](LICENSE)). The board,
the cold-send guard and the handoff of the original are not part of this mod. The saved window,
the busy-API retries, `always` and the rewrite count follow ideas from Cache Tax by karanb192; no
code is taken over.

## Development

```bash
claude plugin validate plugins/ak-keepwarm
claude plugin test plugins/ak-keepwarm
```
