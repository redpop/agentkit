import { expect, mock, test } from 'claude-code/testing'
import type { On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { runCommand } from './command'

const BAND = {
  plugin: 'ak-mods',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

const SURFACES = ['terminal'] as const

// As in noun.test.ts: nouns and state are reached from inside a consumer.
// Each mod loads this probe; its command, named after the plugin, runs the
// call its args spell as JSON.
const probe: Register = on => {
  on('command.run', async ($, e, next) => {
    if (e.command !== $.plugin.name) {
      return next(e)
    }

    const { op, arg } = JSON.parse(e.args)
    const answer =
      op === 'declare'
        ? await $.mods.declare(arg)
        : op === 'set'
          ? await $.mods.set(arg)
          : await $.mods.segment(arg)

    return { text: JSON.stringify(answer ?? null) }
  })
}

const consumer = (name: string) => ({ name, register: probe })

// The engine beneath the plugins: a store, the chat `S1`, and a line of its
// own under the band, so a test sees what `next(e)` returned.
const engine = (on: On) => {
  mock.store(on, {})
  on('session.id', () => ({ value: 'S1' }))
  on('ui.render', { component: 'AbovePrompt' }, $ => {
    const { Text } = $.ui.resolve({ surface: 'terminal', component: 'AbovePrompt' })

    return <Text key="below">below</Text>
  })
}

const call = async ($: Engine, plugin: string, op: string, arg?: unknown) =>
  JSON.parse((await runCommand($, plugin, JSON.stringify({ op, arg }))).text ?? 'null')

/** Declares the mod, switches it on unless told not to, and publishes its segment. */
const publish = async ($: Engine, name: string, title: string, segment: unknown, isOn = true) => {
  await call($, name, 'declare', { name, title, summary: 's', details: 'd' })
  // Off means switched on and back off before the publish: the switch-off clears
  // the segment, the later publish lands anyway, so only the filter hides it.
  await call($, name, 'set', { name, on: true })
  if (!isOn) await call($, name, 'set', { name, on: false })
  await call($, name, 'segment', segment)
}

/** The band's rows as the texts of their segments, the separators left out. */
const rowsOf = async (ui: { findAll: (q: { key?: string; type?: string }) => Promise<{ text: string }[]> }) => {
  const rows = await ui.findAll({ type: 'Box' })

  return rows.map(row => row.text)
}

test('no segments draws nothing beyond next(e)', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await call($, 'ak-a', 'declare', { name: 'ak-a', title: 'A', summary: 's', details: 'd' })
  await call($, 'ak-a', 'set', { name: 'ak-a', on: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.drawn()).toMatchObject({ type: 'Text', children: ['below'] })
    await ui.unmount()
  }
})

test("an off mod's segment is not drawn", { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'shown' })
  // Declared but never switched on: state holds its segment all the same.
  await publish($, 'ak-b', 'B', { text: 'hidden' }, false)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: 'shown' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'hidden' })).toBeUndefined()
    await ui.unmount()
  }
})

test('one row for two segments joined by │', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'alpha', tone: 'ok' })
  await publish($, 'ak-b', 'B', { text: 'beta', tone: 'alert' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const row = await ui.find({ key: 'band-row-0' })
    expect(row).toBeDefined()
    expect(await ui.find({ key: 'band-row-1' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'alpha' })).toMatchObject({ props: { color: 'green' } })
    expect(await ui.find({ type: 'Text', text: 'beta' })).toMatchObject({ props: { color: 'red', bold: true } })
    expect(await ui.find({ type: 'Text', text: ' │ ' })).toMatchObject({ props: { dimColor: true } })
    expect(await rowsOf(ui)).toContain('alpha │ beta')
    // The line beneath stays below the band.
    expect(await ui.drawn()).toMatchObject({
      type: 'Box',
      children: [{ type: 'Box' }, { type: 'Text', children: ['below'] }],
    })
    await ui.unmount()
  }
})

test('second row when too wide', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'alpha-one' })
  await publish($, 'ak-b', 'B', { text: 'beta-two' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: 12 } })
    expect((await ui.find({ key: 'band-row-0' }))?.text).toBe('alpha-one')
    expect((await ui.find({ key: 'band-row-1' }))?.text).toBe('beta-two')
    await ui.unmount()
  }
})

test(
  '+N chip when dropped, pressing it opens the Mods pane',
  { plugins: [consumer('ak-a'), consumer('ak-b'), consumer('ak-c')] },
  async ($, on) => {
    engine(on)
    const opened: unknown[] = []
    on('ui.open', (_, e) => {
      opened.push(e)

      return { value: { isPlaced: true } }
    })
    await publish($, 'ak-a', 'A', { text: 'aaaaaaaa' })
    await publish($, 'ak-b', 'B', { text: 'bbbbbbbb' })
    await publish($, 'ak-c', 'C', { text: 'cccccccc' })

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: 16 } })
      expect(await ui.find({ type: 'Text', text: 'cccccccc' })).toBeUndefined()
      expect(await ui.find({ key: 'more-segments' })).toMatchObject({ text: '+1', props: { plain: true } })
      // The chip ends the last row.
      expect((await ui.find({ key: 'band-row-1' }))?.text).toContain('+1')
      await ui.press({ key: 'more-segments' })
      expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
      await ui.unmount()
    }
  },
)

test('a button press runs $.command.run with its command and args', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const ran: { command: string; args: string }[] = []
  on('command.run', { command: 'fixture-go' }, (_, e) => {
    ran.push({ command: e.command, args: e.args })

    return {}
  })
  await publish($, 'ak-a', 'A', { text: 'ready', button: { label: 'go', hotkey: '1', command: 'fixture-go', args: '--fast' } })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'seg-ak-a' })).toMatchObject({ text: 'go', props: { hotkey: '1', plain: true } })
    await ui.press({ key: 'seg-ak-a' })
    expect(ran).toEqual([{ command: 'fixture-go', args: '--fast' }])
    ran.length = 0
    await ui.unmount()
  }
})

test('a button without args runs its command with empty args', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const ran: string[] = []
  on('command.run', { command: 'fixture-go' }, (_, e) => {
    ran.push(e.args)

    return {}
  })
  await publish($, 'ak-a', 'A', { text: 'ready', button: { label: 'go', command: 'fixture-go' } })

  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'seg-ak-a' })
  expect(ran).toEqual([''])
  await ui.unmount()
})

// Above ak-mods, it refuses every pane open: the call rejects.
const refusing: Register = on => {
  on('ui.open', () => ({ deny: 'no room' }))
}

const REFUSING = { name: 'ak-refusing', tier: 'prepend', register: refusing } as const

test('a button whose command the host refuses does not reject', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  // Nothing answers the name: the call rejects, as the host's does for an unknown one.
  await publish($, 'ak-a', 'A', { text: 'ready', button: { label: 'go', command: 'fixture-unknown' } })

  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'seg-ak-a' })
  await ui.unmount()
})

test(
  'a refused pane open from the +N chip does not reject',
  { plugins: [REFUSING, consumer('ak-a'), consumer('ak-b'), consumer('ak-c')] },
  async ($, on) => {
    engine(on)
    await publish($, 'ak-a', 'A', { text: 'aaaaaaaa' })
    await publish($, 'ak-b', 'B', { text: 'bbbbbbbb' })
    await publish($, 'ak-c', 'C', { text: 'cccccccc' })

    const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 16 } })
    await ui.press({ key: 'more-segments' })
    await ui.unmount()
  },
)

// Beneath ak-mods, it denies every write of the width: ak-mods' write rejects.
const widthDown: Register = on => {
  on('state.set', { plugin: 'ak-mods', key: 'width' }, () => ({ deny: 'state down' }))
}

test(
  'the +N chip opens the Mods pane when the width cannot be recorded',
  { plugins: [consumer('ak-a'), consumer('ak-b'), consumer('ak-c'), { name: 'ak-width-down', tier: 'append', register: widthDown }] },
  async ($, on) => {
    engine(on)
    const opened: unknown[] = []
    on('ui.open', (_, e) => {
      opened.push(e)

      return { value: { isPlaced: true } }
    })
    await publish($, 'ak-a', 'A', { text: 'aaaaaaaa' })
    await publish($, 'ak-b', 'B', { text: 'bbbbbbbb' })
    await publish($, 'ak-c', 'C', { text: 'cccccccc' })

    const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 16 } })
    await ui.press({ key: 'more-segments' })
    expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
    await ui.unmount()
  },
)

test('hotkey clash: first by title keeps it', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  // Published in reverse: title order decides, not arrival or priority.
  await publish($, 'ak-b', 'Beta', { text: 'b', priority: 9, button: { label: 'bb', hotkey: '1', command: 'x' } })
  await publish($, 'ak-a', 'alpha', { text: 'a', button: { label: 'aa', hotkey: '1', command: 'x' } })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ key: 'seg-ak-a' }))?.props.hotkey).toBe('1')
    const later = await ui.find({ key: 'seg-ak-b' })
    expect(later?.text).toBe('bb')
    expect(later?.props.hotkey).toBeUndefined()
    await ui.unmount()
  }
})

test(
  'control characters become spaces, a hotkey that is not one printable character is dropped',
  { plugins: [consumer('ak-a'), consumer('ak-b'), consumer('ak-c'), consumer('ak-d')] },
  async ($, on) => {
    engine(on)
    await publish($, 'ak-a', 'A', { text: 'two\nlines', button: { label: 'g\u001bo', hotkey: '12', command: 'x' } })
    await publish($, 'ak-b', 'B', { text: 'tab\there', button: { label: 'b', hotkey: '', command: 'x' } })
    await publish($, 'ak-c', 'C', { text: 'c', button: { label: 'c', hotkey: '\n', command: 'x' } })
    await publish($, 'ak-d', 'D', { text: 'd', button: { label: 'd', hotkey: '2', command: 'x' } })

    const ui = await $.ui.mount(BAND)
    expect(await ui.find({ type: 'Text', text: 'two lines' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'tab here' })).toBeDefined()
    expect(await ui.find({ key: 'seg-ak-a' })).toMatchObject({ text: 'g o' })
    for (const name of ['ak-a', 'ak-b', 'ak-c']) {
      expect((await ui.find({ key: `seg-${name}` }))?.props.hotkey).toBeUndefined()
    }
    expect((await ui.find({ key: 'seg-ak-d' }))?.props.hotkey).toBe('2')
    // Still one row: no segment breaks a line.
    expect(await ui.find({ key: 'band-row-1' })).toBeUndefined()
    await ui.unmount()
  },
)

test('hotkey clash: a mod hidden behind +N does not take the hotkey', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  // First by title, but the lowest priority: it is the one dropped.
  await publish($, 'ak-a', 'alpha', { text: 'aaaaaaaaaa', priority: 1, button: { label: 'aa', hotkey: '1', command: 'x' } })
  await publish($, 'ak-b', 'Beta', { text: 'b', priority: 9, button: { label: 'bb', hotkey: '1', command: 'x' } })

  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 14 } })
  expect(await ui.find({ key: 'seg-ak-a' })).toBeUndefined()
  expect(await ui.find({ key: 'more-segments' })).toMatchObject({ text: '+1' })
  expect((await ui.find({ key: 'seg-ak-b' }))?.props.hotkey).toBe('1')
  await ui.unmount()
})

test('hasSurvey true returns next(e)', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'ready' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey: true } })
    expect(await ui.drawn()).toMatchObject({ type: 'Text', children: ['below'] })
    await ui.unmount()
  }
})

test('another surface than the terminal returns next(e)', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'ready' })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.drawn()).toMatchObject({ type: 'Text', children: ['below'] })
  await ui.unmount()
})

test(
  'a bad tone, priority or empty text does not break the drawing',
  { plugins: [consumer('ak-a'), consumer('ak-b'), consumer('ak-c')] },
  async ($, on) => {
    engine(on)
    await publish($, 'ak-a', 'A', { text: 'odd', tone: 'purple', priority: 'high' })
    await publish($, 'ak-b', 'B', { text: '' })
    await publish($, 'ak-c', 'C', { text: 'fine', tone: 'info' })

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...BAND, surface })
      const odd = await ui.find({ type: 'Text', text: 'odd' })
      expect(odd).toBeDefined()
      expect(odd?.props.color).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: 'fine' })).toMatchObject({ props: { color: 'cyan' } })
      expect((await ui.find({ key: 'band-row-0' }))?.text).toBe('odd │ fine')
      await ui.unmount()
    }
  },
)
