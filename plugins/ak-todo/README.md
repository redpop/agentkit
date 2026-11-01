# ak-todo

Tasks and notes for one session that you and Claude both keep. A mod: a pane beside the chat and one
segment in the shared band above the prompt (`5 open  4 notes`, each with its icon). Needs
`ak-mods`, which installs with it, switches the mod on or off per chat and draws the band.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Install

```text
/plugin install ak-todo@ak-marketplace
```

## Use

- `/todo <text>` adds a task, `/note <text>` a note. Both answer at once, also while Claude works,
  and never interrupt its turn. `/todo` alone opens or closes the pane.
- `/todo sel` and `/note sel`, or **Take selection** in the pane, add the text you selected in the
  chat.
- A task is work to do; a note is something Claude keeps in mind for this session.
- Claude reads the list with every prompt. It adds tasks for what it sets aside, may change, finish,
  move or defer your entries, but never removes them. It asks before it starts on a task.
- **Do now** asks Claude to work on a task; **Discuss** puts `About item T2 (…):` into the prompt box
  for you to finish.
- The list belongs to this conversation: it comes back when you reopen or resume the session.
  `/clear` starts an empty one.
- Off by default, `/todo detect on` lets a small model add open items from Claude's answers.

See [the mod docs](../../docs/mods/ak-todo/todo.md).

## Development

```bash
claude plugin validate plugins/ak-todo
claude plugin test plugins/ak-todo
```
