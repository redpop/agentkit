import { update as updateState } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { applyCommand, parseCommand } from './command'
import type { Applied, Cmd } from './command'
import { EMPTY_CONTEXT, SECTION, SECTION_ID, joinNotes, listContext, unsent } from './context'
import { DETECT_SYSTEM, detectPrompt, parseDetected } from './detect'
import { languageFor, learnLanguage, texts } from './i18n'
import { add, clean, emptyList, emptyTrash, normalise, numbered, resolve, update } from './list'
import type { Entry, Kind, Numbered, TodoList } from './list'
import { conversationId, loadList, loadSettings, parseList, pruneStale, saveList, saveSettings } from './store'
import { TOOL, applyTool } from './tool'
import { segmentOf } from './view'
import type { Segment } from './view'

const NAME = 'ak-todo'
const TOOL_NAME = 'mcp__ak-todo__todo'
const LIST = { plugin: 'ak-todo', key: 'list' } as const
const CONVERSATION = { plugin: 'ak-todo', key: 'conversation' } as const
const PENDING = { plugin: 'ak-todo', key: 'pending' } as const
const PANE_CLOSED = { plugin: 'ak-todo', key: 'isPaneClosed' } as const
const PANE_OPEN = { plugin: 'ak-todo', key: 'isPaneOpen' } as const
const VIEW = { plugin: 'ak-todo', key: 'view' } as const
const VIEW_START: { editing?: number; kind: Kind; open: string[]; menu?: number; added?: number } = { kind: 'task', open: [] }
// The add and edit fields' height: in a column box a field of several lines spans the pane on the
// desktop app, where a one-line field keeps its own narrow width.
const FIELD_ROWS = 3
// Claude's mark on its own entries: a fixed colour on the desktop app, where theme keys may draw grey.
const CLAUDE_COLOUR = { desktop: '#d97757', other: 'claude' } as const
// The change lines kept for Claude between two prompts.
const MAX_PENDING = 20

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those.

/** The list as the session holds it; empty when none is held or it has a bad shape. */
async function listOf($: EngineInterface): Promise<TodoList> {
  const { value } = await $.state.get(LIST)

  return parseList(value) ?? emptyList(await $.clock.now())
}

/**
 * Follows the conversation: when its id is not the one the held list belongs to (a start, a
 * resume, a /clear), loads that conversation's list, empty when none is stored. A stored value of
 * a bad shape is left as it is until the first change overwrites it.
 */
async function follow($: EngineInterface): Promise<string> {
  const id = await conversationId($)
  const { value } = await $.state.get(CONVERSATION)
  if (value === id) return id
  const list = (await loadList($, id)) ?? emptyList(await $.clock.now())
  await $.state.set(LIST, list)
  await $.state.set(PENDING, [])
  await $.state.set(PANE_CLOSED, false)
  await $.state.set(CONVERSATION, id)

  return id
}

/** Opens the pane: when asked, always; on its own (a first entry), unless the person closed it in this conversation. */
async function openPane($: EngineInterface, isAsked: boolean): Promise<void> {
  const { value: isClosed = false } = await $.state.get(PANE_CLOSED)
  if (!isAsked && isClosed) return
  // Asked for, the pane comes to the front too; opened on its own, it leaves the keys where they are.
  const { isPlaced } = await $.ui.open({ id: 'ak-todo', title: texts(await languageFor($)).title, ...(isAsked ? { focus: true as const } : {}) })
  // A pane no surface placed is not open: the next /todo opens it rather than closing it.
  await $.state.set(PANE_OPEN, isPlaced)
  if (isAsked) await $.state.set(PANE_CLOSED, false)
}

/** `/todo` alone: opens the pane, or closes it when it is open. */
async function togglePane($: EngineInterface): Promise<void> {
  const { value: isOpen = false } = await $.state.get(PANE_OPEN)
  if (isOpen) await $.ui.close({ id: 'ak-todo' })
  else await openPane($, true)
}

/**
 * Every change of the list goes through here: follows the conversation first, applies `change` to
 * the list as it stands at the write (again on a write that lost to another), stores it under the
 * conversation the list belongs to, queues the person's change note for Claude, and opens the pane
 * on a first entry. With `only`, nothing happens unless the list is that conversation's. Answers the
 * reply of the change.
 */
async function mutate($: EngineInterface, change: (list: TodoList, now: number) => Applied, only?: string): Promise<string> {
  const id = await follow($)
  // A change meant for one conversation is dropped once another holds the list.
  if (only !== undefined && id !== only) return ''
  const now = await $.clock.now()
  const out: { applied: Applied; wasEmpty: boolean } = { applied: { reply: '' }, wasEmpty: false }
  await updateState($, LIST, value => {
    const list = parseList(value) ?? emptyList(now)
    out.wasEmpty = list.entries.length === 0
    out.applied = change(list, now)

    return 'list' in out.applied ? out.applied.list : list
  })
  const applied = out.applied
  if (!('list' in applied)) return applied.reply
  const note = applied.note
  if (note !== undefined) await updateState($, PENDING, value => [...(value ?? []), note].slice(-MAX_PENDING))
  if (!(await saveList($, id, applied.list))) await $.ui.toast(texts(await languageFor($)).storeFull)
  $.ui.invalidate('ui.render')
  if (out.wasEmpty && applied.list.entries.length > 0) await openPane($, false)

  return applied.reply
}

/** The number an entry has in `list` now, or undefined once it is gone. */
function refIn(list: TodoList, id: number): string | undefined {
  const { tasks, notes } = numbered(list)

  return [...tasks, ...notes].find(n => n.entry.id === id)?.ref
}

/** The segment for the held list. */
async function segmentNow($: EngineInterface): Promise<Segment> {
  return segmentOf(await listOf($), await languageFor($), await loadSettings($))
}

/**
 * The detection pass: asks the small model for what the answer leaves open and adds each as
 * Claude's task, skipping what the list holds. A failed or odd reply adds nothing and says nothing.
 */
async function detect($: EngineInterface, answer: string, conversation: string): Promise<boolean> {
  const settings = await loadSettings($)
  if (!settings.detect || answer.trim() === '') return false
  let reply: string
  try {
    const done = await $.model.complete({ model: settings.model, system: DETECT_SYSTEM, prompt: detectPrompt(answer, await listOf($)) })
    if (!done.isAnswered) return false
    reply = done.text
  } catch {
    return false
  }
  const found = parseDetected(reply)
  const out = { isChanged: false }
  // Applied to the list as it stands now: the person may have changed it while the model ran.
  await mutate($, (current, now) => {
    let list = current
    for (const text of found) {
      if (list.entries.some(e => normalise(e.text) === normalise(text))) continue
      const result = add(list, { kind: 'task', text, owner: 'claude' }, now)
      if ('error' in result) continue
      list = result.list
    }
    out.isChanged = list !== current

    return out.isChanged ? { list, reply: '' } : { reply: '' }
  }, conversation)

  return out.isChanged
}

/** The trash as the person reads it, newest first. */
async function trashText($: EngineInterface): Promise<string> {
  const t = texts(await languageFor($))
  const { trash } = await listOf($)

  return trash.length === 0 ? t.trashEmpty : [t.trashHeader, ...trash.map((e, i) => `${i + 1}. ${e.text}`)].join('\n')
}

/** Runs a `/todo` or `/note` command and answers the reply. */
async function runCommand($: EngineInterface, cmd: Cmd): Promise<string> {
  const lang = await languageFor($)
  const t = texts(lang)
  await follow($)
  if (cmd.kind === 'toggle') {
    await togglePane($)

    return ''
  }
  // The band's segment and the button in the Mods card: open the pane and go there, never close it.
  if (cmd.kind === 'show') {
    await openPane($, true)

    return ''
  }
  if (cmd.kind === 'trash') return trashText($)
  if (cmd.kind === 'detect') {
    await saveSettings($, { ...(await loadSettings($)), detect: cmd.isOn })

    return cmd.isOn ? t.detectOn : t.detectOff
  }
  if (cmd.kind === 'model') {
    await saveSettings($, { ...(await loadSettings($)), model: cmd.alias })

    return t.modelSet(cmd.alias)
  }
  if (cmd.kind === 'bad-model') return t.models
  if (cmd.kind === 'sel') {
    const selection = await $.ui.selection()
    if (!selection || selection.text.trim() === '') return t.nothingSelected

    return runCommand($, { kind: 'add', entry: cmd.entry, text: selection.text })
  }
  if (cmd.kind === 'ask') {
    const entry = resolve(await listOf($), cmd.ref)
    const ref = cmd.ref.toUpperCase().replace(/^(\d)/, 'T$1')
    if (!entry) return t.notFound(ref)
    // Off the command's hook: submitted from inside it, the prompt would wait on the turn it holds.
    // The person asked for it: their own words, without the frame a plugin's prompt carries.
    const text = `${cmd.text}\n\n> ${ref} ${entry.text}`
    $.clock.after(0, () => {
      $.prompt.submit({ text, asUser: true }).catch(() => {})
    })

    return t.asked(ref)
  }
  return mutate($, (list, now) => applyCommand(list, cmd, now, lang))
}


/** The pane's view state. */
async function viewOf($: EngineInterface): Promise<typeof VIEW_START> {
  const { value } = await $.state.get(VIEW)

  return value ?? VIEW_START
}

async function setView($: EngineInterface, patch: Partial<typeof VIEW_START>): Promise<void> {
  await $.state.set(VIEW, { ...(await viewOf($)), ...patch })
}

/** Opens or closes a fold of the pane (`done`, `later`, `trash`). */
async function toggleFold($: EngineInterface, fold: string): Promise<void> {
  const { open } = await viewOf($)
  await setView($, { open: open.includes(fold) ? open.filter(f => f !== fold) : [...open, fold] })
}

/** A pane button that is a command: runs it as `/todo` would, and publishes. */
async function pressCommand($: EngineInterface, cmd: Cmd, republish: () => void): Promise<void> {
  await runCommand($, cmd)
  republish()
}

/**
 * A row's button: the command for the entry with `id`, numbered as the list stands at the press,
 * so a number that moved since the pane was drawn still names the row pressed.
 */
async function pressEntry($: EngineInterface, id: number, make: (ref: string) => Cmd, republish: () => void): Promise<void> {
  const lang = await languageFor($)
  await mutate($, (list, now) => {
    const ref = refIn(list, id)

    return ref === undefined ? { reply: '' } : applyCommand(list, make(ref), now, lang)
  })
  republish()
}

/** **Do now**: the task is being worked on, and Claude is asked to work on it. */
async function doNow($: EngineInterface, id: number, republish: () => void): Promise<void> {
  const out: { ref?: string; text?: string } = {}
  await mutate($, (list, now) => {
    const result = update(list, id, { status: 'doing' }, now)
    if ('error' in result) return { reply: '' }
    out.ref = refIn(result.list, id)
    out.text = result.entry.text

    return { list: result.list, reply: '' }
  })
  republish()
  if (out.ref === undefined || out.text === undefined) return
  const text = texts(await languageFor($)).workOn(out.ref, out.text)
  // Off the press: while a turn runs, the engine queues the prompt. The person pressed it: their own
  // words, without the frame a plugin's prompt carries.
  $.clock.after(0, () => {
    $.prompt.submit({ text, asUser: true }).catch(() => {})
  })
}

/** **Discuss**: a draft about the entry in the prompt box, after what is there; nothing is sent. */
async function discuss($: EngineInterface, ref: string, text: string): Promise<void> {
  const draft = texts(await languageFor($)).draft(ref, clean(text))
  const box = await $.prompt.read()
  if (box.text.trim() === '') await $.prompt.fill({ text: draft })
  else await $.prompt.fill({ text: '\n' + draft, mode: 'append' })
}

async function clearTrash($: EngineInterface): Promise<void> {
  await mutate($, (list, now) => (list.trash.length === 0 ? { reply: '' } : { list: emptyTrash(list, now), reply: '' }))
}

export const register: Register = on => {
  // Whether ak-mods switches this mod: false once its declare was refused or
  // threw (no ak-mods loaded, or it failed). Then the mod runs on.
  let isSwitched = true
  // Counts this mod's switch changes, so a republish scheduled for one change
  // is dropped once another followed it.
  let switches = 0

  // Off only when ak-mods switches the mod and says so. A call that throws
  // leaves the mod on (fail-open).
  const isOff = async (isOn: () => Promise<boolean>): Promise<boolean> => {
    if (!isSwitched) return false
    try {
      return !(await isOn())
    } catch {
      return false
    }
  }

  // Publishes while ak-mods switches the mod and it is on. A publish that
  // throws hands the drawing back to the mod's own band (fail-open).
  const publish = async (isOn: () => Promise<boolean>, send: () => Promise<void>) => {
    if (!isSwitched || (await isOff(isOn))) return
    try {
      await send()
    } catch {
      isSwitched = false
    }
  }

  on('session.start', async ($, e, next) => {
    const t = texts(await learnLanguage($))
    try {
      isSwitched = await $.mods.declare({ name: NAME, title: t.title, summary: t.summary, details: t.details })
    } catch {
      isSwitched = false
    }
    await $.command.register({ name: 'todo', description: 'Tasks for this session: /todo <text> adds one; /todo alone shows the list' })
    await $.command.register({ name: 'note', description: 'Notes for this session: /note <text> adds one' })
    // The tool exists only once the mod is on: here, or when it is switched on.
    if (!(await isOff(() => $.mods.isOn({ name: NAME })))) await $.tool.register(TOOL)
    await pruneStale($, await $.clock.now())
    await follow($)
    await publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segmentNow($)))

    return next(e)
  })

  // /clear and a resume end the chat and go on under another id, with no
  // session.start for a /clear: load that conversation's list once the end
  // has passed, and publish again (ak-mods clears every segment with it).
  on('session.end', async ($, e, next) => {
    $.clock.after(0, () => {
      follow($)
        .then(() => publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segmentNow($))))
        .then(() => $.ui.invalidate('ui.render'))
        .catch(() => {})
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  // The mod's own band, drawn only while ak-mods does not switch the mod.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isSwitched) return next(e)
    const segment = await segmentNow($)
    if (segment.isPaneOnly === true) return next(e)
    const { Text } = $.ui.resolve(e)

    return <Text>{segment.text}</Text>
  })

  // Both commands turn the mod on, then do what they were asked; they answer at once, also while
  // Claude works.
  for (const command of ['todo', 'note'] as const) {
    on('command.run', { command }, async ($, e) => {
      if (await isOff(() => $.mods.isOn({ name: NAME }))) await $.mods.set({ name: NAME, on: true })
      const text = await runCommand($, parseCommand(command, e.args))
      // Off the hook: a pick in the Mods card runs this inside ak-mods' own call, where a segment
      // call resolves without reaching ak-mods.
      $.clock.after(0, () => {
        publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segmentNow($))).catch(() => {})
      })

      // `/todo` alone opens or closes the pane: nothing to say beside it.
      return text === '' ? {} : { text }
    })
  }

  // The list and the person's changes reach Claude beside each prompt, never as typed text.
  on('prompt.submit', async ($, e, next) => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) return next(e)
    // The id a /clear or resume moved to may have arrived only now.
    await follow($)
    const { value: pending = [] } = await $.state.get(PENDING)
    const blocks = [listContext(await listOf($)) ?? EMPTY_CONTEXT, joinNotes(pending)].filter((b): b is string => b !== undefined)
    const done = await next({ ...e, context: [...(e.context ?? []), ...blocks] })
    if (done.drop === undefined && pending.length > 0) await updateState($, PENDING, value => unsent(value ?? [], pending))

    return done
  }).catch(($, e, next) => next(e))

  on('prompt.compose', async ($, e, next) => {
    const done = await next(e)
    if (await isOff(() => $.mods.isOn({ name: NAME }))) return done

    return { sections: [...done.sections, { id: SECTION_ID, text: SECTION, scope: 'session' }] }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: TOOL_NAME }, async ($, e) => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) {
      return { result: `${NAME} is off in this chat. The person can turn it on with /ak-mods.` }
    }
    const out = { isChanged: false }
    const text = await mutate($, (list, now) => {
      const answer = applyTool(list, e, now)
      out.isChanged = answer.list !== undefined

      return answer.list ? { list: answer.list, reply: answer.text } : { reply: answer.text }
    })
    if (out.isChanged) await publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segmentNow($)))

    return { result: text }
  }).catch(($, e, next) => next(e))

  // The model's view while off: a tool registered earlier waits behind ToolSearch.
  on('tool.describe', { tool: TOOL_NAME }, async ($, e, next) =>
    (await isOff(() => $.mods.isOn({ name: NAME }))) ? { description: 'Off in this chat. Do not call it.', isDeferred: true } : next(e),
  )


  // After an answer of the main loop, and only with detection switched on, the small model looks
  // for open items, off the hook so the answer is not held.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined || e.isAborted || e.reason !== 'answer') return done
    if (await isOff(() => $.mods.isOn({ name: NAME }))) return done
    const answer = e.answer
    // The answer belongs to the conversation that held the list when it ended.
    const conversation = await follow($)
    $.clock.after(0, () => {
      detect($, answer, conversation)
        .then(isChanged => (isChanged ? publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segmentNow($))) : undefined))
        .catch(() => {})
    })

    return done
  }).catch(($, e, next) => next(e))

  // The person's close keeps the pane closed for the conversation; any close marks it closed.
  on('ui.close', async ($, e, next) => {
    if (e.id === NAME) {
      await $.state.set(PANE_OPEN, false)
      if (e.origin.kind === 'person') await $.state.set(PANE_CLOSED, true)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: NAME }, async ($, e, next) => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) return next(e)
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    // A surface without a text field edits and adds through /todo and /note.
    const Input = 'Input' in elements ? elements.Input : undefined
    const t = texts(await languageFor($))
    const list = await listOf($)
    const view = await viewOf($)
    const { tasks, notes } = numbered(list)
    const isTerminal = e.surface === 'terminal'
    const claude = e.surface === 'desktop' ? CLAUDE_COLOUR.desktop : CLAUDE_COLOUR.other
    const republish = () => {
      publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segmentNow($))).catch(() => {})
    }
    const command = (cmd: Cmd) => () => void pressCommand($, cmd, republish)
    const onEntry = (id: number, make: (ref: string) => Cmd) => () => void pressEntry($, id, make, republish)

    const active = tasks.filter(n => n.entry.status !== 'done' && n.entry.isDeferred !== true)
    const done = tasks.filter(n => n.entry.status === 'done')
    const later = tasks.filter(n => n.entry.status !== 'done' && n.entry.isDeferred === true)

    // As the Mods pane groups a mod: on a surface that draws pictures a faint surface of its own,
    // rounded and edged by a hairline; the terminal parts by space.
    const card = isTerminal
      ? { marginBottom: 1 }
      : { marginBottom: 1, paddingX: 1, paddingY: 1, borderStyle: 'round', borderColor: 'rgba(127,127,127,0.22)', backgroundColor: 'rgba(127,127,127,0.06)' }

    // One entry. Closed it is one quiet line: the check for a task, the text with a Claude mark
    // under it, the number the commands take, and the triangle that opens it. Open (one row at a time, as the
    // Mods pane's cards) it sits on a card with its actions: the frequent ones framed, moving as
    // arrows, deleting last and apart.
    const row = ({ ref, entry }: Numbered, group: Numbered[]) => {
      const id = entry.id
      const at = group.findIndex(n => n.entry.id === id)
      const isTask = entry.kind === 'task'
      const isDone = entry.status === 'done'
      const isOpen = view.menu === id
      const isEditing = isOpen && view.editing === id && Input !== undefined

      return (
        <Box key={`row-${id}`} flexDirection="column" {...(isOpen ? card : { marginBottom: isTerminal ? 0 : 'xs' })}>
          {/* A text over several lines: the check, the number and the triangle stay at its first. */}
          <Box key={`line-${id}`} flexDirection="row" alignItems="flex-start" columnGap={1}>
            {isTask && (
              <Button key={`${isDone ? 'undo' : 'done'}-${id}`} label={isDone ? '☑' : '☐'} plain dimColor={isDone} onPress={onEntry(id, now => ({ kind: isDone ? 'undo' : 'done', ref: now }))} />
            )}
            {/* Claude's mark under the text, not beside it: there it took the text's width. */}
            <Box flexDirection="column" flexGrow={1} flexShrink={1}>
              <Text dimColor={isDone} strikethrough={isDone}>
                {clean(entry.text)}
              </Text>
              {entry.owner === 'claude' && (
                <Text size="caption" color={claude}>
                  Claude
                </Text>
              )}
            </Box>
            <Text size="caption" dimColor tabular>
              {ref}
            </Text>
            <Button key={`open-${id}`} label={isOpen ? '▼' : '▶\uFE0E'} plain dimColor onPress={() => void setView($, { menu: isOpen ? undefined : id, editing: undefined })} />
          </Box>
          {/* Edited on a line of its own under the head: the desktop app draws an Input at its own
              width, and beside the number and the triangle it would push them out of the pane. */}
          {isEditing && Input && (
            // A column, as the showcase's multi-line field sits in one: a row box draws its child at
            // the child's own width, a column stretches it across.
            <Box key={`edit-box-${id}`} flexDirection="column" marginTop={1}>
              <Input key={`text-${id}`} value={entry.text} rows={FIELD_ROWS} submitLabel={t.save} autoFocus onSubmit={(value: string) => void pressEntry($, id, now => ({ kind: 'edit', ref: now, text: value }), republish).then(() => setView($, { editing: undefined }))} />
            </Box>
          )}
          {isOpen && (
            <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1} rowGap={1} marginTop={1}>
              {isTask && !isDone && entry.isDeferred !== true && <Button key={`do-${id}`} label={t.doNow} variant="primary" onPress={() => void doNow($, id, republish)} />}
              <Button key={`discuss-${id}`} label={t.discuss} onPress={() => void discuss($, ref, entry.text)} />
              {isTask && !isDone && (
                <Button key={`later-${id}`} label={entry.isDeferred ? t.backLabel : t.laterLabel} onPress={onEntry(id, now => ({ kind: 'later', ref: now }))} />
              )}
              {Input && !isEditing && <Button key={`edit-${id}`} label={t.edit} onPress={() => void setView($, { editing: id })} />}
              {at > 0 && <Button key={`up-${id}`} label="↑" plain onPress={onEntry(id, now => ({ kind: 'move', ref: now, to: Number(now.slice(1)) - 1 }))} />}
              {at >= 0 && at < group.length - 1 && (
                <Button key={`down-${id}`} label="↓" plain onPress={onEntry(id, now => ({ kind: 'move', ref: now, to: Number(now.slice(1)) + 1 }))} />
              )}
              <Box flexGrow={1} />
              <Button key={`rm-${id}`} label={t.remove} plain onPress={onEntry(id, now => ({ kind: 'rm', ref: now }))} />
            </Box>
          )}
        </Box>
      )
    }
    // A section's head: its name and how many it holds, small and dim beside it.
    const head = (title: string, count: string) => (
      <Box flexDirection="row" alignItems="center" columnGap={1} marginBottom="xs">
        <Text bold>{title}</Text>
        <Text size="caption" dimColor>
          {count}
        </Text>
      </Box>
    )
    const fold = (name: string, label: string, rows: Numbered[]) =>
      rows.length === 0 ? null : (
        <Box key={`fold-box-${name}`} flexDirection="column" marginTop="xs">
          {/* The name first, the triangle after it, as the Mods pane's cards open; an en space between
              them, as a plain one draws too tight beside the glyph. */}
          <Button key={`fold-${name}`} label={`${label}\u2002${view.open.includes(name) ? '▼' : '▶\uFE0E'}`} plain dimColor onPress={() => void toggleFold($, name)} />
          {view.open.includes(name) && <Box flexDirection="column" marginTop="xs">{rows.map(n => row(n, rows))}</Box>}
        </Box>
      )
    const isNote = view.kind === 'note'
    const added = view.added ?? 0

    return (
      <Box flexDirection="column">
        {/* Capture first: what the pane is for. The kind as two choices side by side, the picked
            one framed; the selection beside them, short, and on a line of its own where the pane
            is too narrow for both; the field under them, emptied after each add. */}
        <Box flexDirection="column" {...card} marginBottom={2}>
          <Box key="kinds" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
            <Button key="kind-task" label={t.kindTask} plain={isNote ? true : undefined} dimColor={isNote} onPress={() => void setView($, { kind: 'task' })} />
            <Button key="kind-note" label={t.kindNote} plain={isNote ? undefined : true} dimColor={!isNote} onPress={() => void setView($, { kind: 'note' })} />
            <Box flexGrow={1} />
            <Button key="take-sel" label={t.takeSelection} plain onPress={command({ kind: 'sel', entry: view.kind })} />
          </Box>
          {Input && (
            // A column stretches the field across the card; a row would keep it at its own width.
            <Box key="new-box" flexDirection="column" marginTop={1}>
              <Input
                key={`new-${added}`}
                rows={FIELD_ROWS}
                placeholder={isNote ? t.notePlaceholder : t.taskPlaceholder}
                submitLabel={t.add}
                onSubmit={(value: string) => void pressCommand($, { kind: 'add', entry: view.kind, text: value }, republish).then(() => setView($, { added: added + 1 }))}
              />
            </Box>
          )}
        </Box>
        {tasks.length + notes.length === 0 && (
          <Text size="caption" dimColor>
            {t.nothingYet}
          </Text>
        )}
        {tasks.length > 0 && (
          <Box flexDirection="column" marginBottom={2}>
            {head(t.tasks, t.open(active.length))}
            {active.map(n => row(n, active))}
            {/* What waits for later is still to do: above what is done. */}
            {fold('later', t.laterFold(later.length), later)}
            {fold('done', t.doneFold(done.length), done)}
          </Box>
        )}
        {notes.length > 0 && (
          <Box flexDirection="column" marginBottom={2}>
            {head(t.notesHeader, String(notes.length))}
            {notes.map(n => row(n, notes))}
          </Box>
        )}
        {/* The trash is a footnote to the pane: small and dim until opened. */}
        {list.trash.length > 0 && (
          <Box flexDirection="column">
            <Button key="fold-trash" label={`${t.trashFold(list.trash.length)}\u2002${view.open.includes('trash') ? '▼' : '▶\uFE0E'}`} plain dimColor onPress={() => void toggleFold($, 'trash')} />
            {view.open.includes('trash') && (
              <Box flexDirection="column" marginTop="xs">
                {list.trash.map((entry: Entry, i) => (
                  <Box key={`trash-${i + 1}`} flexDirection="row" alignItems="center" columnGap={1}>
                    <Box flexGrow={1} flexShrink={1}>
                      <Text dimColor>{clean(entry.text)}</Text>
                    </Box>
                    <Button key={`restore-${i + 1}`} label={t.restore} plain onPress={command({ kind: 'restore', index: i + 1 })} />
                  </Box>
                ))}
                <Box marginTop="xs">
                  <Button key="empty-trash" label={t.emptyTrash} plain dimColor onPress={() => void clearTrash($).then(republish)} />
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>
    )
  })

  // This mod's switch changed, and the write landed: register or describe its tool afresh; when
  // on, publish its segment again (ak-mods cleared it at the switch-off); when off, close its pane.
  // The publish runs off this hook: from inside it, within ak-mods's `set`, a segment call
  // resolves without reaching ak-mods.
  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    const done = await next(e)
    const isOn = e.value[NAME] === true
    if (isSwitched && done.value?.isSet === true && isOn !== (e.previous?.[NAME] === true)) {
      const change = ++switches
      if (isOn) {
        await $.tool.register(TOOL)
        $.clock.after(0, () => {
          if (change !== switches) return
          publish(async () => true, async () => $.mods.segment(await segmentNow($))).then(() => $.ui.invalidate('ui.render'))
        })
      }
      $.ui.invalidate('tool.describe')
      if (!isOn) await $.ui.close({ id: NAME })
    }

    return done
  }).catch(($, e, next) => next(e))
}
