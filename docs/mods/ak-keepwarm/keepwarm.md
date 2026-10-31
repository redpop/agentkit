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
| `/keepwarm <span>` | Starts it for that span: `90m`, `2h30m`, `6h`, or bare hours such as `2` (at most 24 hours) |
| `/keepwarm always` | Keeps every chat warm until 6 hours after its last turn, here and in later sessions |
| `/keepwarm off` | Stops it and ends `always` |

Stopping keep warm by hand, with the command or the button, ends `always` too: else the next turn
would start it again.

## Band

The mod shows its state as one segment in the band that [`ak-mods`](../ak-mods/switcher.md) draws
above the prompt, once the chat has made a request:

| Segment | Meaning |
|---------|---------|
| `◆ kept warm` | Keep warm is on; when it ends, the start toast says |
| `◕ 42m` | Time left before the cache expires; the circle empties with it (`●` `◕` `◑` `◔`) |
| `◔ 4m  rewrite ≈ $0.42` | Under 5 minutes left, in the warning colour, and what a rewrite of the context would cost |
| `○ cold 12m  rewrite ≈ $0.42` | The cache expired that long ago; a ping cannot help, and the button is hidden |

On the desktop app the circle is a ring that empties with the time left, beside the time and the
word `cache`: `◕ 42m cache`. Kept warm, a flame in the info colour stands in its place; cold, the ring is empty.
Cooling, it says what is at stake: `cache drops in 4m  next message rewrites 200k tokens ≈ $0.80`.
Cold, it reads as its neighbours do, a value then a dim label: the empty ring, then what the next
message costs, `≈ $0.80 cache`, yellow from $1. How long it has been cold is the pane's.
A press on the segment's text opens the Mods pane at this mod, which lists the cache's state, its
lifetime, the context, the rewrite estimate and, once there are some, the pings, rewrites and
retries.

When the band is short of room, the segment turns compact: kept warm `◆ warm` (the flame and `warm`
on the desktop app), warm or cooling the ring and the time left (`◕ 42m`), cold the empty ring and
the rewrite cost (`○ ≈ $0.80`); on the desktop app the dim word `cache` follows either. While the
cache is warm or cooling, the compact text is the **keep warm** button: a press starts the loop,
with no key. Cold, a press opens the Mods pane: starting the loop then would rewrite the cache at
once.

In every state the Mods pane adds what this chat's cache cost so far, once there is something to
count: the pings and the rewrites of a cache that had been warm, each with its cost, `· 3 pings
$0.02 · 1 rewrite $0.80`. It also says when a ping waits for a retry (`ping retry 1 of 3`) or for
the next turn, and `always` while that is on.

The **keep warm** button starts the loop (key `1`); it runs `/keepwarm`. While the cache is kept
warm the band shows the state alone: stopping is seldom and never urgent, so the **stop** button
sits in the mod's row of the Mods pane, which the band's `mods` button (`m`) opens; the kept-warm
text draws in its colour there, which a press target on the desktop app would lose, so it is no
way in itself. `/keepwarm` stops it too. The band draws on the terminal
and the desktop app; the Mods pane shows the segment and its button in the mod's row on every
surface. The context size is not shown: the [Usage](../ak-usage/usage.md) mod shows how full it is.

Without `ak-mods` (or when it refuses the mod, or a publish fails for good), the mod draws its own
band instead, never both. That band shows the same states (`◐ cache cools in 4m`,
`○ cache cold 12m`), the context size and the rewrite estimate, with the same button.

The mod's texts follow Claude Code's `language` setting, else `LC_ALL`, `LC_MESSAGES` or `LANG`:
German or English. In German times read on a 24-hour clock and the segment says `◆ warm gehalten`;
the command and its arguments stay `/keepwarm always`, `/keepwarm off`.

## How it works

- Each main-loop request tells whether it read or rewrote the cache. A rewrite after 5 to 60 idle
  minutes shows a 5-minute TTL; a hit after more than 5 idle minutes shows the 1-hour TTL. Until
  one of those is seen, the mod assumes 1 hour.
- Every 30 seconds the mod checks the clock. About 8 minutes (1-hour TTL) or 90 seconds (5-minute
  TTL) before expiry, and only while Claude is idle, it sends one ping: a fork of the chat that
  answers "ok".
- A ping that reads nothing, or writes more than a tenth of what it reads, did not hit the cache.
  Keep warm turns itself off and says why. So does a ping that gets no answer.
- A ping the API turns away as busy (429, 529 or another 5xx) is sent again after 1, 2 and 4
  minutes, as long as it can still land a minute before the cache expires. Past that keep warm
  turns itself off.
- A request that writes most of a context the cache had held counts as a rewrite, at the write
  price of its model.
- Each chat's state is saved in the mod's store: when keep warm runs until, the last request, the
  TTL seen and the counts. A reload of the mod, a restart of Claude Code and a resume of the chat
  pick it up again. After a restart the process has no conversation to fork until the next turn,
  so a ping due before it waits for that turn instead of stopping. A chat idle for two days that
  keeps nothing warm is dropped from the store.
- `/clear` and switching the mod off stop keep warm. `/resume` and `/branch` leave the chat they
  end saved, so going back to it brings its keep warm back while the window runs.
- With `always` on, each main-loop turn moves the end of keep warm to 6 hours after it.
- The segment is published when it changes: after a request, on the 30-second check, after
  `/keepwarm`, and after the mod is switched on. Switched off, it publishes nothing; `ak-mods`
  clears the segment.

## Cost

The pings are small model requests, sent only while keep warm is on. The cost estimates use
Anthropic's list prices per model, including the long-prompt rates of Haiku 5.5 above 100K tokens.
A model the table does not know is priced as the newest of its family.

## Credit

Based on Cache Keeper by Nate Herk (MIT). Only the keepwarm part is taken over. The saved window,
the busy-API retries, `always` and the rewrite count follow ideas from Cache Tax by karanb192; no
code is taken over.
