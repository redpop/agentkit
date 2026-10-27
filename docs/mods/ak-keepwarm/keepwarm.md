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

A band above the prompt, once the chat has made a request:

| Entry | Meaning |
|-------|---------|
| ◆ kept warm | Keep warm is on: pings so far, their cost, and when it ends |
| ● cache warm | Time left before the cache expires |
| ◐ cache cools | Under 5 minutes left |
| ○ cache cold | The cache expired; a ping cannot help, and the button is hidden |

The band also shows the context size and an estimate of what a rewrite costs. The **keep warm** /
**stop warm** button toggles the loop (key `1`).

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

## Cost

The pings are small model requests, sent only while keep warm is on. The cost estimate uses list
prices copied from the upstream mod; check them against the current pricing page.

## Credit

Based on Cache Keeper by Nate Herk (MIT). Only the keepwarm part is taken over.
