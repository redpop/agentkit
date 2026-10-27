import { expect, mock, test } from 'claude-code/testing'
import type { On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { runCommand } from './command'

import type { ModsInfo } from '../types'

// The test's own `$` is the engine's and carries neither the plugin nouns
// nor `$.state`, so every `$.mods` call and state read is made from inside a
// consumer plugin. Each consumer loads this one probe: its command, named
// after the plugin, runs the call its args spell as JSON and prints the
// answer as JSON.
const probe: Register = on => {
  on('command.run', async ($, e, next) => {
    if (e.command !== $.plugin.name) {
      return next(e)
    }

    const { op, arg } = JSON.parse(e.args)
    const answer =
      op === 'declare'
        ? await $.mods.declare(arg)
        : op === 'isOn'
          ? await $.mods.isOn(arg)
          : op === 'set'
            ? await $.mods.set(arg)
            : op === 'setStandard'
              ? await $.mods.setStandard(arg)
              : op === 'switches'
                ? (await $.state.get({ plugin: 'ak-mods', key: 'on' })).value
                : op === 'store'
                  ? await $.store.get(arg)
                  : op === 'putStore'
                    ? await $.store.set(arg.key, arg.value)
                    : op === 'segment'
                      ? await $.mods.segment(arg)
                      : op === 'segments'
                        ? (await $.state.get({ plugin: 'ak-mods', key: 'segments' })).value
                        : await $.mods.list()

    return { text: JSON.stringify(answer ?? null) }
  })
}

const consumer = (name: string) => ({ name, register: probe })

// The engine beneath the plugins: a store and the chat `S1`.
const engine = (on: On, store: Readonly<Record<string, unknown>> = {}) => {
  mock.store(on, store)
  on('session.id', () => ({ value: 'S1' }))
}

const call = async ($: Engine, plugin: string, op: string, arg?: unknown) => {
  const ran = await runCommand($, plugin, JSON.stringify({ op, arg }))

  return JSON.parse(ran.text ?? 'null')
}

const FIXTURE: ModsInfo = { name: 'ak-fixture', title: 'Fixture', summary: 's', details: 'd' }

test('declare then isOn is false for a non-standard mod', { plugins: [consumer('ak-fixture')] }, async ($, on) => {
  engine(on)

  expect(await call($, 'ak-fixture', 'declare', FIXTURE)).toBe(true)
  expect(await call($, 'ak-fixture', 'isOn', { name: 'ak-fixture' })).toBe(false)
})

test('set flips isOn immediately', { plugins: [consumer('ak-fixture')] }, async ($, on) => {
  engine(on)

  await call($, 'ak-fixture', 'declare', FIXTURE)
  await call($, 'ak-fixture', 'set', { name: 'ak-fixture', on: true })

  expect(await call($, 'ak-fixture', 'isOn', { name: 'ak-fixture' })).toBe(true)
  expect((await call($, 'ak-fixture', 'switches'))['ak-fixture']).toBe(true)
})

test('declaring twice keeps one row and the switch', { plugins: [consumer('ak-fixture')] }, async ($, on) => {
  engine(on)

  await call($, 'ak-fixture', 'declare', FIXTURE)
  await call($, 'ak-fixture', 'set', { name: 'ak-fixture', on: true })
  await call($, 'ak-fixture', 'declare', { ...FIXTURE, title: 'Fixture 2' })

  const list = await call($, 'ak-fixture', 'list')
  expect(list.length).toBe(1)
  expect(list[0].title).toBe('Fixture 2')
  expect(list[0].isOn).toBe(true)
})

test('a non-AgentKit plugin is refused', { plugins: [consumer('other-plugin')] }, async ($, on) => {
  engine(on)

  const info = { name: 'other-plugin', title: 'Other', summary: 's', details: 'd' }
  expect(await call($, 'other-plugin', 'declare', info)).toBe(false)
  expect(await call($, 'other-plugin', 'list')).toEqual([])
})

test('a plugin declaring another name is refused', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)

  expect(await call($, 'ak-a', 'declare', { name: 'ak-b', title: 'B', summary: 's', details: 'd' })).toBe(false)
  expect(await call($, 'ak-a', 'list')).toEqual([])
})

test('list is sorted by title', { plugins: [consumer('ak-b'), consumer('ak-a')] }, async ($, on) => {
  engine(on)

  await call($, 'ak-b', 'declare', { name: 'ak-b', title: 'beta', summary: 's', details: 'd' })
  await call($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })

  const list = await call($, 'ak-a', 'list')
  expect(list.map((row: { title: string }) => row.title)).toEqual(['Alpha', 'beta'])
})

test('standard marks come from the store and setStandard changes them', { plugins: [consumer('ak-fixture')] }, async ($, on) => {
  engine(on, { standard: ['ak-fixture'] })

  await call($, 'ak-fixture', 'declare', FIXTURE)
  expect((await call($, 'ak-fixture', 'list'))[0].isStandard).toBe(true)

  await call($, 'ak-fixture', 'setStandard', { name: 'ak-fixture', standard: false })
  expect((await call($, 'ak-fixture', 'list'))[0].isStandard).toBe(false)
})

test('setStandard keeps a mark another chat stored meanwhile', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on, { standard: [] })

  await call($, 'ak-a', 'setStandard', { name: 'ak-a', standard: true })
  // Another chat marks ak-x: the store is shared, this chat's state is not.
  await call($, 'ak-a', 'putStore', { key: 'standard', value: ['ak-a', 'ak-x'] })
  await call($, 'ak-a', 'setStandard', { name: 'ak-b', standard: true })

  expect(await call($, 'ak-a', 'store', 'standard')).toEqual(['ak-a', 'ak-x', 'ak-b'])
})

test('segment stores under the caller\'s name', { plugins: [consumer('ak-fixture')] }, async ($, on) => {
  engine(on)

  await call($, 'ak-fixture', 'declare', FIXTURE)
  await call($, 'ak-fixture', 'segment', { text: 'ready', tone: 'ok' })

  expect(await call($, 'ak-fixture', 'segments')).toEqual({ 'ak-fixture': { text: 'ready', tone: 'ok' } })
})

test('segment replaces and clears', { plugins: [consumer('ak-fixture')] }, async ($, on) => {
  engine(on)

  await call($, 'ak-fixture', 'declare', FIXTURE)
  await call($, 'ak-fixture', 'segment', { text: 'one' })
  await call($, 'ak-fixture', 'segment', { text: 'two', priority: 7 })
  expect(await call($, 'ak-fixture', 'segments')).toEqual({ 'ak-fixture': { text: 'two', priority: 7 } })

  await call($, 'ak-fixture', 'segment')
  expect(await call($, 'ak-fixture', 'segments')).toEqual({})
})

test('undeclared caller is refused', { plugins: [consumer('ak-x')] }, async ($, on) => {
  engine(on)

  expect(await call($, 'ak-x', 'segment', { text: 'sneaky' })).toBe(null)
  expect(await call($, 'ak-x', 'segments')).toBe(null)
})

test('switching a mod off clears its segment', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)

  await call($, 'ak-a', 'declare', { name: 'ak-a', title: 'A', summary: 's', details: 'd' })
  await call($, 'ak-b', 'declare', { name: 'ak-b', title: 'B', summary: 's', details: 'd' })
  await call($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await call($, 'ak-a', 'segment', { text: 'a' })
  await call($, 'ak-b', 'segment', { text: 'b' })

  // Switching on keeps it; switching off drops only that mod's segment.
  await call($, 'ak-a', 'set', { name: 'ak-a', on: true })
  expect(await call($, 'ak-a', 'segments')).toEqual({ 'ak-a': { text: 'a' }, 'ak-b': { text: 'b' } })
  await call($, 'ak-a', 'set', { name: 'ak-a', on: false })
  expect(await call($, 'ak-a', 'segments')).toEqual({ 'ak-b': { text: 'b' } })
})

test(
  'a rejected declare leaves $.mods.segment throwing nothing for other mods',
  { plugins: [consumer('ak-a'), consumer('other-plugin')] },
  async ($, on) => {
    engine(on)

    await call($, 'ak-a', 'declare', { name: 'ak-a', title: 'A', summary: 's', details: 'd' })
    await call($, 'ak-a', 'segment', { text: 'a' })
    expect(await call($, 'other-plugin', 'declare', { name: 'other-plugin', title: 'O', summary: 's', details: 'd' })).toBe(
      false,
    )

    expect(await call($, 'other-plugin', 'segment', { text: 'o' })).toBe(null)
    expect(await call($, 'ak-a', 'segments')).toEqual({ 'ak-a': { text: 'a' } })
  },
)
