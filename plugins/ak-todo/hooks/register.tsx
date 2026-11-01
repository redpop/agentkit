import type { EngineInterface, Register } from 'claude-code'

import { applyCommand, parseCommand } from './command'
import type { Cmd } from './command'
import { SECTION, SECTION_ID, joinNotes, listContext } from './context'
import { languageFor, learnLanguage, texts } from './i18n'
import { clean, emptyList, emptyTrash, numbered, resolve, update } from './list'
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
const VIEW_START: { editing?: number; kind: Kind; open: string[]; menu?: number } = { kind: 'task', open: [] }
// Below this many columns a row's actions sit behind one button.
const NARROW = 40
// The owner marks: a fixed colour on the desktop app, where theme keys may draw grey.
const OWNER_COLOURS = { desktop: { user: '#4889cd', claude: '#d97757' }, other: { user: 'permission', claude: 'claude' } } as const
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
async function follow($: EngineInterface): Promise<void> {
  const id = await conversationId($)
  const { value } = await $.state.get(CONVERSATION)
  if (value === id) return
  const list = (await loadList($, id)) ?? emptyList(await $.clock.now())
  await $.state.set(LIST, list)
  await $.state.set(PENDING, [])
  await $.state.set(PANE_CLOSED, false)
  await $.state.set(CONVERSATION, id)
}

/** Opens the pane: when asked, always; on its own (a first entry), unless the person closed it in this conversation. */
async function openPane($: EngineInterface, isAsked: boolean): Promise<void> {
  const { value: isClosed = false } = await $.state.get(PANE_CLOSED)
  if (!isAsked && isClosed) return
  await $.ui.open({ id: 'ak-todo', title: texts(await languageFor($)).title })
  await $.state.set(PANE_OPEN, true)
  if (isAsked) await $.state.set(PANE_CLOSED, false)
}

/** `/todo` alone: opens the pane, or closes it when it is open. */
async function togglePane($: EngineInterface): Promise<void> {
  const { value: isOpen = false } = await $.state.get(PANE_OPEN)
  if (isOpen) await $.ui.close({ id: 'ak-todo' })
  else await openPane($, true)
}

/** Holds and stores a changed list; `note` is queued for Claude when the person made the change. */
async function keep($: EngineInterface, list: TodoList, note?: string): Promise<void> {
  const wasEmpty = (await listOf($)).entries.length === 0
  await $.state.set(LIST, list)
  if (note !== undefined) {
    const { value = [] } = await $.state.get(PENDING)
    await $.state.set(PENDING, [...value, note].slice(-MAX_PENDING))
  }
  if (!(await saveList($, await conversationId($), list))) await $.ui.toast(texts(await languageFor($)).storeFull)
  $.ui.invalidate('ui.render')
  if (wasEmpty && list.entries.length > 0) await openPane($, false)
}

/** The segment for the held list. */
async function segmentNow($: EngineInterface): Promise<Segment | undefined> {
  return segmentOf(await listOf($), await languageFor($))
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
  const now = await $.clock.now()
  if (cmd.kind === 'toggle') {
    await togglePane($)

    return ''
  }
  if (cmd.kind === 'trash') return trashText($)
  if (cmd.kind === 'detect') {
    await saveSettings($, { ...(await loadSettings($)), detect: cmd.isOn })

    return cmd.isOn ? t.detectOn : t.detectOff
  }
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
    const text = `${cmd.text}\n\n> ${ref} ${entry.text}`
    $.clock.after(0, () => {
      $.prompt.submit({ text }).catch(() => {})
    })

    return t.asked(ref)
  }
  const applied = applyCommand(await listOf($), cmd, now, lang)
  if ('list' in applied) await keep($, applied.list, applied.note)

  return applied.reply
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
async function pressCommand($: EngineInterface, cmd: Cmd, republish: () => Promise<void>): Promise<void> {
  await runCommand($, cmd)
  await republish()
}

/** **Do now**: the task is being worked on, and Claude is asked to work on it. */
async function doNow($: EngineInterface, id: number, republish: () => Promise<void>): Promise<void> {
  const list = await listOf($)
  const result = update(list, id, { status: 'doing' }, await $.clock.now())
  if ('error' in result) return
  const ref = numbered(result.list).tasks.find(n => n.entry.id === id)?.ref ?? ''
  await keep($, result.list)
  await republish()
  const text = texts(await languageFor($)).workOn(ref, result.entry.text)
  // Off the press: while a turn runs, the engine queues the prompt.
  $.clock.after(0, () => {
    $.prompt.submit({ text }).catch(() => {})
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
  await keep($, emptyTrash(await listOf($), await $.clock.now()))
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
    if (!segment) return next(e)
    const { Text } = $.ui.resolve(e)

    return <Text>{segment.text}</Text>
  })

  // Both commands turn the mod on, then do what they were asked; they answer at once, also while
  // Claude works.
  for (const command of ['todo', 'note'] as const) {
    on('command.run', { command }, async ($, e) => {
      if (await isOff(() => $.mods.isOn({ name: NAME }))) await $.mods.set({ name: NAME, on: true })
      await follow($)
      const text = await runCommand($, parseCommand(command, e.args))
      await publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segmentNow($)))

      return { text }
    })
  }

  // The list and the person's changes reach Claude beside each prompt, never as typed text.
  on('prompt.submit', async ($, e, next) => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) return next(e)
    const { value: pending = [] } = await $.state.get(PENDING)
    const blocks = [listContext(await listOf($)), joinNotes(pending)].filter((b): b is string => b !== undefined)
    if (blocks.length === 0) return next(e)
    const done = await next({ ...e, context: [...(e.context ?? []), ...blocks] })
    if (done.drop === undefined && pending.length > 0) await $.state.set(PENDING, [])

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
    await follow($)
    const answer = applyTool(await listOf($), e, await $.clock.now())
    if (answer.list) {
      await keep($, answer.list)
      await publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segmentNow($)))
    }

    return { result: answer.text }
  }).catch(($, e, next) => next(e))

  // The model's view while off: a tool registered earlier waits behind ToolSearch.
  on('tool.describe', { tool: TOOL_NAME }, async ($, e, next) =>
    (await isOff(() => $.mods.isOn({ name: NAME }))) ? { description: 'Off in this chat. Do not call it.', isDeferred: true } : next(e),
  )


  // The person's close keeps the pane closed for the conversation; any close marks it closed.
  on('ui.close', async ($, e, next) => {
    if (e.id === NAME) {
      await $.state.set(PANE_OPEN, false)
      if (e.origin.kind === 'person') await $.state.set(PANE_CLOSED, true)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: NAME }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text, Button } = elements
    // A surface without a text field edits and adds through /todo and /note.
    const Input = 'Input' in elements ? elements.Input : undefined
    const t = texts(await languageFor($))
    const list = await listOf($)
    const view = await viewOf($)
    const { tasks, notes } = numbered(list)
    const isNarrow = e.props.bodyColumns < NARROW
    const colours = e.surface === 'desktop' ? OWNER_COLOURS.desktop : OWNER_COLOURS.other
    const republish = () => publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segmentNow($)))
    const command = (cmd: Cmd) => () => void pressCommand($, cmd, republish)

    const active = tasks.filter(n => n.entry.status !== 'done' && n.entry.isDeferred !== true)
    const done = tasks.filter(n => n.entry.status === 'done')
    const later = tasks.filter(n => n.entry.status !== 'done' && n.entry.isDeferred === true)

    // One entry: its mark and text (or the field that edits it), then its actions; `group` is
    // the run of rows the arrows move within.
    const row = ({ ref, entry }: Numbered, group: Numbered[]) => {
      const id = entry.id
      const at = group.findIndex(n => n.entry.id === id)
      const position = Number(ref.slice(1))
      const isTask = entry.kind === 'task'
      const isDone = entry.status === 'done'
      const actions = [
        ...(at > 0 ? [<Button key={`up-${id}`} label="↑" plain onPress={command({ kind: 'move', ref, to: position - 1 })} />] : []),
        ...(at >= 0 && at < group.length - 1 ? [<Button key={`down-${id}`} label="↓" plain onPress={command({ kind: 'move', ref, to: position + 1 })} />] : []),
        ...(isTask && !isDone && entry.isDeferred !== true ? [<Button key={`do-${id}`} label={t.doNow} plain onPress={() => void doNow($, id, republish)} />] : []),
        <Button key={`discuss-${id}`} label={t.discuss} plain onPress={() => void discuss($, ref, entry.text)} />,
        ...(isTask && !isDone ? [<Button key={`later-${id}`} label={entry.isDeferred ? t.backLabel : t.laterLabel} plain onPress={command({ kind: 'later', ref })} />] : []),
        ...(Input ? [<Button key={`edit-${id}`} label={t.edit} plain onPress={() => void setView($, { editing: id })} />] : []),
        <Button key={`rm-${id}`} label={t.remove} plain dimColor onPress={command({ kind: 'rm', ref })} />,
      ]
      const isMenuOpen = !isNarrow || view.menu === id

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={1}>
            {isTask && <Button key={`${isDone ? 'undo' : 'done'}-${id}`} label={isDone ? '☑' : '☐'} plain onPress={command({ kind: isDone ? 'undo' : 'done', ref })} />}
            <Text color={colours[entry.owner]}>●</Text>
            {view.editing === id && Input ? (
              <Input key={`text-${id}`} value={entry.text} submitLabel={t.save} onSubmit={(value: string) => void pressCommand($, { kind: 'edit', ref, text: value }, republish).then(() => setView($, { editing: undefined }))} />
            ) : (
              <Text dimColor={isDone}>{`${ref} ${clean(entry.text)}`}</Text>
            )}
            {isNarrow && <Button key={`menu-${id}`} label="⋯" plain onPress={() => void setView($, { menu: view.menu === id ? undefined : id })} />}
          </Box>
          {isMenuOpen && (
            <Box flexDirection="row" columnGap={2} flexWrap="wrap">
              {actions}
            </Box>
          )}
        </Box>
      )
    }
    const fold = (name: string, label: string, rows: Numbered[]) =>
      rows.length === 0 ? null : (
        <Box flexDirection="column">
          <Button key={`fold-${name}`} label={`${view.open.includes(name) ? '▼' : '▶︎'} ${label}`} plain dimColor onPress={() => void toggleFold($, name)} />
          {view.open.includes(name) && rows.map(n => row(n, rows))}
        </Box>
      )

    return (
      <Box flexDirection="column" gap={1}>
        {tasks.length + notes.length === 0 && <Text dimColor>{t.nothingYet}</Text>}
        {tasks.length > 0 && (
          <Box flexDirection="column">
            <Text bold>{t.tasks}</Text>
            {active.map(n => row(n, active))}
            {fold('done', t.doneFold(done.length), done)}
            {fold('later', t.laterFold(later.length), later)}
          </Box>
        )}
        {notes.length > 0 && (
          <Box flexDirection="column">
            <Text bold>{t.notesHeader}</Text>
            {notes.map(n => row(n, notes))}
          </Box>
        )}
        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={1}>
            <Button key="kind" label={view.kind === 'note' ? t.kindNote : t.kindTask} onPress={() => void setView($, { kind: view.kind === 'note' ? 'task' : 'note' })} />
            <Button key="take-sel" label={t.takeSelection} plain onPress={command({ kind: 'sel', entry: view.kind })} />
          </Box>
          {Input && <Input key="new" placeholder={t.newPlaceholder} submitLabel={t.add} onSubmit={(value: string) => void pressCommand($, { kind: 'add', entry: view.kind, text: value }, republish)} />}
        </Box>
        {list.trash.length > 0 && (
          <Box flexDirection="column">
            <Button key="fold-trash" label={`${view.open.includes('trash') ? '▼' : '▶︎'} ${t.trashFold(list.trash.length)}`} plain dimColor onPress={() => void toggleFold($, 'trash')} />
            {view.open.includes('trash') && list.trash.map((entry: Entry, i) => (
              <Box flexDirection="row" columnGap={1}>
                <Text dimColor>{`${i + 1}. ${clean(entry.text)}`}</Text>
                <Button key={`restore-${i + 1}`} label={t.restore} plain onPress={command({ kind: 'restore', index: i + 1 })} />
              </Box>
            ))}
            {view.open.includes('trash') && <Button key="empty-trash" label={t.emptyTrash} plain dimColor onPress={() => void clearTrash($).then(republish)} />}
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
