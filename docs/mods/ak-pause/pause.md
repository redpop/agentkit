# Break (`ak-pause`)

Shows how long you have worked without a break, counted across every session, as one segment.

Requires Claude Code 2.1.309 or later (hooks-module support). Switched per chat in the
[Mods pane](../ak-mods/switcher.md).

## In short

- **The time** (`4 min am Stück`) is how long you have worked without a break. The ring beside it
  fills to an hour.
- **What counts as work** on macOS is any input at the machine: the mouse, the keyboard or the
  trackpad, in any app. On Linux and Windows it is only what you do in Claude: sending a prompt, or
  typing in the prompt box without sending it. There, fifteen minutes in your editor or browser
  alone look like a break. See [Platforms](#platforms).
- **Ten minutes** without input end the block: the segment shows `Pause`, and the next
  input starts again at 0. This is how the mod notices that you were away, not how long a break
  should be; it does not tell you that.
- **At 60 minutes** the colour turns to warning, and after Claude's next answer one toast suggests a
  break. From 50 minutes, a turn that runs for 3 minutes brings a notification instead. One hint
  per block, never while you type.
- **Water** joins 45 minutes after the block began or after you last drank. **Getrunken** clears it;
  a break does too.
- **The card** in the Mods pane, a press on the segment away, shows since when you work, the last
  break, today's breaks and longest block, and the last water.

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

- **Water**, 45 minutes after the last: `Wasser`, with a **Getrunken** button that clears it. A
  break clears it as well.
- **Late**, from 22:00 local time: `Feierabend?`, dim.

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

## Platforms

| System | What counts as input |
| --------- | --------- |
| macOS | Any mouse, keyboard or trackpad input, in any app, plus what you do in Claude |
| Linux, Windows | Only what you do in Claude |

On macOS the mod reads the system's idle time once a minute with `ioreg` (`HIDIdleTime`), which
needs no permission. Linux and Windows have no command that answers it on every machine: under
X11 it takes an extra tool, Wayland has no common interface, and Windows only answers through
PowerShell. There the mod counts the input in Claude alone, as before. Support for them may follow.

The idle time is the machine's that runs Claude Code. Over SSH that is the remote host, not the
one you sit at. Reading a long page or a call without touching the mouse counts as a break after
ten minutes.

## How it works

- An input is a prompt you send (at the terminal, through Remote Control or in the desktop app), or
  typing in the prompt box (`prompt.edit`). A background task's notification, a routine or `/loop`,
  or another agent's message is not one, and neither is a turn Claude runs on its own: whoever
  leaves during a long task has had a break. On macOS, input in any other app is one as well.
- No hint goes out within 5 seconds of a keystroke; the next quiet moment gets it.
- The block lives in the mod's own store, a JSON file under Claude Code's configuration directory
  that every session of the mod reads and writes. A prompt sent writes it at once, typing at most
  once a minute. A store that cannot be read shows nothing.
- On macOS the system's idle time is read once a minute while the mod is on, and at the session's
  start. A last input a minute or more newer than the block's moves it on, as an input in Claude
  does. Where `ioreg`
  does not answer, the mod stops asking until the next session.
- Ten minutes after the last input the block is over. The next input starts a new one and counts
  the break; an input on another day starts that day's tally empty.
- The segment is drawn again every minute while the mod is on, after each input, after `/clear`,
  `/resume` and `/branch`, and when the mod is switched on.
- Nothing of it reaches Claude's context: no text in the conversation, no tool.

## Credit

Other break reminders for Claude Code exist: one writes its reminders into the conversation,
another adds weather to the context at session start, a third sends you away while Claude works.
This mod keeps out of the context and uses Claude's own rhythm instead. No code is taken over.
