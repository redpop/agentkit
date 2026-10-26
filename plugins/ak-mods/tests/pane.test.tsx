import { expect, mock, test } from 'claude-code/testing'
import type { On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { runCommand } from './command'

import { FOOTER } from '../hooks/pane'

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
          : op === 'set'
            ? await $.mods.set(arg)
            : await $.store.get(arg)

    return { text: JSON.stringify(answer ?? null) }
  })
}

const PLUGINS = [{ name: 'ak-fixture', register: probe }]

// The engine beneath the plugins: a store and the chat `S1`.
const engine = (on: On, store: Readonly<Record<string, unknown>> = {}) => {
  mock.store(on, store)
  on('session.id', () => ({ value: 'S1' }))
}

const call = async ($: Engine, op: string, arg?: unknown) =>
  JSON.parse((await runCommand($, 'ak-fixture', JSON.stringify({ op, arg }))).text ?? 'null')

const declare = ($: Engine, title = 'Fixture') =>
  call($, 'declare', { name: 'ak-fixture', title, summary: 's', details: 'd' })

test('empty pane says no mods', { plugins: PLUGINS }, async ($, on) => {
  engine(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'No AgentKit mods installed.' })).toBeDefined()
    await ui.unmount()
  }
})

test('a row shows title, summary and switches', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await declare($)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: 'Fixture' }))?.text).toBe('Fixture')
    expect((await ui.find({ type: 'Text', text: 's' }))?.text).toBe('s')
    expect((await ui.find({ key: 'on-ak-fixture' }))?.text).toBe('○ Off')
    expect((await ui.find({ key: 'std-ak-fixture' }))?.text).toBe('☆ Standard')
    expect((await ui.find({ key: 'more-ak-fixture' }))?.text).toBe('More')
    await ui.unmount()
  }
})

test('pressing On flips the switch and redraws', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await declare($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'on-ak-fixture' })
  expect((await ui.find({ key: 'on-ak-fixture' }))?.text).toBe('● On')
  expect(await call($, 'isOn', { name: 'ak-fixture' })).toBe(true)
  await ui.unmount()
})

test('pressing Standard persists, without switching the mod on', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await declare($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'std-ak-fixture' })
  expect((await ui.find({ key: 'std-ak-fixture' }))?.text).toBe('★ Standard')
  expect(await call($, 'store', 'standard')).toContain('ak-fixture')
  expect(await call($, 'isOn', { name: 'ak-fixture' })).toBe(false)
  await ui.unmount()
})

test('More reveals details', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await declare($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^d$/ })).toBeUndefined()
  await ui.press({ key: 'more-ak-fixture' })
  expect(await ui.find({ type: 'Text', text: /^d$/ })).toBeDefined()
  expect((await ui.find({ key: 'more-ak-fixture' }))?.text).toBe('Less')
  await ui.unmount()
})

test('a mod declaring after mount appears', { plugins: PLUGINS }, async ($, on) => {
  engine(on)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Fixture' })).toBeUndefined()
  await declare($)
  expect(await ui.find({ type: 'Text', text: 'Fixture' })).toBeDefined()
  await ui.unmount()
})

test('a switch flipped outside the pane redraws its label', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await declare($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'on-ak-fixture' }))?.text).toBe('○ Off')
  await call($, 'set', { name: 'ak-fixture', on: true })
  expect((await ui.find({ key: 'on-ak-fixture' }))?.text).toBe('● On')
  await ui.unmount()
})

test('a long title wraps instead of being cut', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  const title = 'Fixture with a title far wider than the pane'
  await declare($, title)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 12 } })
  expect((await ui.find({ type: 'Text', text: title }))?.text).toBe(title)
  await ui.unmount()
})

test('footer is shown', { plugins: PLUGINS }, async ($, on) => {
  engine(on)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: FOOTER })).toBeDefined()
  await ui.unmount()
})

test('/ak-mods opens the pane', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  const opened: unknown[] = []
  on('ui.open', (_, e) => {
    opened.push(e)

    return { value: { isPlaced: true } }
  })

  const ran = await runCommand($, 'ak-mods')
  expect(ran.text).toBe('Opened the Mods pane.')
  expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
})
