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

/** The band's Boxes as their texts: the gaps between their children are no text. */
const rowsOf = async (ui: { findAll: (q: { key?: string; type?: string }) => Promise<{ text: string }[]> }) => {
  const rows = await ui.findAll({ type: 'Box' })

  return rows.map(row => row.text)
}

/** The Text that reads exactly `text`: `find` matches a part of the text, and so its parent too. */
const exactly = async (ui: { findAll: (q: { type: string }) => Promise<{ text: string; props: Record<string, unknown> }[]> }, text: string) =>
  (await ui.findAll({ type: 'Text' })).find(one => one.text === text)

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

test('one row for two segments parted by space alone', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'alpha', tone: 'ok' })
  await publish($, 'ak-b', 'B', { text: 'beta', tone: 'alert' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const row = await ui.find({ key: 'band-row-0' })
    expect(row).toBeDefined()
    expect(await ui.find({ key: 'band-row-1' })).toBeUndefined()
    // `ok` is the text colour: colour marks only what needs attention.
    expect((await ui.find({ type: 'Text', text: 'alpha' }))?.props.color).toBeUndefined()
    // Theme keys, so the colours follow the person's theme.
    expect(await ui.find({ type: 'Text', text: 'beta' })).toMatchObject({ props: { color: 'error', bold: true } })
    // No rule between the segments: a cell of space, three with the row's gaps.
    expect(await ui.find({ type: 'Text', text: '│' })).toBeUndefined()
    expect(await ui.find({ key: 'sep-ak-b' })).toMatchObject({ type: 'Box', props: { minWidth: 1 } })
    expect(await rowsOf(ui)).toContain('alphabetamods')
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
    // One row needs 30 with the `mods` button; two rows need 18, the button on the second.
    const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: 20 } })
    expect((await ui.find({ key: 'band-row-0' }))?.text).toBe('alpha-one')
    expect((await ui.find({ key: 'band-row-1' }))?.text).toBe('beta-twomods')
    await ui.unmount()
  }
})

/** A `ui.panes` that lists the Mods pane, `isShown` as told, and a `ui.close` that records. */
const listing = (on: On, isShown: boolean) => {
  const closed: unknown[] = []
  on('ui.panes', () => ({ value: [{ id: 'ak-mods', title: 'Mods', isShown, isFocused: false, isPlaced: true }] }))
  on('ui.close', (_, e) => {
    closed.push(e)

    return { value: undefined }
  })

  return closed
}

/** A `ui.open` that places the pane and records. */
const opening = (on: On) => {
  const opened: unknown[] = []
  on('ui.open', (_, e) => {
    opened.push(e)

    return { value: { isPlaced: true } }
  })

  return opened
}

test('the band ends in a mods button with the hotkey m; with the pane closed it opens it', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const opened = opening(on)
  await publish($, 'ak-a', 'A', { text: 'ready' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'mods-toggle' })).toMatchObject({ text: 'mods', props: { hotkey: 'm', plain: true } })
    expect((await ui.find({ key: 'band-row-0' }))?.text).toBe('readymods')
    await ui.press({ key: 'mods-toggle' })
    expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
    opened.length = 0
    await ui.unmount()
  }
})

test('spaces are one-cell gaps, and the mods button sits dim at the right edge', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'alpha', button: { label: 'go', command: 'x' } })
  await publish($, 'ak-b', 'B', { text: 'beta' })

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ key: 'band-row-0' })).toMatchObject({ props: { flexDirection: 'row', columnGap: 1 } })
  // A segment's text and its button, one gap apart.
  expect(await ui.find({ key: 'segment-ak-a' })).toMatchObject({ text: 'alphago', props: { columnGap: 1 } })
  // The space before the button takes what the row leaves, never less than one cell.
  expect(await ui.find({ key: 'mods-space' })).toMatchObject({ props: { flexGrow: 1, minWidth: 1 } })
  expect(await ui.find({ key: 'mods-toggle' })).toMatchObject({ props: { dimColor: true } })
  await ui.unmount()
})

test('the mods button closes the Mods pane while it is shown', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const opened = opening(on)
  const closed = listing(on, true)
  await publish($, 'ak-a', 'A', { text: 'ready' })

  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'mods-toggle' })
  expect(closed).toMatchObject([{ id: 'ak-mods' }])
  expect(opened).toEqual([])
  await ui.unmount()
})

test('the mods button opens the Mods pane while it sits behind another tab', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const opened = opening(on)
  const closed = listing(on, false)
  await publish($, 'ak-a', 'A', { text: 'ready' })

  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'mods-toggle' })
  expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
  expect(closed).toEqual([])
  await ui.unmount()
})

test('the mods button opens the Mods pane when the panes cannot be listed', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const opened = opening(on)
  on('ui.panes', () => ({ deny: 'panes down' }))
  await publish($, 'ak-a', 'A', { text: 'ready' })

  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'mods-toggle' })
  expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
  await ui.unmount()
})

test(
  'the mods button counts the dropped: mods +N',
  { plugins: [consumer('ak-a'), consumer('ak-b'), consumer('ak-c')] },
  async ($, on) => {
    engine(on)
    const opened = opening(on)
    await publish($, 'ak-a', 'A', { text: 'a'.repeat(12) })
    await publish($, 'ak-b', 'B', { text: 'b'.repeat(12) })
    await publish($, 'ak-c', 'C', { text: 'c'.repeat(12) })

    for (const surface of SURFACES) {
      // 25 columns: one segment a row, the second beside `mods +1`; the third is dropped.
      const ui = await $.ui.mount({ ...BAND, surface, props: { ...BAND.props, bodyColumns: 25 } })
      expect(await ui.find({ type: 'Text', text: 'c'.repeat(12) })).toBeUndefined()
      expect(await ui.find({ key: 'mods-toggle' })).toMatchObject({ text: 'mods +1', props: { plain: true } })
      // The button ends the last row.
      expect((await ui.find({ key: 'band-row-1' }))?.text).toBe(`${'b'.repeat(12)}mods +1`)
      await ui.press({ key: 'mods-toggle' })
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

test('a pane-only button stays out of the band and its room; the Mods pane shows it', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'kept', button: { label: 'stop', hotkey: '1', command: 'x', isPaneOnly: true } })

  const band = await $.ui.mount(BAND)
  expect(await band.find({ key: 'seg-ak-a' })).toBeUndefined()
  // Fourteen columns: the text and the mods button fit, as the stop's room is not counted.
  await band.unmount()
  const narrow = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 4 + 10 } })
  expect(await narrow.find({ key: 'mods-toggle' })).toMatchObject({ text: 'mods' })
  await narrow.unmount()

  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ key: 'seg-ak-a' })).toMatchObject({ text: 'stop' })
  await pane.unmount()
})

test('on the desktop app a button on the text is the text: it runs the command, with the hotkey; the terminal keeps the button', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const ran: string[] = []
  on('command.run', { command: 'fixture-copy' }, (_, e) => {
    ran.push(e.command)

    return {}
  })
  await publish($, 'ak-a', 'A', {
    text: 'id …1cdac3',
    rich: [{ text: 'id', icon: 'id' }, { text: ' …1cdac3' }],
    detail: 'local_1cdac3',
    button: { label: 'copy', hotkey: 'c', command: 'fixture-copy', isOnText: true },
  })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ key: 'seg-ak-a' })).toBeUndefined()
  expect(await desk.find({ key: 'text-ak-a-press-1' })).toMatchObject({ text: ' …1cdac3', props: { hotkey: 'c', plain: true } })
  await desk.press({ key: 'text-ak-a-press-1' })
  // The command ran, not the pane's open.
  expect(ran).toEqual(['fixture-copy'])
  await desk.unmount()

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ key: 'seg-ak-a' })).toMatchObject({ text: 'copy', props: { hotkey: 'c' } })
  await term.unmount()
})

test('a button whose command the host refuses does not reject', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  // Nothing answers the name: the call rejects, as the host's does for an unknown one.
  await publish($, 'ak-a', 'A', { text: 'ready', button: { label: 'go', command: 'fixture-unknown' } })

  const ui = await $.ui.mount(BAND)
  await ui.press({ key: 'seg-ak-a' })
  await ui.unmount()
})

test(
  'a refused pane open from the mods button does not reject',
  { plugins: [REFUSING, consumer('ak-a'), consumer('ak-b'), consumer('ak-c')] },
  async ($, on) => {
    engine(on)
    await publish($, 'ak-a', 'A', { text: 'aaaaaaaa' })
    await publish($, 'ak-b', 'B', { text: 'bbbbbbbb' })
    await publish($, 'ak-c', 'C', { text: 'cccccccc' })

    const ui = await $.ui.mount(BAND)
    await ui.press({ key: 'mods-toggle' })
    await ui.unmount()
  },
)

// Beneath ak-mods, it denies every write of the width: ak-mods' write rejects.
const widthDown: Register = on => {
  on('state.set', { plugin: 'ak-mods', key: 'width' }, () => ({ deny: 'state down' }))
}

test(
  'the mods button opens the Mods pane when the width cannot be recorded',
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

    const ui = await $.ui.mount(BAND)
    await ui.press({ key: 'mods-toggle' })
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

test("a mod's hotkey m yields to the mods button", { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'a', button: { label: 'more', hotkey: 'm', command: 'x' } })

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ key: 'seg-ak-a' })).toMatchObject({ text: 'more' })
  expect((await ui.find({ key: 'seg-ak-a' }))?.props.hotkey).toBeUndefined()
  expect((await ui.find({ key: 'mods-toggle' }))?.props.hotkey).toBe('m')
  await ui.unmount()
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

test('hotkey clash: a mod hidden behind the mods button does not take the hotkey', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  // First by title, but the lowest priority: it is the one dropped.
  await publish($, 'ak-a', 'alpha', { text: 'aaaaaaaaaa', priority: 1, button: { label: 'aa', hotkey: '1', command: 'x' } })
  await publish($, 'ak-b', 'Beta', { text: 'b', priority: 9, button: { label: 'bb', hotkey: '1', command: 'x' } })

  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 20 } })
  expect(await ui.find({ key: 'seg-ak-a' })).toBeUndefined()
  expect(await ui.find({ key: 'mods-toggle' })).toMatchObject({ text: 'mods +1' })
  expect((await ui.find({ key: 'seg-ak-b' }))?.props.hotkey).toBe('1')
  await ui.unmount()
})

test("a segment's detail is the pane's, not the band's", { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: '◆ kept warm', detail: '1 ping $0.01' })

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: '◆ kept warm' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ping/ })).toBeUndefined()
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

test('the desktop app draws the band too', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'ready' })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: 'ready' }))?.text).toBe('ready')
  await ui.unmount()
})

test('a surface without the band returns next(e)', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'ready' })

  const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
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
      expect(await ui.find({ type: 'Text', text: 'fine' })).toMatchObject({ props: { color: 'suggestion' } })
      expect((await ui.find({ key: 'band-row-0' }))?.text).toBe('oddfinemods')
      await ui.unmount()
    }
  },
)

test('a segment draws its parts, each in its tone or else the segment\'s, in digits of one width', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', {
    text: 'ctx ▰▱ 81%',
    tone: 'warn',
    parts: [{ text: 'ctx ', tone: 'dim' }, { text: '▰▱' }, { text: ' 81%', tone: 'alert' }],
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: 'ctx ▰▱ 81%' })).toMatchObject({ props: { tabular: true } })
    expect(await exactly(ui, 'ctx ')).toMatchObject({ props: { dimColor: true } })
    // The desktop app paints no theme key on text: there the colours are fixed, between the ring's light and dark.
    expect(await exactly(ui, '▰▱')).toMatchObject({ props: { color: surface === 'desktop' ? '#cd8f2d' : 'warning' } })
    expect(await exactly(ui, ' 81%')).toMatchObject({ props: { color: surface === 'desktop' ? '#db4c46' : 'error', bold: true } })
    await ui.unmount()
  }
})

test('on the desktop app a segment draws its rich runs, a ring as a picture; the terminal draws its text', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', {
    text: 'ctx ▬▬▬',
    rich: [{ text: 'ctx 42%', tone: 'warn', ring: 142 }, { text: ' 42%' }, { text: ' ctx', tone: 'dim' }],
  })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const ring = await desk.find({ type: 'Svg' })
  expect(ring?.props.alt).toBe('ctx 42%')
  // A ring past 100 is held to a full one.
  expect(String(ring?.props.source)).toContain(`stroke-dasharray="${(2 * Math.PI * 6).toFixed(2)} `)
  expect(await exactly(desk, ' ctx')).toMatchObject({ props: { dimColor: true } })
  expect(await desk.find({ type: 'Text', text: 'ctx ▬▬▬' })).toBeUndefined()
  await desk.unmount()

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Svg' })).toBeUndefined()
  expect(await term.find({ type: 'Text', text: 'ctx ▬▬▬' })).toBeDefined()
  await term.unmount()
})

const PANE = {
  plugin: 'ak-mods',
  component: 'Pane',
  requestId: 'ak-mods',
  surface: 'desktop',
  props: { title: 'Mods', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

test('on the desktop app a press on a segment opens the Mods pane at its mod; the terminal has no button', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const opened = opening(on)
  await publish($, 'ak-a', 'A', { text: 'ctx ▬▬▬', detail: 'ctx 42% · 5h 7%' })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // The text is a plain button; nothing of the card draws in the band.
  expect(await desk.find({ key: 'text-ak-a-press-0' })).toMatchObject({ props: { plain: true } })
  await desk.press({ key: 'text-ak-a-press-0' })
  expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
  expect(await desk.find({ type: 'Text', text: '5h 7%' })).toBeUndefined()
  await desk.unmount()

  // The mod's row is open there, its detail a line a part.
  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ key: 'more-ak-a' })).toMatchObject({ props: { label: '▼' } })
  expect(await pane.find({ type: 'Text', text: '5h 7%' })).toBeDefined()
  await pane.unmount()

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ key: 'text-ak-a-press-0' })).toBeUndefined()
  await term.unmount()
})

test("a press opens that mod's row alone; pressed again, the row and the pane close", { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  // The engine's record of open panes.
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
  await publish($, 'ak-a', 'A', { text: 'alpha', detail: 'one' })
  await publish($, 'ak-b', 'B', { text: 'beta', detail: 'two' })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pane = await $.ui.mount(PANE)
  await desk.press({ key: 'text-ak-a-press-0' })
  await desk.press({ key: 'text-ak-b-press-0' })
  // B's press closed A's row: one open at a time.
  expect(await pane.find({ key: 'more-ak-a' })).toMatchObject({ props: { label: '▶\uFE0E' } })
  expect(await pane.find({ key: 'more-ak-b' })).toMatchObject({ props: { label: '▼' } })
  await pane.unmount()

  await desk.press({ key: 'text-ak-b-press-0' })
  expect(open.size).toBe(0)
  const closed = await $.ui.mount(PANE)
  expect(await closed.find({ key: 'more-ak-b' })).toMatchObject({ props: { label: '▶\uFE0E' } })
  await closed.unmount()
  await desk.unmount()
})

test('on the desktop app the text between pictures is the button; the rings stay beside it', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const opened = opening(on)
  await publish($, 'ak-a', 'A', {
    text: 'ctx 42%',
    rich: [{ text: 'ctx 42%', ring: 42 }, { text: ' 42%' }, { text: ' ctx', tone: 'dim' }, { text: '5h 7%', ring: 7 }, { text: ' 7%' }],
    detail: 'ctx 42%',
  })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // One button a stretch of text: ' 42% ctx' after the first ring, ' 7%' after the second.
  expect((await desk.find({ key: 'text-ak-a-press-1' }))?.text).toBe(' 42% ctx')
  expect((await desk.find({ key: 'text-ak-a-press-4' }))?.text).toBe(' 7%')
  expect(await desk.findAll({ type: 'Svg' })).toHaveLength(2)
  await desk.press({ key: 'text-ak-a-press-4' })
  expect(opened).toHaveLength(1)
  await desk.unmount()
})

test('a segment without a card is no button', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'plain', rich: [{ text: 'plain', ring: 10 }, { text: ' plain' }] })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ key: 'text-ak-a-press-1' })).toBeUndefined()
  await desk.unmount()
})

test('on the desktop app an icon run draws as a line icon; an icon ak-mods does not draw leaves its text', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', {
    text: 'id …f0f70f',
    rich: [{ text: 'id', icon: 'id' }, { text: ' …f0f70f' }, { text: 'odd', icon: 'rocket' }],
  })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const icons = await desk.findAll({ type: 'Svg' })
  expect(icons.map(one => one.props.alt)).toEqual(['id'])
  expect(String(icons[0]?.props.source)).toContain('stroke-linecap="round"')
  expect(await exactly(desk, 'odd')).toBeDefined()
  await desk.unmount()
})

test(
  'parts that do not join to the text, or are no list of texts, leave the text in one run',
  { plugins: [consumer('ak-a'), consumer('ak-b'), consumer('ak-c')] },
  async ($, on) => {
    engine(on)
    await publish($, 'ak-a', 'A', { text: 'alpha', parts: [{ text: 'alp' }, { text: 'XX' }] })
    await publish($, 'ak-b', 'B', { text: 'beta', parts: [{ text: 'be' }, 'ta'] })
    await publish($, 'ak-c', 'C', { text: 'gamma', tone: 'info', parts: 'gamma' })

    const ui = await $.ui.mount(BAND)
    for (const text of ['alpha', 'beta', 'gamma']) {
      expect(await ui.find({ type: 'Text', text })).toMatchObject({ children: [text] })
    }
    expect(await exactly(ui, 'alp')).toBeUndefined()
    expect(await exactly(ui, 'be')).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: 'gamma' }))?.props.color).toBe('suggestion')
    await ui.unmount()
  },
)

test('a control character in a part draws as a space, as in the text', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'a\nb', parts: [{ text: 'a\n' }, { text: 'b', tone: 'warn' }] })

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'a b' })).toBeDefined()
  expect(await exactly(ui, 'a ')).toBeDefined()
  expect(await exactly(ui, 'b')).toMatchObject({ props: { color: 'warning' } })
  await ui.unmount()
})

test('a compact form without text is dropped, the segment drawn full', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'x'.repeat(30), compact: { text: '' } })

  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 20 } })
  expect(await exactly(ui, `${'x'.repeat(9)}…`)).toBeDefined()
  await ui.unmount()
})

test('compact parts that do not join to its text are dropped, the compact text kept', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'x'.repeat(30), compact: { text: 'ab', parts: [{ text: 'x' }] } })

  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 20 } })
  expect(await exactly(ui, 'ab')).toBeDefined()
  await ui.unmount()
})

// Too wide in full for the 80-column band, so it draws compact: a ring and the minutes.
const KEEP = {
  text: 'x'.repeat(60),
  compact: { text: 'warm', rich: [{ text: 'r', ring: 50 }, { text: ' 37m' }] },
  button: { label: 'keep warm', hotkey: '1', command: 'fixture-keep' },
}

test('on the desktop app a compact segment is its button, without a hotkey', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const ran: string[] = []
  on('command.run', { command: 'fixture-keep' }, (_, e) => {
    ran.push(e.command)

    return {}
  })
  await publish($, 'ak-a', 'A', KEEP)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'seg-ak-a' })).toBeUndefined()
  const press = await ui.find({ key: 'text-ak-a-press-1' })
  expect(press).toMatchObject({ text: ' 37m', props: { plain: true } })
  expect(press?.props.hotkey).toBeUndefined()
  await ui.press({ key: 'text-ak-a-press-1' })
  expect(ran).toEqual(['fixture-keep'])
  await ui.unmount()
})

test('a compact segment arms no hotkey', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', KEEP)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const hotkeys = (await ui.findAll({ type: 'Button' })).map(one => one.props.hotkey)
    expect(hotkeys.filter(one => one !== undefined)).toEqual(['m'])
    await ui.unmount()
  }
})

test('the terminal draws a compact segment without its button', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', KEEP)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await exactly(ui, 'warm')).toBeDefined()
  expect(await ui.find({ key: 'seg-ak-a' })).toBeUndefined()
  await ui.unmount()
})

test('a compact segment with a pane-only button opens the Mods pane', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const opened = opening(on)
  await publish($, 'ak-a', 'A', {
    ...KEEP,
    // Wide enough to draw compact without the pane-only button's room.
    text: 'x'.repeat(75),
    card: [{ label: 'Cache', value: 'kept' }],
    button: { label: 'stop', hotkey: '1', command: 'fixture-stop', isPaneOnly: true },
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'text-ak-a-press-1' })
  expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
  await ui.unmount()
})

test('in a compact band a segment without a compact form keeps its button and hotkey', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', KEEP)
  await publish($, 'ak-b', 'B', { text: 'b', button: { label: 'go', hotkey: '1', command: 'fixture-go' } })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    // The compact segment gave up `1`; the full one takes it.
    expect(await ui.find({ key: 'seg-ak-b' })).toMatchObject({ text: 'go', props: { hotkey: '1' } })
    await ui.unmount()
  }
})

test('on the desktop app the info tone draws its text in a fixed colour', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'kept', rich: [{ text: 'r', ring: 100 }, { text: ' warm', tone: 'info' }] })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await exactly(ui, ' warm')).toMatchObject({ props: { color: '#4889cd' } })
  await ui.unmount()
})

test('on the desktop app a toned run that only opens the pane keeps its colour and stays text', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  const opened = opening(on)
  await publish($, 'ak-a', 'A', {
    text: 'kept',
    rich: [{ text: 'r', ring: 100 }, { text: ' warm', tone: 'info' }, { text: ' cache', tone: 'dim' }],
    card: [{ label: 'Cache', value: 'kept' }],
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // A Button draws its label alone, uncoloured: the toned run stays text, in its colour.
  expect(await exactly(ui, ' warm')).toMatchObject({ type: 'Text', props: { color: '#4889cd' } })
  expect(await ui.find({ key: 'text-ak-a-press-1' })).toBeUndefined()
  // The untoned run beside it still opens the pane.
  await ui.press({ key: 'text-ak-a-press-2' })
  expect(opened).toEqual([{ id: 'ak-mods', title: 'Mods' }])
  await ui.unmount()
})
