import { expect, mock, test } from 'claude-code/testing'
import type { Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const FOOTER = 'Switches reset in a new chat or after /clear. Standard mods start on.'

const PANE = {
  plugin: 'ak-mods',
  component: 'Pane',
  requestId: 'ak-mods',
  props: {
    title: 'Mods',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const SURFACES = ['desktop', 'terminal'] as const

// As in noun.test.ts: nouns and state are reached from inside a consumer.
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
          : await $.store.get(arg)

    return { text: JSON.stringify(answer ?? null) }
  })
}

const PLUGINS = [{ name: 'ak-fixture', register: probe }]

const call = async ($: Engine, op: string, arg?: unknown) =>
  JSON.parse((await $.command.run({ command: 'ak-fixture', args: JSON.stringify({ op, arg }) })).text ?? 'null')

const declare = ($: Engine) =>
  call($, 'declare', { name: 'ak-fixture', title: 'Fixture', summary: 's', details: 'd' })

test('empty pane says no mods', { plugins: PLUGINS }, async ($, on) => {
  mock.store(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'No AgentKit mods installed.' })).toBeDefined()
    await ui.unmount()
  }
})

test('a row shows title, summary and switches', { plugins: PLUGINS }, async ($, on) => {
  mock.store(on)
  await declare($)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: 'Fixture' }))?.text).toBe('Fixture')
    expect((await ui.find({ type: 'Text', text: 's' }))?.text).toBe('s')
    expect((await ui.find({ key: 'on-ak-fixture' }))?.text).toBe('Off')
    expect((await ui.find({ key: 'std-ak-fixture' }))?.text).toBe('Standard')
    expect((await ui.find({ key: 'more-ak-fixture' }))?.text).toBe('More')
    await ui.unmount()
  }
})

test('pressing On flips the switch and redraws', { plugins: PLUGINS }, async ($, on) => {
  mock.store(on)
  await declare($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'on-ak-fixture' })
  expect((await ui.find({ key: 'on-ak-fixture' }))?.text).toBe('On')
  expect(await call($, 'isOn', { name: 'ak-fixture' })).toBe(true)
  await ui.unmount()
})

test('pressing Standard persists, without switching the mod on', { plugins: PLUGINS }, async ($, on) => {
  mock.store(on)
  await declare($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'std-ak-fixture' })
  expect((await ui.find({ key: 'std-ak-fixture' }))?.text).toBe('Standard ✓')
  expect(await call($, 'store', 'standard')).toContain('ak-fixture')
  expect(await call($, 'isOn', { name: 'ak-fixture' })).toBe(false)
  await ui.unmount()
})

test('More reveals details', { plugins: PLUGINS }, async ($, on) => {
  mock.store(on)
  await declare($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^d$/ })).toBeUndefined()
  await ui.press({ key: 'more-ak-fixture' })
  expect(await ui.find({ type: 'Text', text: /^d$/ })).toBeDefined()
  expect((await ui.find({ key: 'more-ak-fixture' }))?.text).toBe('Less')
  await ui.unmount()
})

test('footer is shown', { plugins: PLUGINS }, async ($, on) => {
  mock.store(on)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: FOOTER })).toBeDefined()
  await ui.unmount()
})

test('/ak-mods opens the pane', { plugins: PLUGINS }, async ($, on) => {
  mock.store(on)
  const opened: unknown[] = []
  on('ui.open', (_, e) => {
    opened.push(e)

    return { value: { isPlaced: true } }
  })

  const ran = await $.command.run({ command: 'ak-mods' })
  expect(ran.text).toBe('Opened the Mods pane.')
  expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
})
