import { expect, mock, test } from 'claude-code/testing'
import type { On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { runCommand } from './command'

import { initialOn, pruneKeys } from '../hooks/switches'

// As in noun.test.ts, every `$.mods`, `$.state` and `$.store` read is made
// from inside a consumer plugin: the test's own `$` carries none of them.
// Each consumer declares itself at `session.start`, as a real mod does, and
// answers the call its command's args spell as JSON.
const probe: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.mods.declare({ name: $.plugin.name, title: $.plugin.name, summary: 's', details: 'd' })

    return next(e)
  })

  on('command.run', async ($, e, next) => {
    if (e.command !== $.plugin.name) {
      return next(e)
    }

    const { op, arg } = JSON.parse(e.args)
    const answer =
      op === 'isOn'
        ? await $.mods.isOn(arg)
        : op === 'set'
          ? await $.mods.set(arg)
          : op === 'setStandard'
            ? await $.mods.setStandard(arg)
            : op === 'switches'
              ? (await $.state.get({ plugin: 'ak-mods', key: 'on' })).value
              : op === 'store'
                ? await $.store.get(arg)
                : await $.store.keys()

    return { text: JSON.stringify(answer ?? null) }
  })
}

// Declares itself and turns itself on in its `session.start`, which runs
// before ak-mods' own: `set` restores the chat first, then lands the switch.
const early: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.mods.declare({ name: $.plugin.name, title: $.plugin.name, summary: 's', details: 'd' })
    await $.mods.set({ name: $.plugin.name, on: true })

    return next(e)
  })
}

const consumer = (name: string) => ({ name, register: probe })
const PLUGINS = [consumer('ak-a'), consumer('ak-b')]

const call = async ($: Engine, plugin: string, op: string, arg?: unknown) => {
  const ran = await runCommand($, plugin, JSON.stringify({ op, arg }))

  return JSON.parse(ran.text ?? 'null')
}

// The engine beneath the plugins: a session `S1` that starts and ends. The
// returned `session.id` changes the id the engine answers, as a resume does.
const engine = (on: On, store: Readonly<Record<string, unknown>>) => {
  const session = { id: 'S1' }
  mock.store(on, store)
  on('session.id', () => ({ value: session.id }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('command.register', () => ({ value: { command: 'ak-mods' } }))

  return session
}

// Holds the first `store.get` (or `store.set`) of `key` until `release`: a
// restore reading that chat's switches, or a `set` saving them, stays in
// flight. `reached` settles once it is held.
// Called before `engine`: a test's hook registered after another on the
// same event sits beneath it, and `mock.store` answers without `next`.
const hold = (on: On, key: string, event: 'store.get' | 'store.set' = 'store.get') => {
  let reach = () => {}
  let release = () => {}
  const reached = new Promise<void>(resolve => (reach = resolve))
  const gate = new Promise<void>(resolve => (release = resolve))
  let isHeld = false
  const wait = async () => {
    if (!isHeld) {
      isHeld = true
      reach()
      await gate
    }
  }
  if (event === 'store.get') {
    on('store.get', { key }, async (_, e, next) => {
      await wait()

      return next(e)
    })
  } else {
    on('store.set', { key }, async (_, e, next) => {
      await wait()

      return next(e)
    })
  }

  return { reached, release: () => release() }
}

// Asks ak-mods whether it is on from a `state.set` hook on the switches,
// while the write that raised it waits for the hook, and keeps the answer
// in the store under `asked`. Prepended, so it declares itself before
// ak-mods restores the chat.
const asker: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.mods.declare({ name: $.plugin.name, title: $.plugin.name, summary: 's', details: 'd' })

    return next(e)
  })

  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    await $.store.set('asked', await $.mods.isOn({ name: $.plugin.name }))

    return next(e)
  })
}

// An in-process `/resume`: the chat `S1` ends and `id` takes its place.
const resume = async ($: Engine, session: { id: string }, id: string) => {
  await $.session.end({ reason: 'resume', sessionId: session.id, resume: { id: session.id } })
  session.id = id
}

const start = ($: Engine) => $.session.start({ cwd: '/', surface: null, isInteractive: false })

test('initialOn turns every standard on when nothing is saved', () => {
  expect(initialOn(['ak-a', 'ak-b'], undefined)).toEqual({ 'ak-a': true, 'ak-b': true })
  expect(initialOn([], undefined)).toEqual({})
})

test('initialOn keeps the saved switches over the standard set', () => {
  expect(initialOn(['ak-a'], { 'ak-b': true, 'ak-a': false })).toEqual({ 'ak-b': true, 'ak-a': false })
})

test('pruneKeys names the oldest keys beyond the newest ones kept', () => {
  const keys = Array.from({ length: 105 }, (_, i) => `session:K${i}`)

  expect(pruneKeys(keys, 100)).toEqual(['session:K0', 'session:K1', 'session:K2', 'session:K3', 'session:K4'])
  expect(pruneKeys(keys.slice(0, 100), 100)).toEqual([])
})

test('a new chat starts with only standard mods on', { plugins: PLUGINS }, async ($, on) => {
  engine(on, { standard: ['ak-a'] })
  await start($)

  expect(await call($, 'ak-a', 'isOn', { name: 'ak-a' })).toBe(true)
  expect(await call($, 'ak-a', 'isOn', { name: 'ak-b' })).toBe(false)
})

test('a resumed chat keeps its switches', { plugins: PLUGINS }, async ($, on) => {
  engine(on, { standard: ['ak-a'], 'session:S1': { 'ak-b': true, 'ak-a': false } })
  await start($)

  expect(await call($, 'ak-a', 'isOn', { name: 'ak-b' })).toBe(true)
  expect(await call($, 'ak-a', 'isOn', { name: 'ak-a' })).toBe(false)
})

test(
  'a mod switching on in its session.start lands on the restored switches',
  { plugins: [{ name: 'ak-b', tier: 'prepend', register: probe }, { name: 'ak-c', tier: 'prepend', register: early }] },
  async ($, on) => {
    engine(on, { 'session:S1': { 'ak-b': true } })
    await start($)

    expect(await call($, 'ak-b', 'isOn', { name: 'ak-b' })).toBe(true)
    // Its `set` restored the chat first, so the saved switch stays beside it.
    expect(await call($, 'ak-b', 'isOn', { name: 'ak-c' })).toBe(true)
    expect(await call($, 'ak-b', 'store', 'session:S1')).toEqual({ 'ak-b': true, 'ak-c': true })
  },
)

test(
  'a mod switching on in its session.start in a new chat lands on the standard set',
  { plugins: [consumer('ak-a'), { name: 'ak-c', tier: 'prepend', register: early }] },
  async ($, on) => {
    engine(on, { standard: ['ak-a'] })
    await start($)

    expect(await call($, 'ak-a', 'switches')).toEqual({ 'ak-a': true, 'ak-c': true })
    expect(await call($, 'ak-a', 'store', 'session:S1')).toEqual({ 'ak-a': true, 'ak-c': true })
  },
)

test('set writes through to the store', { plugins: PLUGINS }, async ($, on) => {
  engine(on, {})
  await start($)
  await call($, 'ak-b', 'set', { name: 'ak-b', on: true })

  expect(await call($, 'ak-b', 'store', 'session:S1')).toEqual({ 'ak-b': true })
})

test('setStandard persists', { plugins: PLUGINS }, async ($, on) => {
  engine(on, {})
  await start($)
  await call($, 'ak-b', 'setStandard', { name: 'ak-b', standard: true })

  expect(await call($, 'ak-b', 'store', 'standard')).toContain('ak-b')
  expect(await call($, 'ak-b', 'isOn', { name: 'ak-b' })).toBe(false)
})

test('/clear resets to the standard set and keeps the old chat resumable', { plugins: PLUGINS }, async ($, on) => {
  engine(on, { standard: ['ak-a'], 'session:S1': { 'ak-b': true, 'ak-a': false } })
  await start($)
  await $.session.end({ reason: 'clear', sessionId: 'S1', resume: { id: 'S1' } })

  expect(await call($, 'ak-a', 'switches')).toEqual(initialOn(['ak-a'], undefined))
  expect(await call($, 'ak-a', 'store', 'session:S1')).toEqual({ 'ak-b': true, 'ak-a': false })
})

test('an in-process resume restores the new chat and keeps the old one apart', { plugins: PLUGINS }, async ($, on) => {
  const session = engine(on, { standard: ['ak-a'], 'session:S1': { 'ak-b': true }, 'session:S2': { 'ak-a': false } })
  await start($)
  expect(await call($, 'ak-a', 'isOn', { name: 'ak-b' })).toBe(true)

  await resume($, session, 'S2')
  // Cleared at the end: the old chat's switches are gone from the state.
  expect(await call($, 'ak-a', 'switches')).toEqual({})
  // No `session.start` follows: reads answer the new chat's own from the
  // store, and the first write restores them before it lands.
  expect(await call($, 'ak-a', 'isOn', { name: 'ak-b' })).toBe(false)
  expect(await call($, 'ak-a', 'isOn', { name: 'ak-a' })).toBe(false)

  await call($, 'ak-a', 'set', { name: 'ak-a', on: true })
  expect(await call($, 'ak-a', 'switches')).toEqual({ 'ak-a': true })
  expect(await call($, 'ak-a', 'store', 'session:S2')).toEqual({ 'ak-a': true })
  expect(await call($, 'ak-a', 'store', 'session:S1')).toEqual({ 'ak-b': true })
})

test('a resume into an unsaved chat starts it with the standard set', { plugins: PLUGINS }, async ($, on) => {
  const session = engine(on, { standard: ['ak-a'], 'session:S1': { 'ak-b': true, 'ak-a': false } })
  await start($)

  await resume($, session, 'S2')
  await call($, 'ak-b', 'set', { name: 'ak-b', on: false })
  expect(await call($, 'ak-a', 'switches')).toEqual({ 'ak-a': true, 'ak-b': false })
  expect(await call($, 'ak-a', 'store', 'session:S2')).toEqual({ 'ak-a': true, 'ak-b': false })
  expect(await call($, 'ak-a', 'store', 'session:S1')).toEqual({ 'ak-b': true, 'ak-a': false })
})

test('a restore a resume overtakes leaves the new chat alone', { plugins: PLUGINS }, async ($, on) => {
  const held = hold(on, 'session:S1')
  const session = engine(on, { 'session:S1': { 'ak-b': true }, 'session:S2': { 'ak-a': true } })
  const started = start($)
  await held.reached

  await resume($, session, 'S2')
  await call($, 'ak-a', 'set', { name: 'ak-b', on: false })
  held.release()
  await started
  // The old chat's restore wrote nothing once the resume ended it.
  expect(await call($, 'ak-a', 'switches')).toEqual({ 'ak-a': true, 'ak-b': false })
  expect(await call($, 'ak-a', 'store', 'session:S2')).toEqual({ 'ak-a': true, 'ak-b': false })
  expect(await call($, 'ak-a', 'store', 'session:S1')).toEqual({ 'ak-b': true })
})

test('a set waiting on a restore a resume overtakes lands in the new chat', { plugins: PLUGINS }, async ($, on) => {
  const held = hold(on, 'session:S1')
  const session = engine(on, { 'session:S1': { 'ak-b': true }, 'session:S2': { 'ak-a': true } })
  const set = call($, 'ak-a', 'set', { name: 'ak-a', on: false })
  await held.reached

  await resume($, session, 'S2')
  held.release()
  await set
  expect(await call($, 'ak-a', 'switches')).toEqual({ 'ak-a': false })
  expect(await call($, 'ak-a', 'store', 'session:S2')).toEqual({ 'ak-a': false })
  expect(await call($, 'ak-a', 'store', 'session:S1')).toEqual({ 'ak-b': true })
})

test('a set that landed before a resume is saved under the old chat', { plugins: PLUGINS }, async ($, on) => {
  const held = hold(on, 'session:S1', 'store.set')
  const session = engine(on, { 'session:S1': { 'ak-b': true }, 'session:S2': { 'ak-a': true } })
  await start($)
  const set = call($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await held.reached

  await resume($, session, 'S2')
  held.release()
  await set
  // The write landed in the old chat, so the store keeps it there and the
  // new chat's switches stay its own.
  expect(await call($, 'ak-a', 'store', 'session:S1')).toEqual({ 'ak-b': true, 'ak-a': true })
  expect(await call($, 'ak-a', 'isOn', { name: 'ak-a' })).toBe(true)
  expect(await call($, 'ak-a', 'isOn', { name: 'ak-b' })).toBe(false)
  expect(await call($, 'ak-a', 'store', 'session:S2')).toEqual({ 'ak-a': true })
})

test(
  'a state.set hook on the switches may ask isOn while the restore writes',
  { plugins: [consumer('ak-a'), { name: 'ak-c', tier: 'prepend', register: asker }] },
  async ($, on) => {
    engine(on, { 'session:S1': { 'ak-c': true } })
    await start($)

    expect(await call($, 'ak-a', 'store', 'asked')).toBe(true)
    expect(await call($, 'ak-a', 'switches')).toEqual({ 'ak-c': true })
  },
)

test('a session.start after a resume restores the new chat', { plugins: PLUGINS }, async ($, on) => {
  const session = engine(on, { 'session:S1': { 'ak-b': true }, 'session:S2': { 'ak-a': true } })
  await start($)

  await resume($, session, 'S2')
  await start($)
  expect(await call($, 'ak-a', 'switches')).toEqual({ 'ak-a': true })
})

test('the next turn after a resume writes the new chat into the state', { plugins: PLUGINS }, async ($, on) => {
  const session = engine(on, { 'session:S1': { 'ak-b': true }, 'session:S2': { 'ak-a': true } })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  await start($)

  await resume($, session, 'S2')
  await $.turn.start({ text: 'hi', turnId: 'T1' })
  expect(await call($, 'ak-a', 'switches')).toEqual({ 'ak-a': true })
})

test('/ak-mods is registered even when the store fails', { plugins: PLUGINS }, async ($, on) => {
  const registered: string[] = []
  on('session.id', () => ({ value: 'S1' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => {
    registered.push(e.name)

    return { value: { command: e.name } }
  })
  for (const event of ['store.get', 'store.set', 'store.keys', 'store.delete'] as const) {
    on(event, () => {
      throw new Error('store down')
    })
  }

  await start($).catch(() => undefined)
  expect(registered).toContain('ak-mods')
})

test('old sessions are pruned', { plugins: PLUGINS }, async ($, on) => {
  const keys = Array.from({ length: 105 }, (_, i) => `session:K${i}`)
  engine(on, Object.fromEntries(keys.map(key => [key, {}])))
  await start($)

  const left = (await call($, 'ak-a', 'keys')).filter((key: string) => key.startsWith('session:'))
  expect(left).toEqual(keys.slice(5))
})

test('the chat being resumed is never pruned', { plugins: PLUGINS }, async ($, on) => {
  const keys = ['session:S1', ...Array.from({ length: 105 }, (_, i) => `session:K${i}`)]
  engine(on, Object.fromEntries(keys.map(key => [key, { 'ak-b': true }])))
  await start($)

  expect(await call($, 'ak-a', 'keys')).toContain('session:S1')
  expect(await call($, 'ak-a', 'isOn', { name: 'ak-b' })).toBe(true)
})
