import { expect, mock, test } from 'claude-code/testing'
import type { ConfigRow, On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { runCommand } from './command'

import { texts } from '../hooks/i18n'

const FOOTER = texts('en').footer

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
// two fit and a third is dropped, on the terminal and the desktop alike.
const SEGMENT = 'x'.repeat(25)
const NARROW = { ...PANE.props, bodyColumns: 40 }

const warningOf = async (ui: { find: (q: { type: string; text: RegExp }) => Promise<{ text: string } | undefined> }) =>
  (await ui.find({ type: 'Text', text: /fits? the band/ }))?.text

/** The Text that reads exactly `text`: `find` matches a part of the text, and so its parent too. */
const exactly = async (ui: { findAll: (q: { type: string }) => Promise<{ text: string; props: Record<string, unknown> }[]> }, text: string) =>
  (await ui.findAll({ type: 'Text' })).find(one => one.text === text)

test('empty pane says no mods', { plugins: PLUGINS }, async ($, on) => {
  engine(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'No AgentKit mods installed.' })).toBeDefined()
    await ui.unmount()
  }
})

test('with Claude Code set to German, the pane speaks German', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  on('config.list', () => ({ value: [{ key: 'language', label: 'Language', value: 'German' }] as unknown as ConfigRow[] }))
  await declare($)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'on-ak-fixture' }))?.text).toBe('○ Aus')
  expect(await ui.find({ type: 'Text', text: texts('de').footer })).toBeDefined()
  await ui.unmount()
})

test('a row shows title, summary and switches', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await declare($)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: 'Fixture' }))?.text).toBe('Fixture')
    expect((await ui.find({ type: 'Text', text: 's' }))?.text).toBe('s')
    expect((await ui.find({ key: 'on-ak-fixture' }))?.text).toBe('○ Off')
    // The desktop app draws a Button's label, never its children: the glyph is the label.
    expect(await ui.find({ key: 'std-ak-fixture' })).toMatchObject({ text: '☆', props: { label: '☆' } })
    expect(await ui.find({ key: 'more-ak-fixture' })).toMatchObject({ text: '▶\uFE0E', props: { label: '▶\uFE0E' } })
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
  expect(await ui.find({ key: 'std-ak-fixture' })).toMatchObject({ text: '★', props: { label: '★' } })
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
  // Small and dim: the details are a note under the card, not its body.
  expect(await ui.find({ type: 'Text', text: /^d$/ })).toMatchObject({ props: { size: 'footnote', dimColor: true } })
  expect(await ui.find({ key: 'more-ak-fixture' })).toMatchObject({ text: '▼', props: { label: '▼' } })
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

test('after /resume the warning counts the mods on in the resumed chat', { plugins: MODS }, async ($, on) => {
  engine(on, { standard: ['ak-a', 'ak-b', 'ak-c'] })
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  await publish($, 'ak-a', 'Alpha')
  await publish($, 'ak-b', 'Beta')
  await publish($, 'ak-c', 'Gamma')

  // The resume empties the switches and the segments until the next turn; the mods publish again.
  await $.session.end({ reason: 'resume', sessionId: 'S1', resume: { id: 'S1' } })
  for (const name of ['ak-a', 'ak-b', 'ak-c']) await callAs($, name, 'segment', { text: SEGMENT })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: NARROW })
    expect(await warningOf(ui)).toBe('1 mod does not fit the band: Gamma')
    await ui.unmount()
  }
})

/** The engine, with a `ui.open` that places the pane, so `/ak-mods` runs. */
const placing = (on: On) => {
  engine(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
}

/** Runs `/ak-mods` in a terminal `columns` wide, which records the band's width: five less, for the `[-]`. */
const record = ($: Engine, columns: number) => runCommand($, 'ak-mods', '', columns)

/** Alpha, Beta and Gamma, 25 columns each: one row of 81 holds all three, two rows of 53. */
const three = async ($: Engine) => {
  await publish($, 'ak-a', 'Alpha')
  await publish($, 'ak-b', 'Beta')
  await publish($, 'ak-c', 'Gamma')
}

test('the terminal counts with the recorded width, not the pane width', { plugins: MODS }, async ($, on) => {
  placing(on)
  await three($)

  // The band is 81 wide and shows all three: the 40-column pane beside it does not warn.
  await record($, 86)
  const narrow = await $.ui.mount({ ...PANE, surface: 'terminal', props: NARROW })
  expect(await warningOf(narrow)).toBeUndefined()
  await narrow.unmount()

  // The band is 40 wide and drops one: a pane wider than that warns all the same.
  await record($, 45)
  const wide = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 200 } })
  expect(await warningOf(wide)).toBe('1 mod does not fit the band: Gamma')
  await wide.unmount()
})

test('the warning updates when the recorded width changes', { plugins: MODS }, async ($, on) => {
  placing(on)
  await three($)
  await record($, 86)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: NARROW })
  expect(await warningOf(ui)).toBeUndefined()
  await record($, 45)
  expect(await warningOf(ui)).toBe('1 mod does not fit the band: Gamma')
  await record($, 86)
  expect(await warningOf(ui)).toBeUndefined()
  await ui.unmount()
})

test('the band is five columns narrower than the terminal', { plugins: MODS }, async ($, on) => {
  placing(on)
  await three($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: NARROW })

  // 58 columns leave a band of 53: two rows hold all three.
  await record($, 58)
  expect(await warningOf(ui)).toBeUndefined()
  // 57 leave 52: one a row, so the third is dropped.
  await record($, 57)
  expect(await warningOf(ui)).toBe('1 mod does not fit the band: Gamma')
  await ui.unmount()
})

test('a terminal width of 0 or NaN is not recorded', { plugins: MODS }, async ($, on) => {
  placing(on)
  await three($)
  await record($, 86)

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

test("the band's mods button records the band's width, so the pane warns as the band drops", { plugins: MODS }, async ($, on) => {
  placing(on)
  on('ui.render', { component: 'AbovePrompt' }, $ => {
    const { Text } = $.ui.resolve({ surface: 'terminal', component: 'AbovePrompt' })

    return <Text>below</Text>
  })
  // 40 columns a segment: the 75-column band holds one a row and drops the
  // third; the 40-column pane, counting with its own width, would drop two.
  for (const [name, title] of [['ak-a', 'Alpha'], ['ak-b', 'Beta'], ['ak-c', 'Gamma']] as const) {
    await callAs($, name, 'declare', { name, title, summary: 's', details: 'd' })
    await callAs($, name, 'set', { name, on: true })
    await callAs($, name, 'segment', { text: 'x'.repeat(40) })
  }

  const band = await $.ui.mount({
    plugin: 'ak-mods',
    component: 'AbovePrompt',
    surface: 'terminal',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 75, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })
  expect(await band.find({ key: 'mods-toggle' })).toMatchObject({ text: 'mods +1' })
  await band.press({ key: 'mods-toggle' })
  await band.unmount()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal', props: NARROW })
  expect(await warningOf(pane)).toBe('1 mod does not fit the band: Gamma')
  await pane.unmount()
})

test('the desktop counts with the recorded width, as the terminal does', { plugins: MODS }, async ($, on) => {
  placing(on)
  await three($)
  // A band of 40 columns drops one; the pane's own 200 would drop none.
  await record($, 45)

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

test('/ak-mods closes the pane while it is shown, and opens it again', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  // The engine's record of open panes: an open adds the pane, shown; a close removes it.
  const open = new Set<string>()
  on('ui.open', (_, e) => {
    open.add(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.close', (_, e) => {
    open.delete(e.id)

    return { value: undefined }
  })
  on('ui.panes', () => ({ value: [...open].map(id => ({ id, title: 'Mods', isShown: true, isFocused: false, isPlaced: true })) }))

  expect((await runCommand($, 'ak-mods')).text).toBe('Opened the Mods pane.')
  expect((await runCommand($, 'ak-mods')).text).toBe('Closed the Mods pane.')
  expect(open.size).toBe(0)
  expect((await runCommand($, 'ak-mods')).text).toBe('Opened the Mods pane.')
})

// The pane draws on every surface, the band only on two: each row carries
// its mod's current segment, and the segment's button.
test("a row shows its mod's current segment, on every surface", { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await callAs($, 'ak-a', 'segment', { text: '● cache warm 60m', button: { label: 'keep warm', hotkey: '1', command: 'zap' } })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: '● cache warm 60m' }))?.text).toBe('● cache warm 60m')
    expect((await ui.find({ key: 'seg-ak-a' }))?.text).toContain('keep warm')
    await ui.unmount()
  }
})

test("a row shows its segment's detail, dim, after the text", { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await callAs($, 'ak-a', 'segment', { text: '◆ kept warm', detail: '1 ping $0.01' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: '· 1 ping $0.01' })).toMatchObject({ props: { dimColor: true } })
  await ui.unmount()
})

test('the head holds the disclosure, the standard star and the switch; no foot', { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const boxes = await ui.findAll({ type: 'Box' })
    // The card's first row: the title with its disclosure triangle after it, as the desktop app's own
    // cards have it, then the star and the switch.
    const header = boxes.find(box => box.props.flexDirection === 'row' && box.text.startsWith('Alpha'))
    expect(header?.props.flexWrap).toBeUndefined()
    expect(header?.text).toBe('Alpha▶\uFE0E☆○ Off')
    // Nothing is left for a foot row.
    expect(boxes.find(box => box.props.flexWrap === 'wrap')).toBeUndefined()
    await ui.unmount()
  }
})

test('the details link opens one row at a time', { plugins: MODS }, async ($, on) => {
  engine(on)
  for (const [name, title] of [['ak-a', 'Alpha'], ['ak-b', 'Beta']] as const) {
    await callAs($, name, 'declare', { name, title, summary: 's', details: `${title} details` })
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'more-ak-a' })
  await ui.press({ key: 'more-ak-b' })
  expect(await ui.find({ type: 'Text', text: 'Alpha details' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Beta details' })).toBeDefined()
  await ui.press({ key: 'more-ak-b' })
  expect(await ui.find({ type: 'Text', text: 'Beta details' })).toBeUndefined()
  await ui.unmount()
})

test("a row draws its segment in the band's colour", { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })

  for (const [tone, props] of [
    ['info', { color: '#4889cd' }],
    ['warn', { color: '#cd8f2d' }],
    ['alert', { color: '#db4c46', bold: true }],
    ['dim', { dimColor: true }],
  ] as const) {
    await callAs($, 'ak-a', 'segment', { text: `state ${tone}`, tone })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await ui.find({ type: 'Text', text: `state ${tone}` })).toMatchObject({ props })
    await ui.unmount()
  }

  // `ok` stays the text colour, as in the band.
  await callAs($, 'ak-a', 'segment', { text: 'state ok', tone: 'ok' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: 'state ok' }))?.props.color).toBeUndefined()
  await ui.unmount()
})

test("a row draws its segment's parts as the band does", { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await callAs($, 'ak-a', 'segment', { text: 'ctx ▰▱', parts: [{ text: 'ctx ', tone: 'dim' }, { text: '▰▱' }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'ctx ▰▱' })).toMatchObject({ props: { tabular: true } })
  expect(await exactly(ui, 'ctx ')).toMatchObject({ props: { dimColor: true } })
  expect((await exactly(ui, '▰▱'))?.props.color).toBeUndefined()
  await ui.unmount()
})

test("an off mod's row shows no segment", { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: false })
  // Published after the switch-off: only the filter hides it.
  await callAs($, 'ak-a', 'segment', { text: '● cache warm 60m', button: { label: 'keep warm', command: 'zap' } })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: '● cache warm 60m' })).toBeUndefined()
    expect(await ui.find({ key: 'seg-ak-a' })).toBeUndefined()
    await ui.unmount()
  }
})

test("the row's segment button runs its command", { plugins: MODS }, async ($, on) => {
  engine(on)
  const ran: string[] = []
  on('command.run', { command: 'zap' }, (_, e) => {
    ran.push(`${e.command} ${e.args}`)

    return { text: '' }
  })
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await callAs($, 'ak-a', 'segment', { text: 'x', button: { label: 'go', command: 'zap', args: 'now' } })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'seg-ak-a' })
  expect(ran).toEqual(['zap now'])
  await ui.unmount()
})

test('on the desktop app an open row lists its card under the segment, each value once; the terminal keeps the detail', { plugins: PLUGINS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-fixture', 'declare', { name: 'ak-fixture', title: 'Fixture', summary: 's', details: 'd' })
  await callAs($, 'ak-fixture', 'set', { name: 'ak-fixture', on: true })
  await callAs($, 'ak-fixture', 'segment', {
    text: 'ctx ▬▬▬',
    detail: 'ctx 42% · 5h 7% (resets 11:10pm)',
    card: [
      { label: 'Context', value: '42%' },
      { label: '5-hour limit', value: '7% · resets 11:10pm' },
    ],
  })

  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await desk.find({ type: 'Text', text: / · ctx 42%/ })).toBeUndefined()
  // Closed by default: the segment alone.
  expect(await exactly(desk, '5-hour limit')).toBeUndefined()
  await desk.press({ key: 'more-ak-fixture' })
  expect(await exactly(desk, '5-hour limit')).toMatchObject({ props: { dimColor: true } })
  expect(await exactly(desk, '7% · resets 11:10pm')).toBeDefined()
  await desk.unmount()

  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await exactly(term, '· ctx 42% · 5h 7% (resets 11:10pm)')).toBeDefined()
  expect(await exactly(term, '5-hour limit')).toBeUndefined()
  await term.unmount()
})

test('the pane counts the dropped mods as the compact band does', { plugins: MODS }, async ($, on) => {
  engine(on)
  // 40 columns in full, 25 compact: the 40-column band holds one compact segment a row and drops the third.
  for (const [name, title] of [['ak-a', 'Alpha'], ['ak-b', 'Beta'], ['ak-c', 'Gamma']] as const) {
    await callAs($, name, 'declare', { name, title, summary: 's', details: 'd' })
    await callAs($, name, 'set', { name, on: true })
    await callAs($, name, 'segment', { text: 'x'.repeat(40), compact: { text: 'c'.repeat(25) } })
  }

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface, props: NARROW })
    expect(await warningOf(ui)).toBe('1 mod does not fit the band: Gamma')
    await ui.unmount()
  }
})

test('card rows draw small; long values, as an id is, get a line of air between them', { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await callAs($, 'ak-a', 'segment', {
    text: 'id',
    card: [
      { label: 'Desktop id', value: `local_${'a'.repeat(30)}` },
      { label: 'Engine id', value: 'b'.repeat(36) },
    ],
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'more-ak-a' })
  expect(await ui.find({ type: 'Text', text: 'b'.repeat(36) })).toMatchObject({ props: { size: 'footnote' } })
  expect(await ui.find({ type: 'Text', text: 'Engine id' })).toMatchObject({ props: { size: 'footnote', dimColor: true } })
  expect((await ui.find({ key: 'rows-ak-a-0' }))?.props.marginTop).toBeUndefined()
  expect((await ui.find({ key: 'rows-ak-a-1' }))?.props.marginTop).toBe(1)
  await ui.unmount()
})

test('short card values stay close', { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await callAs($, 'ak-a', 'segment', { text: 'x', card: [{ label: 'Context', value: '42%' }, { label: '5h', value: '7%' }] })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'more-ak-a' })
  expect((await ui.find({ key: 'rows-ak-a-1' }))?.props.marginTop).toBeUndefined()
  await ui.unmount()
})

/** The titles of the declared mods as the pane draws them, top to bottom. */
const order = async (ui: { findAll: (q: { type: string }) => Promise<{ text: string }[]> }, titles: readonly string[]) =>
  (await ui.findAll({ type: 'Text' })).map(one => one.text).filter(text => titles.includes(text))

test('an open card moves up and down, the first not up and the last not down', { plugins: MODS }, async ($, on) => {
  engine(on)
  for (const name of ['ak-a', 'ak-b', 'ak-c']) {
    await callAs($, name, 'declare', { name, title: name.toUpperCase(), summary: 's', details: 'd' })
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // Closed, no card shows the way.
  expect(await ui.find({ key: 'up-ak-b' })).toBeUndefined()
  await ui.press({ key: 'more-ak-a' })
  expect(await ui.find({ key: 'up-ak-a' })).toBeUndefined()
  expect(await ui.find({ key: 'down-ak-a' })).toBeDefined()
  await ui.press({ key: 'more-ak-c' })
  expect(await ui.find({ key: 'up-ak-c' })).toBeDefined()
  expect(await ui.find({ key: 'down-ak-c' })).toBeUndefined()

  await ui.press({ key: 'up-ak-c' })
  expect(await order(ui, ['AK-A', 'AK-B', 'AK-C'])).toEqual(['AK-A', 'AK-C', 'AK-B'])
  expect(await callAs($, 'ak-a', 'store', 'order')).toContain('ak-c')
  await ui.unmount()
})

test('reset order shows only for a moved order and puts the default back', { plugins: MODS }, async ($, on) => {
  engine(on)
  for (const name of ['ak-a', 'ak-b']) {
    await callAs($, name, 'declare', { name, title: name.toUpperCase(), summary: 's', details: 'd' })
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'reset-order' })).toBeUndefined()
  await ui.press({ key: 'more-ak-b' })
  await ui.press({ key: 'up-ak-b' })
  expect(await order(ui, ['AK-A', 'AK-B'])).toEqual(['AK-B', 'AK-A'])

  await ui.press({ key: 'reset-order' })
  expect(await order(ui, ['AK-A', 'AK-B'])).toEqual(['AK-A', 'AK-B'])
  expect(await ui.find({ key: 'reset-order' })).toBeUndefined()
  expect(await callAs($, 'ak-a', 'store', 'order')).toBe(null)
  await ui.unmount()
})

const SETTINGS = {
  command: 'zap',
  rows: [{ key: 'work', label: 'Block', value: '60', options: [{ value: '45' }, { value: '60', label: '60 min (default)' }] }],
}

test('an open row shows each setting as a picker, and a pick runs the mod\'s command', { plugins: MODS }, async ($, on) => {
  engine(on)
  const ran: string[] = []
  on('command.run', { command: 'zap' }, (_, e) => {
    ran.push(`${e.command} ${e.args}`)

    return { text: '' }
  })
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await callAs($, 'ak-a', 'segment', { text: 'x', settings: SETTINGS })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    // Closed, the row shows no setting.
    expect(await ui.find({ key: 'pick-ak-a-work' })).toBeUndefined()
    await ui.press({ key: 'more-ak-a' })
    expect(await ui.find({ key: 'pick-ak-a-work' })).toMatchObject({ type: 'Select', props: { value: '60' } })
    expect(await ui.find({ type: 'Text', text: 'Block' })).toBeDefined()
    await ui.select({ key: 'pick-ak-a-work', value: '45' })
    await ui.press({ key: 'more-ak-a' })
    await ui.unmount()
  }
  expect(ran).toEqual(['zap work 45', 'zap work 45'])
})

test('the setting labels stand in one column, as wide as the longest', { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  const row = SETTINGS.rows[0]
  await callAs($, 'ak-a', 'segment', { text: 'x', settings: { ...SETTINGS, rows: [row, { ...row, key: 'break', label: 'Pause ab' }] } })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'more-ak-a' })
  const widths = (await ui.findAll({ type: 'Box' }))
    .filter(box => box.text === 'Block' || box.text === 'Pause ab')
    .map(box => box.props.width)
    .filter(width => width !== undefined)
  expect(widths).toEqual([8, 8])
  await ui.unmount()
})

test('a surface without a picker shows the setting as text', { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  await callAs($, 'ak-a', 'segment', { text: 'x', settings: SETTINGS })

  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await ui.press({ key: 'more-ak-a' })
  expect(await ui.find({ type: 'Select' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '60 min (default)' })).toBeDefined()
  await ui.unmount()
})

test('settings that are not well formed are left out', { plugins: MODS }, async ($, on) => {
  engine(on)
  await callAs($, 'ak-a', 'declare', { name: 'ak-a', title: 'Alpha', summary: 's', details: 'd' })
  await callAs($, 'ak-a', 'set', { name: 'ak-a', on: true })
  const row = SETTINGS.rows[0]
  for (const settings of [
    { ...SETTINGS, command: '' },
    { ...SETTINGS, rows: [{ ...row, key: 'two words' }] },
    { ...SETTINGS, rows: [{ ...row, options: [] }] },
    { ...SETTINGS, rows: [{ ...row, options: [{ value: '45' }, { value: '45' }] }] },
    { ...SETTINGS, rows: [{ ...row, options: [{ value: '4 5' }] }] },
    { ...SETTINGS, rows: [{ ...row, value: '30' }] },
  ]) {
    await callAs($, 'ak-a', 'segment', { text: 'x', settings })
    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    await ui.press({ key: 'more-ak-a' })
    expect(await ui.find({ key: 'pick-ak-a-work' })).toBeUndefined()
    await ui.unmount()
  }
})
