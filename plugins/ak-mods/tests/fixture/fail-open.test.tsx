import { expect, mock, test } from 'claude-code/testing'
import type { Register } from 'claude-code'

import { register } from './mod'

// Run on its own (`claude plugin test plugins/ak-mods/tests/fixture`), this
// file loads the fixture mod with no ak-mods at all. Run with ak-mods
// (`claude plugin test plugins/ak-mods`), ak-mods is the plugin under test,
// and the plugin above it takes `$.mods` away again. Either way the mod finds
// no switcher and must behave as on.
const unswitched: Register = on => {
  on('engine.create', async ($, e, next) => {
    const { mods, ...rest } = await next(e)

    return rest
  })
}

const PLUGINS = [
  { name: 'ak-unswitched', tier: 'prepend', register: unswitched },
  { name: 'ak-fixture', register },
] as const

const BAND = {
  plugin: 'ak-fixture',
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
  provider: { plugin: 'ak-fixture', tier: 'user' },
} as const

test('without ak-mods the mod is on', { plugins: PLUGINS }, async ($, on) => {
  mock.store(on)
  on('session.id', () => ({ value: 'S1' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  const registered: string[] = []
  on('tool.register', (_, e) => {
    registered.push(e.name)

    return { value: { tool: `mcp__ak-fixture__${e.name}` } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.describe', (_, e) => ({ description: e.description }))
  on('agent.offer', () => ({ isOffered: true }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  expect(registered).toEqual(['probe'])

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'Fixture band' })).toBeDefined()
  await ui.unmount()

  // Inlines origin/presentation: this standalone harness must not import ../command.
  expect((await $.command.run({ command: 'fixture', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })).text).toBe('Fixture is on.')
  expect(await $.tool.describe(DESCRIBE)).toEqual({ description: 'Answers a probe.' })
  expect(
    await $.agent.offer({ agent: 'ak-fixture:helper', description: 'Helps.', source: 'plugin', provider: { plugin: 'ak-fixture', tier: 'user' } }),
  ).toEqual({ isOffered: true })
  expect((await $.tool.call({ tool: 'mcp__ak-fixture__probe' })).result).toBe('Probed.')
})
