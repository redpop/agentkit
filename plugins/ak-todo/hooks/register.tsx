import type { EngineInterface, Register } from 'claude-code'

import { applyCommand, parseCommand } from './command'
import type { Cmd } from './command'
import { SECTION, SECTION_ID, joinNotes, listContext } from './context'
import { languageFor, learnLanguage, texts } from './i18n'
import { add, emptyList, numbered, resolve } from './list'
import type { TodoList } from './list'
import { conversationId, loadList, loadSettings, parseList, pruneStale, saveList, saveSettings } from './store'
import { TOOL, applyTool } from './tool'
import { segmentOf } from './view'
import type { Segment } from './view'

const NAME = 'ak-todo'
const TOOL_NAME = 'mcp__ak-todo__todo'
const LIST = { plugin: 'ak-todo', key: 'list' } as const
const CONVERSATION = { plugin: 'ak-todo', key: 'conversation' } as const
const PENDING = { plugin: 'ak-todo', key: 'pending' } as const
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
  await $.state.set(CONVERSATION, id)
}

/** Holds and stores a changed list; `note` is queued for Claude when the person made the change. */
async function keep($: EngineInterface, list: TodoList, note?: string): Promise<void> {
  await $.state.set(LIST, list)
  if (note !== undefined) {
    const { value = [] } = await $.state.get(PENDING)
    await $.state.set(PENDING, [...value, note].slice(-MAX_PENDING))
  }
  if (!(await saveList($, await conversationId($), list))) await $.ui.toast(texts(await languageFor($)).storeFull)
  $.ui.invalidate('ui.render')
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

/** The list as the person reads it in a reply. */
async function listText($: EngineInterface): Promise<string> {
  const t = texts(await languageFor($))
  const { tasks, notes } = numbered(await listOf($))
  const rows = [...tasks, ...notes].map(({ ref, entry }) => `${ref}${entry.status === 'done' ? ' ✓' : entry.isDeferred ? ' …' : ''} ${entry.text}`)

  return rows.length === 0 ? t.emptyList : rows.join('\n')
}

/** Runs a `/todo` or `/note` command and answers the reply. */
async function runCommand($: EngineInterface, cmd: Cmd): Promise<string> {
  const lang = await languageFor($)
  const t = texts(lang)
  const now = await $.clock.now()
  if (cmd.kind === 'toggle') return listText($)
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
