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
            : op === 'segment'
              ? await $.mods.segment(arg)
              : await $.store.get(arg)

    return { text: JSON.stringify(answer ?? null) }
  })
}

const PLUGINS = [{ name: 'ak-fixture', register: probe }]

// Mods that publish segments, each loading the probe under its own name.
const MODS = ['ak-a', 'ak-b', 'ak-c', 'ak-d'].map(name => ({ name, register: probe }))

// The engine beneath the plugins: a store and the chat `S1`.
const engine = (on: On, store: Readonly<Record<string, unknown>> = {}) => {
  mock.store(on, store)
  on('session.id', () => ({ value: 'S1' }))
}

const call = async ($: Engine, op: string, arg?: unknown) =>
  JSON.parse((await runCommand($, 'ak-fixture', JSON.stringify({ op, arg }))).text ?? 'null')

const declare = ($: Engine, title = 'Fixture') =>
  call($, 'declare', { name: 'ak-fixture', title, summary: 's', details: 'd' })

const callAs = async ($: Engine, plugin: string, op: string, arg?: unknown) =>
  JSON.parse((await runCommand($, plugin, JSON.stringify({ op, arg }))).text ?? 'null')

/** As in band-render.test.tsx: declares the mod, switches it on unless told not to, and publishes. */
const publish = async ($: Engine, name: string, title: string, isOn = true) => {
  await callAs($, name, 'declare', { name, title, summary: 's', details: 'd' })
  // Off means switched on and back off before the publish: the switch-off clears
  // the segment, the later publish lands anyway, so only the filter hides it.
  await callAs($, name, 'set', { name, on: true })
  if (!isOn) await callAs($, name, 'set', { name, on: false })
  await callAs($, name, 'segment', { text: SEGMENT })
}

// 25 columns a segment. In a 40-column band each takes a row of its own, so
// two fit and a third is dropped; in the desktop footer (60 columns) two fit
// side by side and a third is dropped. Both surfaces drop the same mods.
const SEGMENT = 'x'.repeat(25)
const NARROW = { ...PANE.props, bodyColumns: 40 }

const warningOf = async (ui: { find: (q: { type: string; text: RegExp }) => Promise<{ text: string } | undefined> }) =>
  (await ui.find({ type: 'Text', text: /fits? the band/ }))?.text

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

test('no warning when everything fits', { plugins: MODS }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'Alpha')
  await publish($, 'ak-b', 'Beta')

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: NARROW })
    expect(await warningOf(ui)).toBeUndefined()
    await ui.unmount()
  }
})

test('a warning names the mods that do not fit the band', { plugins: MODS }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'Alpha')
  await publish($, 'ak-b', 'Beta')
  await publish($, 'ak-c', 'Gamma')
  await publish($, 'ak-d', 'Delta')

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: NARROW })
    // Display order: same priority, so by title.
    expect(await warningOf(ui)).toBe('2 mods do not fit the band: Delta, Gamma')
    await ui.unmount()
  }
})

test('one mod that does not fit is named in the singular', { plugins: MODS }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'Alpha')
  await publish($, 'ak-b', 'Beta')
  await publish($, 'ak-c', 'Gamma')

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: NARROW })
    expect(await warningOf(ui)).toBe('1 mod does not fit the band: Gamma')
    await ui.unmount()
  }
})

test('the warning sits above the footer', { plugins: MODS }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'Alpha')
  await publish($, 'ak-b', 'Beta')
  await publish($, 'ak-c', 'Gamma')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: NARROW })
  const texts = (await ui.findAll({ type: 'Text' })).map(one => one.text)
  expect(texts.slice(-2)).toEqual(['1 mod does not fit the band: Gamma', FOOTER])
  await ui.unmount()
})

test('the warning goes once a mod is switched off', { plugins: MODS }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'Alpha')
  await publish($, 'ak-b', 'Beta')
  await publish($, 'ak-c', 'Gamma')

  for (const surface of SURFACES) {
    await callAs($, 'ak-c', 'set', { name: 'ak-c', on: true })
    await callAs($, 'ak-c', 'segment', { text: SEGMENT })
    const ui = await $.ui.mount({ ...PANE, surface, props: NARROW })
    expect(await warningOf(ui)).toBe('1 mod does not fit the band: Gamma')
    await callAs($, 'ak-c', 'set', { name: 'ak-c', on: false })
    expect(await warningOf(ui)).toBeUndefined()
    await ui.unmount()
  }
})

test("an off mod's segment never counts", { plugins: MODS }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'Alpha')
  await publish($, 'ak-b', 'Beta')
  // Off, with its segment in state all the same: it would be the third.
  await publish($, 'ak-c', 'Gamma', false)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: NARROW })
    expect(await warningOf(ui)).toBeUndefined()
    await ui.unmount()
  }
})

/** The engine, with a `ui.open` that places the pane, so `/ak-mods` runs. */
const placing = (on: On) => {
  engine(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
}

/** Runs `/ak-mods` in a terminal `columns` wide, which records that width. */
const record = ($: Engine, columns: number) => runCommand($, 'ak-mods', '', columns)

/** Alpha, Beta and Gamma, 25 columns each: one row of 81 holds all three. */
const three = async ($: Engine) => {
  await publish($, 'ak-a', 'Alpha')
  await publish($, 'ak-b', 'Beta')
  await publish($, 'ak-c', 'Gamma')
}

test('the terminal counts with the recorded width, not the pane width', { plugins: MODS }, async ($, on) => {
  placing(on)
  await three($)

  // The band is 81 wide and shows all three: the 40-column pane beside it does not warn.
  await record($, 81)
  const narrow = await $.ui.mount({ ...PANE, surface: 'terminal', props: NARROW })
  expect(await warningOf(narrow)).toBeUndefined()
  await narrow.unmount()

  // The band is 40 wide and drops one: a pane wider than that warns all the same.
  await record($, 40)
  const wide = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 200 } })
  expect(await warningOf(wide)).toBe('1 mod does not fit the band: Gamma')
  await wide.unmount()
})

test('the warning updates when the recorded width changes', { plugins: MODS }, async ($, on) => {
  placing(on)
  await three($)
  await record($, 81)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: NARROW })
  expect(await warningOf(ui)).toBeUndefined()
  await record($, 40)
  expect(await warningOf(ui)).toBe('1 mod does not fit the band: Gamma')
  await record($, 81)
  expect(await warningOf(ui)).toBeUndefined()
  await ui.unmount()
})

test('a terminal width of 0 or NaN is not recorded', { plugins: MODS }, async ($, on) => {
  placing(on)
  await three($)
  await record($, 81)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: NARROW })
  for (const columns of [0, Number.NaN]) {
    await record($, columns)
    // Still 81: all three fit, so no warning.
    expect(await warningOf(ui)).toBeUndefined()
  }
  await ui.unmount()
})

// Below ak-mods, as contract.test.tsx's `stale`: it denies every write of the
// width, so ak-mods' `$.state.set` rejects.
const failing: Register = on => {
  on('state.set', { plugin: 'ak-mods', key: 'width' }, () => ({ deny: 'state down' }))
}

test(
  '/ak-mods opens the pane when the width cannot be recorded',
  { plugins: [...PLUGINS, { name: 'ak-failing', tier: 'append', register: failing }] },
  async ($, on) => {
    engine(on)
    const opened: unknown[] = []
    on('ui.open', (_, e) => {
      opened.push(e)

      return { value: { isPlaced: true } }
    })

    const ran = await runCommand($, 'ak-mods')
    expect(ran.text).toBe('Opened the Mods pane.')
    expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
  },
)

test('the desktop counts with the footer width', { plugins: MODS }, async ($, on) => {
  placing(on)
  await three($)
  // Neither the recorded width nor the pane's counts: the 60-column footer drops one.
  await record($, 200)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 200 } })
  expect(await warningOf(ui)).toBe('1 mod does not fit the band: Gamma')
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
