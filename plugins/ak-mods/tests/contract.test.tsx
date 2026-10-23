import { expect, mock, test } from 'claude-code/testing'
import type { On, Register } from 'claude-code'
import type { Engine as TestEngine } from 'claude-code/testing'

import { register } from './fixture/mod'

// fixture/mod.tsx is the recipe of docs/mods/writing-a-mod.md as the mod
// `ak-fixture`; these tests run it with ak-mods. Beneath the plugins stands
// a stand-in engine, beside them a probe that reads and flips switches (the
// test's own `$` carries no `$.mods`).

const probe: Register = on => {
  on('command.run', { command: 'ak-probe' }, async ($, e) => {
    const { op, arg } = JSON.parse(e.args)
    const answer = op === 'set' ? await $.mods.set(arg) : await $.mods.isOn(arg)

    return { text: JSON.stringify(answer ?? null) }
  })
}

const NAME = 'ak-fixture'
const FIXTURE = { name: NAME, register }
const PLUGINS = [FIXTURE, { name: 'ak-probe', register: probe }]

// Returns what the plugins asked of the display: panes closed, answers invalidated.
const engine = (on: On) => {
  const closed: unknown[] = []
  const invalidated: unknown[] = []
  mock.store(on)
  on('session.id', () => ({ value: 'S1' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__${NAME}__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', (_, e) => {
    closed.push(e)

    return { value: undefined }
  })
  on('ui.invalidate', (_, e) => {
    invalidated.push(e)

    return { value: undefined }
  })
  // The engine's own drawing beneath the plugins.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  return { closed, invalidated }
}

const start = ($: TestEngine) => $.session.start({ cwd: '/', surface: null, isInteractive: false })

const call = async ($: TestEngine, op: string, arg: unknown) =>
  JSON.parse((await $.command.run({ command: 'ak-probe', args: JSON.stringify({ op, arg }) })).text ?? 'null')

const BAND = {
  plugin: NAME,
  component: 'AbovePrompt',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 3,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 3 },
    view: {},
  },
} as const

const DESCRIBE = {
  tool: 'mcp__ak-fixture__probe',
  description: 'Answers a probe.',
  provider: { plugin: NAME, tier: 'user' },
} as const

test('an off mod draws nothing', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await start($)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'Fixture band' })).toBeUndefined()
  await ui.unmount()
})

test('switching on draws the band without reload', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await start($)

  const ui = await $.ui.mount(BAND)
  await call($, 'set', { name: NAME, on: true })
  expect(await ui.find({ type: 'Text', text: 'Fixture band' })).toBeDefined()
  await ui.unmount()
})

test("the mod's command turns it on", { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await start($)

  expect((await $.command.run({ command: 'fixture' })).text).toBe('Fixture is on.')
  expect(await call($, 'isOn', { name: NAME })).toBe(true)
})

test('a tool of an off mod is hidden', { plugins: PLUGINS }, async ($, on) => {
  const { invalidated } = engine(on)
  on('tool.describe', (_, e) => ({ description: e.description }))
  await start($)

  expect(await $.tool.describe(DESCRIBE)).toEqual({ description: 'Off in this chat. Do not call it.', isDeferred: true })

  await call($, 'set', { name: NAME, on: true })
  expect(invalidated).toEqual([{ event: 'tool.describe' }])
  expect(await $.tool.describe(DESCRIBE)).toEqual({ description: 'Answers a probe.' })
})

test('a tool call of an off mod finds no answer', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  // What the engine answers a call no hook answered.
  on('tool.call', () => ({ deny: 'unanswered' }))
  await start($)

  expect(await $.tool.call({ tool: 'mcp__ak-fixture__probe' })).toEqual({ deny: 'unanswered' })

  await call($, 'set', { name: NAME, on: true })
  expect((await $.tool.call({ tool: 'mcp__ak-fixture__probe' })).result).toBe('Probed.')
})

test('an agent of an off mod is not offered', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  on('agent.offer', () => ({ isOffered: true }))
  await start($)

  const offer = { agent: 'ak-fixture:helper', description: 'Helps.', source: 'plugin', provider: { plugin: NAME, tier: 'user' } } as const
  expect(await $.agent.offer(offer)).toEqual({ isOffered: false })

  await call($, 'set', { name: NAME, on: true })
  expect(await $.agent.offer(offer)).toEqual({ isOffered: true })
})

test('switching off closes the pane', { plugins: PLUGINS }, async ($, on) => {
  const { closed } = engine(on)
  await start($)

  await $.command.run({ command: 'fixture' })
  expect(closed).toEqual([])

  await call($, 'set', { name: NAME, on: false })
  expect(closed).toEqual([{ id: NAME, origin: { kind: 'plugin' } }])
})
