# Usage (`ak-usage`)

Shows how full this session's context is and how much of the account's 5-hour limit is used, as one
compact segment.

Requires Claude Code 2.1.309 or later (hooks-module support). Switched per chat in the
[Mods pane](../ak-mods/switcher.md).

## Why

Two figures decide how much work is left: the context of the session at hand, and the 5-hour
limit, which every running session draws on. The segment keeps both in view without opening
`/context`.

## Band

The mod shows one segment in the band that [`ak-mods`](../ak-mods/switcher.md) draws above the
prompt, once a response has reported figures:

| Segment | Meaning |
| --------- | --------- |
| `ctx ▬▬▬▬▬  5h ▬▬▬▬▬`, three and two cells lit | The context of this session is about 60 % full; about 40 % of the account's 5-hour window is used |
| `ctx ▬▬▬▬▬  5h ▬▬▬▬▬  7d ▬▬▬▬▬ 81%  resets Sat 10:00am` | The 7-day window joins from 75 %, with its percentage and when it resets |
| `ctx ▬▬▬▬▬` | No rate limit was reported, as with an API key |

Each figure is a bar of five cells, a cell a fifth of the window, filled to the nearest fifth, and
one cell at least once anything is used: 7 % lights one cell, 0 % none. Filled and empty cells are
the same glyph, the empty ones dim, so the bar reads as one line in the terminal's font and the
desktop app's alike. A figure from 75 % adds its percentage, as it needs attention, and a window
adds when it resets, in local time, with the weekday when that is another day. The labels and the
reset draw dim, each bar's filled cells and percentage in its own figure's colour: the text colour
below 75 %, the warning colour from 75 %, the error colour from 90 %. The Mods pane adds every
percentage and reset after the bars, `· ctx 67% · 5h 42% (resets 11:10pm)`. The segment has priority
7: it comes first in the band, before keep warm (6) and the session id (2), and when the band runs
out of room it is dropped last. It has no button.

On the desktop app each figure draws as a ring filled to its percentage, with the percentage and the
label beside it: `◔ 67% ctx   ◔ 42% 5h`. A window from 75 % adds its reset there too. The ring and
the percentage take the figure's colour; the terminal keeps the bars. With the pointer over the
segment, a card lists the context and every window still current, the week below 75 % too, each
window with its reset.

Without `ak-mods` (or when it refuses the mod, or a publish fails), the mod draws its own band
instead, never both, with the same parts and colours.

The mod's texts follow Claude Code's `language` setting, else `LC_ALL`, `LC_MESSAGES` or `LANG`:
German or English. In German a reset reads on a 24-hour clock, `Reset 23:10`, `Reset Sa 10:00`;
`ctx`, `5h` and `7d` stay as they are.

## How it works

- The figures come from `$.session.usage()`, the status line's own: the context's fill against the
  model's full window, and the rate-limit windows of the last API response. The call sends no
  request.
- The context is this session's. The rate-limit windows are the account's and count every session,
  but only as the last response of this session reported them. While you work in another session,
  this one shows the 5-hour figure from its own last response.
- A window whose reset has passed leaves the band: its figure counted a window that is over. It
  returns with the next response, which reports the new one.
- A window at 90 % or more gets one toast, `5-hour limit at 92 %, resets 11:10pm`, and another only
  once it has reset and climbed past 90 % again. The toast comes from `session.measure`, when the
  engine reports that a window moved, so it needs no turn of its own. Switched off, the mod sends
  none.
- The percentage is of the full window. Claude Code's own context notice counts against the
  auto-compact point, which is lower, so the two can differ.
- The segment is published at session start, after each main-loop turn (a subagent's turn does not
  change it), after `/clear`, `/resume` and `/branch`, when the mod is switched on, and at the reset
  of a window it shows.

## Credit

Inspired by Token Weather from claude-code-playground (Anthropic, Apache-2.0). No code is taken
over: the weather, the chart and the token counts are left out for a compact line, and the rate
limits are added.
