# Break (`ak-pause`)

Shows how long you have worked without a break, counted across every session, as one segment.

Requires Claude Code 2.1.309 or later (hooks-module support). Switched per chat in the
[Mods pane](../ak-mods/switcher.md).

## Why

Working with Claude Code makes long stretches at the screen easy: there is always a next prompt.
The segment keeps the stretch in view, and the mod speaks up when you are waiting anyway, never
while you type.

## Band

The mod shows one segment in the band that [`ak-mods`](../ak-mods/switcher.md) draws above the
prompt, once there has been an input:

| Minutes in the block | Tone | Segment |
| --------- | --------- | --------- |
| 10 or more without input | dim | `Pause` |
| 0 to 49 | text colour | `23 min am Stück` |
| 50 to 59 | info | `52 min am Stück` |
| 60 to 89 | warning | `1 h 12 am Stück` |
| 90 and more | error | `1 h 35 am Stück` |

On the desktop app the time is a ring that fills to an hour, beside the duration: `◔ 23 min`. When
the band is short of room, the segment drops `am Stück`. The segment has priority 4: when the band
runs out of room it goes before usage (7) and GitLab (6).

Two hints join the segment when due:

- **Water**, 45 minutes after the last: `· Wasser`, with a **Getrunken** button that clears it. A
  break clears it as well.
- **Late**, from 22:00 local time: `· Feierabend?`, dim.

A press on the segment's text opens the Mods pane at this mod, whose card lists when the block
started, the last break and its length, the breaks today, the longest block today and the last
water.

Without `ak-mods` (or when it refuses the mod, or a publish fails), the mod draws its own band
instead, never both, with the same parts and colours.

The mod's texts follow Claude Code's `language` setting, else `LC_ALL`, `LC_MESSAGES` or `LANG`:
German or English. In English the segment reads `23 min straight`, the hints `Water` and
`Call it a day?`.

## Hints

Once a block, and across sessions once in all, the mod nudges at a moment that does not break the
flow:

- **After a turn**, from 60 minutes: a toast, `1 h 01 am Stück. Guter Moment für eine Pause.`
- **During a long turn**, from 50 minutes: when a turn of the main loop has run for 3 minutes, a
  native notification, `Claude arbeitet noch. 54 min am Stück: guter Moment für eine Pause.` A
  subagent's turn does not count.

Whichever comes first is the block's one hint. Switched off, the mod sends none.

## How it works

- An input is a prompt sent, or typing in the prompt box (`prompt.edit`). A turn Claude runs on its
  own is not one: whoever leaves during a long task has had a break.
- The block lives in the mod's own store, a JSON file under Claude Code's configuration directory
  that every session of the mod reads and writes. A prompt sent writes it at once, typing at most
  once a minute. A store that cannot be read shows nothing.
- Ten minutes after the last input the block is over. The next input starts a new one and counts
  the break; an input on another day starts that day's tally empty.
- The segment is drawn again every minute while the mod is on, after each input, after `/clear`,
  `/resume` and `/branch`, and when the mod is switched on.
- Nothing of it reaches Claude's context: no text in the conversation, no tool.

## Credit

Other break reminders for Claude Code exist: one writes its reminders into the conversation,
another adds weather to the context at session start, a third sends you away while Claude works.
This mod keeps out of the context and uses Claude's own rhythm instead. No code is taken over.
