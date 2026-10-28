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
| `ctx ▰▰▰▱▱  5h ▰▰▱▱▱` | The context of this session is about 60 % full; about 40 % of the account's 5-hour window is used |
| `ctx ▰▱▱▱▱  5h ▰▱▱▱▱  7d ▰▰▰▰▱ 81%` | The 7-day window joins from 75 %, with its percentage |
| `ctx ▰▰▰▱▱` | No rate limit was reported, as with an API key |

Each figure is a bar of five cells, a cell a fifth of the window, filled to the nearest fifth. A
figure from 75 % adds its percentage, as it needs attention. The labels draw dim, each bar in its
own figure's colour: the text colour below 75 %, the warning colour from 75 %, the error colour from
90 %. The Mods pane adds every percentage after the bars, `· ctx 67% · 5h 42%`. The segment has
priority 7: it comes first in the band, before keep warm (6) and the session id (2), and when the
band runs out of room it is dropped last. It has no button.

Without `ak-mods` (or when it refuses the mod, or a publish fails), the mod draws its own band
instead, never both, with the same text and colour.

## How it works

- The figures come from `$.session.usage()`, the status line's own: the context's fill against the
  model's full window, and the rate-limit windows of the last API response. The call sends no
  request.
- The context is this session's. The rate-limit windows are the account's and count every session,
  but only as the last response of this session reported them. While you work in another session,
  this one shows the 5-hour figure from its own last response.
- The percentage is of the full window. Claude Code's own context notice counts against the
  auto-compact point, which is lower, so the two can differ.
- The segment is published at session start, after each main-loop turn (a subagent's turn does not
  change it), after `/clear`, `/resume` and `/branch`, and when the mod is switched on.

## Credit

Inspired by Token Weather from claude-code-playground (Anthropic, Apache-2.0). No code is taken
over: the weather, the chart and the token counts are left out for a compact line, and the rate
limits are added.
