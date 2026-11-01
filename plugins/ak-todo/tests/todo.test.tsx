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
const engine = (on: On, stored: Record<string, unknown> = {}) => {
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
  mock.env(on, { LANG: 'en_US.UTF-8' })
  chat.id = 'S1'
  const toasts: string[] = []
  const contexts: (readonly string[] | undefined)[] = []
  const submitted: string[] = []
  const selection: { text?: string } = {}
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
  on('ui.open', () => ({ value: { isPlaced: true } }))
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

  return { clock, toasts, contexts, submitted, selection, stored }
}

type Segment = Parameters<EngineInterface['mods']['segment']>[0]
const SEGMENT = 'segment '

// ak-mods cannot be loaded here, so a plugin above the mod stands in for it, as in ak-pause's
// tests: declaring switches the mod on, and each published segment comes out as a toast.
const owner: Register = on => {
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
