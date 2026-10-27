# Keep warm (`ak-keepwarm`)

Keeps the chat's prompt cache warm, so the next message does not rewrite the whole context.

Requires Claude Code 2.1.309 or later (hooks-module support). Switched per chat in the
[Mods pane](../ak-mods/switcher.md); `/keepwarm` turns the mod on.

## Why

Every request re-reads the whole context. From the cache that costs about a tenth of normal input.
Once the cache expires (1 hour idle on a subscription, 5 minutes on the default API TTL), the next
message writes the whole context again at 1.25x to 2x input. A cache read restarts the timer, so a
small ping shortly before expiry costs a fraction of a rewrite.

## Command

| Command | Effect |
|---------|--------|
| `/keepwarm` | Starts keep warm for 4 hours; stops it while it runs |
| `/keepwarm <hours>` | Starts it for that many hours (at most 24) |
| `/keepwarm off` | Stops it |

## Band

The mod shows its state as one segment in the band that [`ak-mods`](../ak-mods/switcher.md) draws
above the prompt, once the chat has made a request:

| Segment | Meaning |
|---------|---------|
| `◆ kept warm · 3 pings $0.02 · until 3:00pm` | Keep warm is on: pings so far, their cost, and when it ends |
| `● cache warm 42m` | Time left before the cache expires |
| `◐ cools in 4m · rewrite ≈ $0.42` | Under 5 minutes left, and what a rewrite of the context would cost |
| `○ cold 12m · rewrite ≈ $0.42` | The cache expired that long ago; a ping cannot help, and the button is hidden |

The **keep warm** / **stop warm** button toggles the loop (key `1`); it runs `/keepwarm`. On the
desktop app the segment is part of the footer label and ends with `/keepwarm` while it has a button
(not when cold). The context size is
not shown, so a mod about tokens can own that figure.

Without `ak-mods` (or when it refuses the mod, or a publish fails for good), the mod draws its own
band instead, never both. That band shows the same states (`◐ cache cools in 4m`,
`○ cache cold 12m`), the context size and the rewrite estimate, with the same button.

## How it works

- Each main-loop request tells whether it read or rewrote the cache. A rewrite after 5 to 60 idle
  minutes shows a 5-minute TTL; a hit after more than 5 idle minutes shows the 1-hour TTL. Until
  one of those is seen, the mod assumes 1 hour.
- Every 30 seconds the mod checks the clock. About 8 minutes (1-hour TTL) or 90 seconds (5-minute
  TTL) before expiry, and only while Claude is idle, it sends one ping: a fork of the chat that
  answers "ok".
- A ping that writes more than a tenth of what it reads did not hit the cache. Keep warm turns
  itself off and says why. So does a ping that gets no answer.
- Switching the mod off, `/clear`, `/resume` and `/branch` stop keep warm. The cache after those is
  unknown.
- The segment is published when it changes: after a request, on the 30-second check, after
  `/keepwarm`, and after the mod is switched on. Switched off, it publishes nothing; `ak-mods`
  clears the segment.

## Cost

The pings are small model requests, sent only while keep warm is on. The cost estimate uses list
prices copied from the upstream mod; check them against the current pricing page.

## Credit

Based on Cache Keeper by Nate Herk (MIT). Only the keepwarm part is taken over.
