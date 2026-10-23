import { expect, mock, test } from 'claude-code/testing'
import type { On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'

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

// Declares itself and turns itself on in its `session.start`, so the switch
// is written before ak-mods restores the session.
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
  const ran = await $.command.run({ command: plugin, args: JSON.stringify({ op, arg }) })

  return JSON.parse(ran.text ?? 'null')
}

// The engine beneath the plugins: a session `S1` that starts and ends.
const engine = (on: On, store: Readonly<Record<string, unknown>>) => {
  mock.store(on, store)
  on('session.id', () => ({ value: 'S1' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('command.register', () => ({ value: { command: 'ak-mods' } }))
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
  'a mod declaring before restore keeps the restored switch',
  { plugins: [{ name: 'ak-b', tier: 'prepend', register: probe }, { name: 'ak-c', tier: 'prepend', register: early }] },
  async ($, on) => {
    engine(on, { 'session:S1': { 'ak-b': true } })
    await start($)

    expect(await call($, 'ak-b', 'isOn', { name: 'ak-b' })).toBe(true)
    // A switch written this load, before the restore, is kept and saved too.
    expect(await call($, 'ak-b', 'isOn', { name: 'ak-c' })).toBe(true)
    expect(await call($, 'ak-b', 'store', 'session:S1')).toEqual({ 'ak-b': true, 'ak-c': true })
  },
)

test(
  'a mod switching on before restore in a new chat keeps the standard set',
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

test('/clear resets to the standard set', { plugins: PLUGINS }, async ($, on) => {
  engine(on, { standard: ['ak-a'], 'session:S1': { 'ak-b': true, 'ak-a': false } })
  await start($)
  await $.session.end({ reason: 'clear', sessionId: 'S1', resume: { id: 'S1' } })

  expect(await call($, 'ak-a', 'switches')).toEqual(initialOn(['ak-a'], undefined))
  expect(await call($, 'ak-a', 'keys')).not.toContain('session:S1')
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
