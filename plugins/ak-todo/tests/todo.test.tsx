import { expect, mock, test } from 'claude-code/testing'
import type { EngineInterface, On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { add, emptyList } from '../hooks/list'
import type { TodoList } from '../hooks/list'

const T = new Date(2026, 10, 1, 9, 0).getTime()

// The chat's id: a /clear in the test moves it on, as the engine does.
const chat = { id: 'S1' }

// The engine beneath the plugin: the clock, the store, the toasts, what reached the model beside
// each prompt, the system prompt, the selection and the prompts the mod submitted.
const engine = (on: On, stored: Record<string, unknown> = {}, lang = 'en_US.UTF-8') => {
  const clock = mock.clock(on, { now: T })
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => {
    stored[e.key] = JSON.parse(JSON.stringify(e.value))

    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    delete stored[e.key]

    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(stored) }))
  mock.env(on, { LANG: lang })
  chat.id = 'S1'
  const toasts: string[] = []
  const contexts: (readonly string[] | undefined)[] = []
  const submitted: string[] = []
  const selection: { text?: string } = {}
  const box = { text: '' }
  const model: { reply?: string; gate?: Promise<void>; calls: { model: string; prompt: string }[] } = { calls: [] }
  on('model.complete', async (_, e) => {
    model.calls.push({ model: e.model, prompt: e.prompt })
    await model.gate
    if (model.reply === undefined) throw new Error('overloaded')

    return { value: { isAnswered: true, text: model.reply, usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  const opened: string[] = []
  const placement = { isPlaced: true }
  on('session.id', () => ({ value: chat.id }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: e.name } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.selection', () => ({ value: selection.text === undefined ? undefined : { text: selection.text } }))
  on('ui.open', (_, e) => {
    opened.push(e.id)

    return { value: placement.isPlaced ? { isPlaced: true } : { isPlaced: false, reason: 'too narrow' } }
  })
  on('prompt.read', () => ({ value: { text: box.text, cursor: box.text.length } }))
  on('prompt.fill', (_, e) => {
    box.text = e.mode === 'append' ? box.text + e.text : e.text

    return { isFilled: true }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => {
    if (e.origin?.kind === 'composer') contexts.push(e.context)
    else submitted.push(e.text)

    return { text: e.text, context: e.context }
  })
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude.', scope: 'shared' }] }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  return { clock, toasts, contexts, submitted, selection, stored, box, opened, model, placement }
}

type Segment = Parameters<EngineInterface['mods']['segment']>[0]
const SEGMENT = 'segment '

// ak-mods cannot be loaded here, so a plugin above the mod stands in for it, as in ak-pause's
// tests: declaring switches the mod on, and each published segment comes out as a toast.
const owner: Register = on => {
  // Between `hold` and `release` a segment call resolves without being stored, as inside the call
  // ak-mods makes when its card's picker runs a command.
  let isPressing = false
  on('engine.create', async ($, e, next) => {
    const built = await next(e)
    const set = async ({ name, on: isOn }: { name: string; on: boolean }) => {
      const held = await built.state.get({ plugin: 'ak-mods', key: 'on' })
      await built.state.set({ plugin: 'ak-mods', key: 'on' }, { ...held.value, [name]: isOn })
      if (!isOn) await built.ui.toast('segment null')
    }

    return {
      ...built,
      mods: {
        declare: async ({ name }: { name: string }) => {
          await set({ name, on: true })

          return true
        },
        isOn: async ({ name }: { name: string }) => (await built.state.get({ plugin: 'ak-mods', key: 'on' })).value?.[name] === true,
        set,
        setStandard: async () => {},
        move: async () => {},
        resetOrder: async () => {},
        isOrderMoved: async () => false,
        list: async () => [],
        segment: async (segment: Segment) => {
          if (isPressing) return
          await built.ui.toast('segment ' + JSON.stringify(typeof segment?.text === 'string' ? segment : null))
        },
      },
    }
  })
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'stand-in', description: 'Controls the ak-mods stand-in', immediate: true })

    return next(e)
  })
  on('command.run', { command: 'stand-in' }, async ($, e) => {
    if (e.args === 'hold' || e.args === 'release') {
      isPressing = e.args === 'hold'

      return {}
    }
    if (e.args === 'close') {
      await $.ui.close({ id: 'ak-todo' })

      return {}
    }
    await $.mods.set({ name: 'ak-todo', on: e.args === 'on' })

    return {}
  })
}

const OWNED = { plugins: [{ name: 'ak-mods', tier: 'prepend', register: owner }] } as const

const segments = (toasts: string[]): (Segment | undefined)[] =>
  toasts.filter(t => t.startsWith(SEGMENT)).map(t => JSON.parse(t.slice(SEGMENT.length)) ?? undefined)
const last = (toasts: string[]) => segments(toasts).at(-1)?.text

const start = ($: Engine) => $.session.start({ cwd: '/', surface: null, isInteractive: false })
const run = ($: Engine, command: string, args = '') =>
  $.command.run({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
const submit = ($: Engine, text = 'go on') => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
const compose = ($: Engine) => $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] })
const todo = ($: Engine, input: Record<string, unknown>) => $.tool.call({ tool: 'mcp__ak-todo__todo', ...input } as never)

const stored1 = (text: string): TodoList => {
  const result = add(emptyList(T), { kind: 'task', text, owner: 'user' }, T)
  if ('error' in result) throw new Error(result.error)

  return result.list
}

test('/todo text adds a task and the segment shows it', OWNED, async ($, on) => {
  const { clock, toasts, stored } = engine(on)
  await start($)
  const reply = await run($, 'todo', 'Fix login')
  await clock.settle()
  expect(reply.text).toBe('Added: T1 Fix login')
  expect(last(toasts)).toBe('1 open · Fix login')
  expect((stored['list:S1'] as TodoList).entries[0]?.text).toBe('Fix login')
})

test('the list reaches the prompt as context and is gone from an empty list', OWNED, async ($, on) => {
  const { contexts } = engine(on)
  await start($)
  await submit($)
  expect(contexts.at(-1)).toBeUndefined()
  await run($, 'note', 'Port 3000')
  await submit($)
  expect(contexts.at(-1)?.[0]).toBe('Session list (ak-todo):\n[N1 id=1 note, user] Port 3000')
})

test('a user change reaches the next prompt once as a change note', OWNED, async ($, on) => {
  const { contexts } = engine(on)
  await start($)
  await run($, 'todo', 'Fix login')
  await submit($)
  expect(contexts.at(-1)?.[1]).toBe('Changed by the user since your last turn:\n- The person added a task (id 1): Fix login')
  await submit($)
  expect(contexts.at(-1)?.length).toBe(1)
})

test('the system prompt carries the section while on', OWNED, async ($, on) => {
  engine(on)
  await start($)
  const { sections } = await compose($)
  expect(sections.at(-1)?.id).toBe('ak-todo:list')
  expect(sections.at(-1)?.scope).toBe('session')
})

test('the tool adds and the store holds it', OWNED, async ($, on) => {
  const { stored, contexts } = engine(on)
  await start($)
  const call = await todo($, { action: 'add', text: 'Check the cache' })
  expect(String(call.result).startsWith('Added: T1 id=1.')).toBe(true)
  expect((stored['list:S1'] as TodoList).entries[0]?.owner).toBe('claude')
  // Claude's own change is not reported back to it.
  await submit($)
  expect(contexts.at(-1)?.length).toBe(1)
})

test('the tool refuses removing a user entry', OWNED, async ($, on) => {
  engine(on, { 'list:S1': stored1('Fix login') })
  await start($)
  expect((await todo($, { action: 'remove', id: 1 })).result).toBe('T1 belongs to the user. Ask them before removing it.')
})

test('a resume of the same conversation brings the list back', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { 'list:S1': stored1('Fix login') })
  await start($)
  await clock.settle()
  expect(last(toasts)).toBe('1 open · Fix login')
})

test('/clear starts an empty list and keeps the old one stored', OWNED, async ($, on) => {
  const { clock, toasts, stored } = engine(on, { 'list:S1': stored1('Fix login') })
  await start($)
  await clock.settle()
  chat.id = 'S2'
  await $.session.end({ reason: 'clear', sessionId: 'S1', resume: { kind: 'id', id: 'S1' } } as never)
  await clock.settle()
  expect(segments(toasts).at(-1)).toBeUndefined()
  await run($, 'todo', 'New thing')
  expect((stored['list:S2'] as TodoList).entries.map(e => e.text)).toEqual(['New thing'])
  expect((stored['list:S1'] as TodoList).entries.map(e => e.text)).toEqual(['Fix login'])
})

test('/todo sel adds the selected text', OWNED, async ($, on) => {
  const { selection, stored } = engine(on)
  await start($)
  selection.text = 'the flaky test\nin CI'
  expect((await run($, 'note', 'sel')).text).toBe('Added: N1 the flaky test in CI')
  expect((stored['list:S1'] as TodoList).entries[0]?.kind).toBe('note')
})

test('/todo sel with nothing selected replies so', OWNED, async ($, on) => {
  engine(on)
  await start($)
  expect((await run($, 'todo', 'sel')).text).toBe('Nothing selected.')
})

test('/todo ask submits the text with the entry quoted', OWNED, async ($, on) => {
  const { clock, submitted } = engine(on, { 'list:S1': stored1('Fix login') })
  await start($)
  await run($, 'todo', 'ask T1 is this still needed?')
  await clock.settle()
  expect(submitted).toEqual(['is this still needed?\n\n> T1 Fix login'])
})

test('switched off: tool says off, no context, no section, no segment; on again: same list', OWNED, async ($, on) => {
  const { clock, toasts, contexts } = engine(on, { 'list:S1': stored1('Fix login') })
  await start($)
  await clock.settle()
  await run($, 'stand-in', 'off')
  await clock.settle()
  expect(segments(toasts).at(-1)).toBeUndefined()
  expect(String((await todo($, { action: 'list' })).result).includes('off')).toBe(true)
  await submit($)
  expect(contexts.at(-1)).toBeUndefined()
  expect((await compose($)).sections.some(s => s.id === 'ak-todo:list')).toBe(false)
  await run($, 'stand-in', 'on')
  await clock.settle()
  expect(last(toasts)).toBe('1 open · Fix login')
  await submit($)
  expect(contexts.at(-1)?.[0]?.includes('Fix login')).toBe(true)
})

test('without ak-mods the mod runs on and keeps the list', async ($, on) => {
  const { contexts } = engine(on)
  await start($)
  await run($, 'todo', 'Fix login')
  await submit($)
  expect(contexts.at(-1)?.[0]?.includes('Fix login')).toBe(true)
})

const PANE = {
  plugin: 'ak-todo',
  component: 'Pane',
  requestId: 'ak-todo',
  surface: 'desktop',
  props: { title: 'Todo', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const listOf = (...items: ['task' | 'note', string][]): TodoList =>
  items.reduce((list, [kind, text]) => {
    const result = add(list, { kind, text, owner: 'user' }, T)
    if ('error' in result) throw new Error(result.error)

    return result.list
  }, emptyList(T))

const texts = async (ui: { findAll: (q: { type: 'Text' }) => Promise<{ text?: string }[]> }) => (await ui.findAll({ type: 'Text' })).map(t => t.text)

test('the pane lists tasks, folded done and later, and notes', OWNED, async ($, on) => {
  const list = listOf(['task', 'a'], ['task', 'b'], ['task', 'c'], ['note', 'n'])
  list.entries[1] = { ...list.entries[1]!, status: 'done' }
  list.entries[2] = { ...list.entries[2]!, isDeferred: true }
  engine(on, { 'list:S1': list })
  await start($)
  const ui = await $.ui.mount(PANE)
  const shown = await texts(ui)
  expect(shown.includes('T1 a')).toBe(true)
  expect(shown.includes('T2 b')).toBe(false)
  expect(shown.includes('N1 n')).toBe(true)
  expect((await ui.find({ key: 'fold-done' }))?.text).toBe('▶︎ Done (1)')
  expect((await ui.find({ key: 'fold-later' }))?.text).toBe('▶︎ Later (1)')
  await ui.press({ key: 'fold-done' })
  expect((await texts(ui)).includes('T2 b')).toBe(true)
  await ui.unmount()
})

test('Do now marks doing and submits the prompt', OWNED, async ($, on) => {
  const { clock, submitted, stored } = engine(on, { 'list:S1': listOf(['task', 'Fix login']) })
  await start($)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'do-1' })
  await clock.settle()
  expect(submitted).toEqual(['Work on T1 now: Fix login'])
  expect((stored['list:S1'] as TodoList).entries[0]?.status).toBe('doing')
  await ui.unmount()
})

test('Discuss fills an empty box with the German draft', OWNED, async ($, on) => {
  const { box } = engine(on, { 'list:S1': listOf(['task', 'Fix login']) }, 'de_DE.UTF-8')
  await start($)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'discuss-1' })
  expect(box.text).toBe('Zu Punkt T1 (Fix login): ')
  await ui.unmount()
})

test('Discuss appends to a box that has text', OWNED, async ($, on) => {
  const { box } = engine(on, { 'list:S1': listOf(['note', 'Port 3000']) })
  await start($)
  box.text = 'Also:'
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'discuss-1' })
  expect(box.text).toBe('Also:\nAbout item N1 (Port 3000): ')
  await ui.unmount()
})

test('↑ on T2 makes it T1', OWNED, async ($, on) => {
  const { stored } = engine(on, { 'list:S1': listOf(['task', 'a'], ['task', 'b']) })
  await start($)
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ key: 'up-1' })).toBeUndefined()
  await ui.press({ key: 'up-2' })
  expect((stored['list:S1'] as TodoList).entries.map(e => e.text)).toEqual(['b', 'a'])
  expect((await texts(ui)).includes('T1 b')).toBe(true)
  await ui.unmount()
})

// The kit cannot raise the person's close mark: a close reaches the mod as a plugin's. The person's
// close (origin `person`) keeping the pane shut is checked on the desktop app.
test('the pane opens on a first entry and on /todo; a close by a plugin does not keep it shut', OWNED, async ($, on) => {
  const { opened } = engine(on)
  await start($)
  await run($, 'todo', 'first')
  expect(opened).toEqual(['ak-todo'])
  await run($, 'todo', 'second')
  expect(opened).toEqual(['ak-todo'])
  await run($, 'stand-in', 'close')
  await run($, 'todo', 'rm 1')
  await run($, 'todo', 'rm 1')
  await run($, 'todo', 'third')
  expect(opened).toEqual(['ak-todo', 'ak-todo'])
  // /todo alone closes the open pane, and opens it again.
  await run($, 'todo')
  await run($, 'todo')
  expect(opened).toEqual(['ak-todo', 'ak-todo', 'ak-todo'])
})

test('the input adds a note when the switch says note', OWNED, async ($, on) => {
  const { stored } = engine(on)
  await start($)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'kind' })
  await ui.input({ key: 'new', text: 'Uses port 3000' })
  expect((stored['list:S1'] as TodoList).entries).toEqual([{ id: 1, kind: 'note', text: 'Uses port 3000', owner: 'user' }])
  await ui.unmount()
})

test('Edit swaps the row for an input and saves the new text', OWNED, async ($, on) => {
  const { stored } = engine(on, { 'list:S1': listOf(['task', 'old']) })
  await start($)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'edit-1' })
  await ui.input({ key: 'text-1', text: 'new' })
  expect((stored['list:S1'] as TodoList).entries[0]?.text).toBe('new')
  await ui.unmount()
})

test('a narrow pane puts row actions behind one button', OWNED, async ($, on) => {
  engine(on, { 'list:S1': listOf(['task', 'a']) })
  await start($)
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 30 } })
  expect(await ui.find({ key: 'do-1' })).toBeUndefined()
  expect(await ui.find({ key: 'done-1' })).toBeDefined()
  await ui.press({ key: 'menu-1' })
  expect(await ui.find({ key: 'do-1' })).toBeDefined()
  await ui.unmount()
})

test('the trash restores and empties', OWNED, async ($, on) => {
  const { stored } = engine(on, { 'list:S1': listOf(['task', 'a'], ['task', 'b']) })
  await start($)
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'rm-1' })
  await ui.press({ key: 'rm-2' })
  await ui.press({ key: 'fold-trash' })
  await ui.press({ key: 'restore-2' })
  expect((stored['list:S1'] as TodoList).entries.map(e => e.text)).toEqual(['a'])
  await ui.press({ key: 'empty-trash' })
  expect((stored['list:S1'] as TodoList).trash).toEqual([])
  await ui.unmount()
})

test('the segment stays one line for an entry stored before cleaning', OWNED, async ($, on) => {
  const list = listOf(['task', 'x'])
  list.entries[0] = { ...list.entries[0]!, text: 'two\nlines' }
  const { clock, toasts } = engine(on, { 'list:S1': list })
  await start($)
  await clock.settle()
  expect(last(toasts)).toBe('1 open · two lines')
})

const answered = ($: Engine, answer: string) =>
  $.turn.complete({ turnId: 'T1', reason: 'answer', answer, durationMs: 1, isAborted: false } as never)

test('detection off by default adds nothing after a turn', OWNED, async ($, on) => {
  const { clock, model, stored } = engine(on)
  model.reply = '["Fix the cache"]'
  await start($)
  await answered($, 'I left the cache for later.')
  await clock.settle()
  expect(model.calls).toEqual([])
  expect(stored['list:S1']).toBeUndefined()
})

test('detection on adds Claude-owned tasks', OWNED, async ($, on) => {
  const { clock, model, stored } = engine(on, { settings: { detect: true, model: 'haiku' } })
  model.reply = 'Sure: ["Fix the cache", "Ask about the API"]'
  await start($)
  await answered($, 'I left the cache for later. Which API?')
  await clock.settle()
  expect(model.calls[0]?.model).toBe('haiku')
  expect((stored['list:S1'] as TodoList).entries.map(e => [e.text, e.owner])).toEqual([
    ['Fix the cache', 'claude'],
    ['Ask about the API', 'claude'],
  ])
})

test('a model call that fails adds nothing and shows no toast', OWNED, async ($, on) => {
  const { clock, model, stored, toasts } = engine(on, { settings: { detect: true, model: 'haiku' } })
  await start($)
  const before = toasts.filter(t => !t.startsWith(SEGMENT)).length
  await answered($, 'Some answer.')
  await clock.settle()
  expect(model.calls.length).toBe(1)
  expect(stored['list:S1']).toBeUndefined()
  expect(toasts.filter(t => !t.startsWith(SEGMENT)).length).toBe(before)
  // The next turn tries again.
  model.reply = '["Later thing"]'
  await answered($, 'Another answer.')
  await clock.settle()
  expect((stored['list:S1'] as TodoList).entries.map(e => e.text)).toEqual(['Later thing'])
})

test('a detected text equal to an existing entry is skipped', OWNED, async ($, on) => {
  const { clock, model, stored } = engine(on, { settings: { detect: true, model: 'haiku' }, 'list:S1': stored1('Fix the cache') })
  model.reply = '["fix  the cache", "New one"]'
  await start($)
  await answered($, 'x')
  await clock.settle()
  expect((stored['list:S1'] as TodoList).entries.map(e => e.text)).toEqual(['Fix the cache', 'New one'])
})

test('the settings rows pick detection and its model', OWNED, async ($, on) => {
  const { clock, toasts, stored } = engine(on, { 'list:S1': stored1('a') })
  await start($)
  await clock.settle()
  expect(segments(toasts).at(-1)?.settings?.rows.map(r => [r.key, r.value])).toEqual([
    ['detect', 'off'],
    ['model', 'haiku'],
  ])
  await run($, 'todo', 'model sonnet')
  await run($, 'todo', 'detect on')
  await clock.settle()
  expect(stored.settings).toEqual({ detect: true, model: 'sonnet' })
  expect(segments(toasts).at(-1)?.settings?.rows.map(r => r.value)).toEqual(['on', 'sonnet'])
})

test('after a /resume whose id moves late, a press and a prompt follow to the new conversation', OWNED, async ($, on) => {
  const other = stored1('Other')
  const { clock, stored, contexts } = engine(on, { 'list:S1': stored1('Fix login'), 'list:S2': other })
  await start($)
  await clock.settle()
  const ui = await $.ui.mount(PANE)
  // The end's timer still reads the ended chat's id.
  await $.session.end({ reason: 'resume', sessionId: 'S1', resume: { kind: 'id', id: 'S1' } } as never)
  await clock.settle()
  chat.id = 'S2'
  await submit($)
  expect(contexts.at(-1)?.[0]?.includes('Other')).toBe(true)
  await ui.press({ key: 'later-1' })
  expect((stored['list:S1'] as TodoList).entries.map(e => [e.text, e.isDeferred])).toEqual([['Fix login', undefined]])
  expect((stored['list:S2'] as TodoList).entries.map(e => e.text)).toEqual(['Other'])
  await ui.unmount()
})

test('a user entry added while detection waits on the model is kept, with its own id', OWNED, async ($, on) => {
  const { clock, model, stored } = engine(on, { settings: { detect: true, model: 'haiku' } })
  let open = () => {}
  model.gate = new Promise<void>(resolve => (open = resolve))
  model.reply = '["Fix the cache"]'
  await start($)
  await answered($, 'I left the cache for later.')
  const settling = clock.settle()
  await run($, 'todo', 'Fix login')
  open()
  await settling
  await clock.settle()
  const entries = (stored['list:S1'] as TodoList).entries
  expect(entries.map(e => e.text)).toEqual(['Fix login', 'Fix the cache'])
  expect(new Set(entries.map(e => e.id)).size).toBe(2)
})

test('a settings pick run inside ak-mods\' call still shows the new value', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { 'list:S1': stored1('a') })
  await start($)
  await clock.settle()
  await run($, 'stand-in', 'hold')
  await run($, 'todo', 'detect on')
  await run($, 'stand-in', 'release')
  await clock.settle()
  expect(segments(toasts).at(-1)?.settings?.rows[0]?.value).toBe('on')
})

test('a pane press acts on the entry shown, after Claude moved the numbers', OWNED, async ($, on) => {
  const { stored } = engine(on, { 'list:S1': listOf(['task', 'a'], ['task', 'b']) })
  await start($)
  const ui = await $.ui.mount(PANE)
  await todo($, { action: 'move', id: 2, to: 1 })
  await ui.press({ key: 'rm-1' })
  expect((stored['list:S1'] as TodoList).entries.map(e => e.text)).toEqual(['b'])
  await ui.unmount()
})

test('a pane the surface did not place opens on the next /todo', OWNED, async ($, on) => {
  const { opened, placement } = engine(on)
  placement.isPlaced = false
  await start($)
  await run($, 'todo', 'first')
  placement.isPlaced = true
  await run($, 'todo')
  expect(opened).toEqual(['ak-todo', 'ak-todo'])
})

test('/todo model with an unknown alias replies with the choices and adds nothing', OWNED, async ($, on) => {
  const { stored } = engine(on)
  await start($)
  expect((await run($, 'todo', 'model opus')).text).toBe('Detection models: haiku, sonnet.')
  expect(stored['list:S1']).toBeUndefined()
})

test('detection that ends after the conversation moved on adds to neither list', OWNED, async ($, on) => {
  const { clock, model, stored } = engine(on, { settings: { detect: true, model: 'haiku' } })
  let open = () => {}
  model.gate = new Promise<void>(resolve => (open = resolve))
  model.reply = '["Fix the cache"]'
  await start($)
  await answered($, 'I left the cache for later.')
  const settling = clock.settle()
  chat.id = 'S2'
  open()
  await settling
  await clock.settle()
  expect(stored['list:S1']).toBeUndefined()
  expect(stored['list:S2']).toBeUndefined()
})

test('the band does not say all done while tasks wait for later', OWNED, async ($, on) => {
  const list = stored1('a')
  list.entries[0] = { ...list.entries[0]!, isDeferred: true }
  const { clock, toasts } = engine(on, { 'list:S1': list })
  await start($)
  await clock.settle()
  expect(last(toasts)).toBe('1 later')
})
