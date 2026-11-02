# Todo (`ak-todo`)

Keeps one list of tasks and notes per session, which you and Claude both read and write, without
interrupting Claude's turn.

Requires Claude Code 2.1.309 or later (hooks-module support). Switched per chat in the
[Mods pane](../ak-mods/switcher.md).

## In short

- **A task** is work to do: open, being worked on, done, or set aside for later.
- **A note** is a short piece of text Claude keeps in mind for this session, a temporary memory. It
  is never done; you change or delete it.
- **You add** with `/todo` and `/note`, in the pane, or from text selected in the chat. Each answers
  at once, also while Claude works, and nothing interrupts its turn. Typing in the prompt box keeps
  its normal behaviour: nothing you type there becomes an entry by itself.
- **Claude reads** the list with every prompt, ids included, so the list survives a compaction. It
  adds tasks for what it sets aside, may change, finish, move and defer your entries, and never
  removes them: it asks you instead. It never adds back what you deleted.
- **Claude asks first.** At the end of a piece of work it names the open tasks and asks whether to
  go on. It starts on a task only when you ask, or press **Do now**.
- **The list belongs to the conversation.** Reopening or resuming the session brings it back.
  `/clear` starts a new conversation with an empty list; the old one returns if you resume that
  conversation.

## The pane

The pane opens on `/todo` alone and on the first entry of a conversation. Once you close it, it
opens only when you ask again, for the rest of the conversation.

- **Tasks:** open and running tasks first, then a folded **Later (n)** and a folded **Done (n)**:
  what waits is still to do, so it comes before what is finished. The numbers follow that order.
- **Notes** below, in their own order.
- Each row shows its number (`T1`, `N1`), its text and a dot in the owner's colour: one for your
  entries, one for Claude's.
- Row actions: ☐/☑ (done, open again), ↑ and ↓, **Do now**, **Discuss**, **Later**/**Back**,
  **Edit** and **Delete**; notes have ↑, ↓, **Discuss**, **Edit** and **Delete**. In a pane narrower
  than 40 columns the actions sit behind one `⋯` button per row.
- **Do now** marks the task as being worked on and asks Claude to work on it now. While Claude is
  busy, the request waits for its turn to end.
- **Discuss** writes `About item T2 (Fix login):` (in German `Zu Punkt T2 (Fix login):`) into the
  prompt box, after what is already there. Nothing is sent until you press Enter.
- At the top: a switch for **Task** or **Note**, **From selection**, and a field to add an entry;
  where the pane is narrow, **From selection** moves to a line of its own.
- The trash, when it holds entries: **Restore** per entry and **Empty trash**.

## Band

One segment in the band that [`ak-mods`](../ak-mods/switcher.md) draws above the prompt, once the
list has an entry. It reads like the other mods' segments: for the tasks a todo-list icon, a
figure and its label in dim beside it, and for the notes a note icon the same way, for example
`5 open  4 notes`. With no open task the task figure counts what waits for later (`1 later`), then
what is done. When the band is short of room the segment keeps the icons and the figures. The
terminal draws `5 open · 4 notes`, short of room `✓5 · ✎4`. A press on the text opens the pane,
which shows the rest; the mod's card in the Mods pane holds the **Todo** button, which opens the
pane and brings it forward, and the two detection settings. With an empty list the band shows
nothing, and the card still holds both.
Without `ak-mods` (or when it refuses the mod, or a publish fails) the mod draws the same text in a
band of its own, never both.

## Commands

`N` is a number as the pane shows it: `T3` for a task, `N2` for a note; a bare `3` means `T3`.
A subcommand counts only when its arguments fit, so `/todo done the docs` adds a task. A command
that changes an entry echoes it (`Done: T3 Fix login`), so a number that moved under you shows at
once.

| Command | What it does |
| --------- | --------- |
| `/todo` | Open or close the pane |
| `/todo <text>`, `/note <text>` | Add a task, a note |
| `/todo sel`, `/note sel` | Add the text selected in the chat |
| `/todo done N`, `/todo undo N` | Mark a task done, open again |
| `/todo later N` | Set a task aside for later, or bring it back |
| `/todo move N M` | Move an entry to position `M` among its kind |
| `/todo edit N <text>` | Change an entry's text |
| `/todo rm N` | Delete an entry (it goes to the trash) |
| `/todo ask N <text>` | Send `<text>` with entry `N` quoted under it |
| `/todo trash`, `/todo restore <n>` | List the trash, bring back entry `<n>`, its number in that list |
| `/todo clear done` | Put every done task in the trash |
| `/todo detect on`, `/todo detect off` | Switch automatic detection |
| `/todo model haiku`, `/todo model sonnet` | Choose the detection model |

## Claude's side

- A tool `todo` (`mcp__ak-todo__todo`) with the actions `list`, `add`, `update`, `done`, `remove`
  and `move`. Claude addresses entries by id. Removing one of your entries is refused with the
  answer that Claude should ask you; adding a text you deleted is refused too.
- With every prompt the current list goes to Claude as context the transcript does not show, and
  with it one line per change you made since its last turn. An empty list sends only the rule to add
  work Claude sets aside. The list is headed as reference only, with the rules that Claude starts a
  task only when you ask, does not interrupt its work for a new entry, adds work it sets aside as a
  task and, once a piece of work is done, names the open tasks and asks whether to continue; your
  changes are headed as no request.
- A short instruction in the system prompt says how to use the list. Where an organization manages
  Claude Code and does not allow the mod that, the pane, commands and tool still work, and the rules
  in the list's heading still reach Claude.
- Switched off in a chat, the tool answers that the mod is off, no list or instruction reaches
  Claude, the pane closes and the segment goes. Switched on again, the same list returns.

## Detection

Off by default. When on, after each of Claude's answers a small model (`haiku`, or `sonnet`) looks
for work the answer set aside and questions it left open, and adds up to five as Claude's tasks.
What matches an entry already in the list is skipped. A call that fails or answers something odd
adds nothing and shows nothing. The switch and the model apply to every session: `/todo detect on`
or `off`, `/todo model haiku` or `sonnet`, or the two pickers in the mod's card in the Mods pane.

## Keeping the list

- The list is held in the session and stored under the conversation's id, so a restart, a hot
  reload and a compaction keep it.
- An entry holds at most 500 characters on one line, a conversation at most 100 entries, the trash
  the last 50.
- Every text you delete is remembered for the conversation, so Claude cannot add it back. Restoring
  it from the trash lifts that.
- Lists untouched for 30 days are dropped at a session start. When the store is full, the lists of
  other conversations touched longest ago go first; if that is not enough, the change is not saved
  and a toast says so.
- A fork of a conversation (`/branch` in the terminal) starts with an empty list.
