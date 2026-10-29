# Session id (`ak-session-id`)

Copies this session's id, so an agent in another session can be told which one is meant.

Requires Claude Code 2.1.309 or later (hooks-module support). Switched per chat in the
[Mods pane](../ak-mods/switcher.md); `/session-id` turns the mod on.

## Why

Working with several sessions at once, you tell one session's agent about another: "ask session X
about …". Session names are not unique, and two sessions can carry the same one. The id is unique,
and the session tools find the session by it.

## Command

| Command | Effect |
|---------|--------|
| `/session-id` | Copies the id: in the desktop app the `local_…` id, elsewhere the engine id |
| `/session-id engine` | Copies the engine id, the one that names the transcript file, even in the desktop app |

The command answers with the id it copied, as text and as a toast. When no clipboard takes it, the
answer holds the whole id and the reason (`no-surface`, `no-clipboard`, `refused`), so it can be
copied by hand.

## Band

The mod shows one segment in the band that [`ak-mods`](../ak-mods/switcher.md) draws above the
prompt:

| Segment | Meaning |
|---------|---------|
| `id …4e5f6a` | The last six characters of the id the button copies, to tell sessions apart at a glance |

On the desktop app an id icon stands for the word: `# …4e5f6a`. With the pointer over the icon, a
card shows the desktop id and the engine id whole; outside the desktop app the engine id alone.
After a copy the segment says `✓ copied` for two seconds, then shows the id again.

The **copy** button (key `c`) runs `/session-id`. The segment has a low priority (2): when the band
runs out of room, it is dropped before the others. The band draws on the terminal and the desktop
app; the Mods pane shows the segment and its button in the mod's row on every surface.

Without `ak-mods` (or when it refuses the mod, or a publish fails), the mod draws its own band
instead, never both, with the same text and button.

The mod's texts follow Claude Code's `language` setting, else `LC_ALL`, `LC_MESSAGES` or `LANG`:
German or English. In German the button reads `kopieren`.

## How it works

- In the desktop app, the host's id comes from the environment variable
  `CLAUDE_CODE_HOST_SESSION_ID`. Where it is unset, the mod uses the engine id.
- `/clear`, `/resume` and `/branch` end the chat, and the engine id changes. The mod publishes its
  segment again once the end has passed.
- The line under the prompt is not used: the desktop app does not draw it, so the band is the one
  place both surfaces show.
