import { expect, mock, test } from 'claude-code/testing'
import type { On, Register } from 'claude-code'
import type { Engine as TestEngine } from 'claude-code/testing'
import { runCommand } from './command'

import { register } from './fixture/mod'

// fixture/mod.tsx is the recipe of docs/mods/writing-a-mod.md as the mod
// `ak-fixture`; these tests run it with ak-mods. Beneath the plugins stands
// a stand-in engine, beside them a probe that reads and flips switches (the
// test's own `$` carries no `$.mods`). The mod's segment shows in ak-mods's
// shared band; its own band shows only where ak-mods does not switch it.

const probe: Register = on => {
  on('command.run', { command: 'ak-probe' }, async ($, e) => {
    const { op, arg } = JSON.parse(e.args)
    const answer = op === 'set' ? await $.mods.set(arg) : await $.mods.isOn(arg)

    return { text: JSON.stringify(answer ?? null) }
  })
}

const NAME = 'ak-fixture'
const FIXTURE = { name: NAME, register }
const PROBE = { name: 'ak-probe', register: probe }
const PLUGINS = [FIXTURE, PROBE]

// Returns what the plugins asked of the engine: tools registered, panes
// closed, answers invalidated, status lines set; and the clock.
const engine = (on: On, store: Readonly<Record<string, unknown>> = {}) => {
  const registered: string[] = []
  const closed: unknown[] = []
  const invalidated: unknown[] = []
  const statuses: unknown[] = []
  mock.store(on, store)
  const clock = mock.clock(on, { now: 0 })
  on('session.id', () => ({ value: 'S1' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => {
    registered.push(e.name)

    return { value: { tool: `mcp__${NAME}__${e.name}` } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', (_, e) => {
    closed.push(e)

    return { value: undefined }
  })
  on('ui.invalidate', (_, e) => {
    invalidated.push(e)

    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    statuses.push(e)

    return { value: undefined }
  })
  // The engine's own drawing beneath the plugins; the desktop footer draws
  // one Text per mode it is given.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    if (e.component === 'SessionMode') return <Text>{e.props.modes.join(', ')}</Text>

    return <Text>engine</Text>
  })

  return { registered, closed, invalidated, statuses, clock }
}

const start = ($: TestEngine) => $.session.start({ cwd: '/', surface: null, isInteractive: false })

const call = async ($: TestEngine, op: string, arg: unknown) =>
  JSON.parse((await runCommand($, 'ak-probe', JSON.stringify({ op, arg }))).text ?? 'null')

// The band on the terminal, where ak-mods draws the shared one.
const BAND = {
  plugin: NAME,
  component: 'AbovePrompt',
  surface: 'terminal',
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
  expect(await ui.find({ type: 'Text', text: 'Fixture segment' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Fixture band' })).toBeUndefined()
  // `next(e)` passed through: the engine's own drawing stands.
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('switching on shows the segment in the shared band without reload', { plugins: PLUGINS }, async ($, on) => {
  const { clock } = engine(on)
  await start($)

  const ui = await $.ui.mount(BAND)
  await call($, 'set', { name: NAME, on: true })
  // Published on the next turn of the clock, after the switch's hook returned.
  await clock.advance(0)
  expect(await ui.find({ type: 'Text', text: 'Fixture segment' })).toBeDefined()
  // ak-mods draws the segment; the mod draws no band of its own beside it.
  expect(await ui.find({ type: 'Text', text: 'Fixture band' })).toBeUndefined()
  await ui.unmount()
})

test('a mod on from the start shows its segment', { plugins: PLUGINS }, async ($, on) => {
  engine(on, { standard: [NAME] })
  await start($)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'Fixture segment' })).toBeDefined()
  await ui.unmount()
})

test('switching off clears the segment', { plugins: PLUGINS }, async ($, on) => {
  const { clock } = engine(on)
  await start($)
  await call($, 'set', { name: NAME, on: true })
  await clock.advance(0)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'Fixture segment' })).toBeDefined()
  await call($, 'set', { name: NAME, on: false })
  expect(await ui.find({ type: 'Text', text: 'Fixture segment' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Fixture band' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.unmount()
})

test('a quick switch-off drops the scheduled publish', { plugins: PLUGINS }, async ($, on) => {
  const { clock } = engine(on)
  await start($)
  await call($, 'set', { name: NAME, on: true })
  await call($, 'set', { name: NAME, on: false })
  await clock.advance(0)
  // Switched on again, the band shows only what this switch-on publishes:
  // nothing the dropped publish stored while the mod was off.
  await call($, 'set', { name: NAME, on: true })
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'Fixture segment' })).toBeUndefined()
  await clock.advance(0)
  expect(await ui.find({ type: 'Text', text: 'Fixture segment' })).toBeDefined()
  await ui.unmount()
})

test('/branch keeps the segment of a mod that stays on', { plugins: PLUGINS }, async ($, on) => {
  engine(on, { standard: [NAME] })
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  await start($)

  // Whatever ends the chat, ak-mods clears every segment; the branch keeps the switches.
  await $.session.end({ reason: 'other', sessionId: 'S1', resume: { id: 'S1' } })
  await $.classic.SessionStart({ source: 'fork' })
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'Fixture segment' })).toBeDefined()
  await ui.unmount()
})

test('/clear keeps the segment of a mod that stays on', { plugins: PLUGINS }, async ($, on) => {
  engine(on, { standard: [NAME] })
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  await start($)

  // ak-mods clears every segment as the chat ends; the mod publishes again.
  await $.session.end({ reason: 'clear', sessionId: 'S1', resume: { id: 'S1' } })
  await $.classic.SessionStart({ source: 'clear' })
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'Fixture segment' })).toBeDefined()
  await ui.unmount()
})

test('/resume shows the segment of a mod on in the resumed chat before any turn', { plugins: PLUGINS }, async ($, on) => {
  engine(on, { standard: [NAME] })
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  await start($)

  // The resume empties the switches until the next turn; the restore answers from the store.
  await $.session.end({ reason: 'resume', sessionId: 'S1', resume: { id: 'S1' } })
  await $.classic.SessionStart({ source: 'resume' })
  const band = await $.ui.mount(BAND)
  expect(await band.find({ type: 'Text', text: 'Fixture segment' })).toBeDefined()
  await band.unmount()

  const footer = await $.ui.mount({ plugin: NAME, component: 'SessionMode', surface: 'desktop', props: { modes: [] } })
  expect(await footer.find({ type: 'Text', text: 'Fixture segment' })).toBeDefined()
  await footer.unmount()
})

test("the mod's command turns it on", { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await start($)

  expect((await runCommand($, 'fixture')).text).toBe('Fixture is on.')
  expect(await call($, 'isOn', { name: NAME })).toBe(true)
})

test('an off mod registers no tool until it is switched on', { plugins: PLUGINS }, async ($, on) => {
  const { registered } = engine(on)
  await start($)
  expect(registered).toEqual([])

  await call($, 'set', { name: NAME, on: true })
  expect(registered).toEqual(['probe'])
})

test('a mod on from the start registers its tool', { plugins: PLUGINS }, async ($, on) => {
  const { registered } = engine(on, { standard: [NAME] })
  await start($)

  expect(registered).toContain('probe')
})

test('a tool registered before switching off is hidden', { plugins: PLUGINS }, async ($, on) => {
  const { invalidated } = engine(on)
  on('tool.describe', (_, e) => ({ description: e.description }))
  await start($)
  await call($, 'set', { name: NAME, on: true })
  expect(await $.tool.describe(DESCRIBE)).toEqual({ description: 'Answers a probe.' })

  await call($, 'set', { name: NAME, on: false })
  expect(invalidated).toEqual([{ event: 'tool.describe' }, { event: 'tool.describe' }])
  expect(await $.tool.describe(DESCRIBE)).toEqual({ description: 'Off in this chat. Do not call it.', isDeferred: true })
})

test('a tool call while off says how to turn the mod on', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await start($)
  await call($, 'set', { name: NAME, on: true })
  expect((await $.tool.call({ tool: 'mcp__ak-fixture__probe' })).result).toBe('Probed.')

  await call($, 'set', { name: NAME, on: false })
  expect((await $.tool.call({ tool: 'mcp__ak-fixture__probe' })).result).toBe(
    'ak-fixture is off in this chat. The person can turn it on with /ak-mods.',
  )
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

  await runCommand($, 'fixture')
  expect(closed).toEqual([])

  await call($, 'set', { name: NAME, on: false })
  expect(closed).toEqual([{ id: NAME, origin: { kind: 'plugin' } }])
})

test('switching off clears the status line', { plugins: PLUGINS }, async ($, on) => {
  const { statuses } = engine(on)
  await start($)
  await call($, 'set', { name: NAME, on: true })
  expect(statuses).toEqual([])

  await call($, 'set', { name: NAME, on: false })
  expect(statuses).toEqual([{ text: undefined }])
})

// Below the fixture, it answers the first write that switches the fixture on
// as a lost race: not set. ak-mods reads again and writes once more.
const stale: Register = on => {
  let isLost = false
  on('state.set', { plugin: 'ak-mods', key: 'on' }, ($, e, next) => {
    if (!isLost && e.value['ak-fixture'] === true) {
      isLost = true

      return { value: { isSet: false, version: e.ifVersion ?? 0 } }
    }

    return next(e)
  })
}

test(
  'a switch write that did not land changes nothing',
  { plugins: [...PLUGINS, { name: 'ak-stale', tier: 'append', register: stale }] },
  async ($, on) => {
    const { registered, invalidated } = engine(on)
    await start($)

    await call($, 'set', { name: NAME, on: true })
    expect(registered).toEqual(['probe'])
    expect(invalidated).toEqual([{ event: 'tool.describe' }])
  },
)

// Above ak-mods, it denies every declare: the caller's call throws.
const broken: Register = on => {
  on('mods.declare', () => ({ deny: 'declare failed' }))
}

for (const [name, plugins] of [
  // ak-mods refuses a declare from a plugin that is not AgentKit's.
  ['refused', [{ name: 'not-agentkit', register }, PROBE]],
  ['thrown', [{ name: 'ak-broken', tier: 'prepend', register: broken }, ...PLUGINS]],
] as const) {
  test(`a declare ${name} leaves the mod on`, { plugins }, async ($, on) => {
    const { registered } = engine(on)
    await start($)
    expect(registered).toEqual(['probe'])

    const ui = await $.ui.mount(BAND)
    expect(await ui.find({ type: 'Text', text: 'Fixture band' })).toBeDefined()
    await ui.unmount()

    expect((await runCommand($, 'fixture')).text).toBe('Fixture is on.')
    expect((await $.tool.call({ tool: 'mcp__ak-fixture__probe' })).result).toBe('Probed.')
  })
}
