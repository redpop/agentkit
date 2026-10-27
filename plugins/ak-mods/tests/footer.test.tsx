import { expect, mock, test } from 'claude-code/testing'
import type { On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { FOOTER_COLUMNS } from '../hooks/band'
import { runCommand } from './command'

const FOOTER = {
  plugin: 'ak-mods',
  component: 'SessionMode',
  surface: 'desktop',
  props: { modes: ['plan'] },
} as const

// As in band-render.test.tsx: each mod loads this probe; its command, named
// after the plugin, runs the call its args spell as JSON.
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

// The engine beneath the plugins: a store, the chat `S1`, a footer that draws
// one Text per mode it is given, and a line under the band.
const engine = (on: On) => {
  mock.store(on, {})
  on('session.id', () => ({ value: 'S1' }))
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return <Box>{e.props.modes.map(mode => <Text key={`mode-${mode}`}>{mode}</Text>)}</Box>
  })
  on('ui.render', { component: 'AbovePrompt' }, $ => {
    const { Text } = $.ui.resolve({ surface: 'desktop', component: 'AbovePrompt' })

    return <Text key="below">below</Text>
  })
}

const call = async ($: Engine, plugin: string, op: string, arg?: unknown) =>
  JSON.parse((await runCommand($, plugin, JSON.stringify({ op, arg }))).text ?? 'null')

const publish = async ($: Engine, name: string, title: string, segment: unknown, isOn = true) => {
  await call($, name, 'declare', { name, title, summary: 's', details: 'd' })
  // Off means switched on and back off before the publish: the switch-off clears
  // the segment, the later publish lands anyway, so only the filter hides it.
  await call($, name, 'set', { name, on: true })
  if (!isOn) await call($, name, 'set', { name, on: false })
  await call($, name, 'segment', segment)
}

/** The labels the footer drew, in order. */
const modesOf = async (ui: { findAll: (q: { type?: string }) => Promise<{ text: string }[]> }) =>
  (await ui.findAll({ type: 'Text' })).map(one => one.text)

test('appends one label after the existing modes', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'alpha' })
  await publish($, 'ak-b', 'B', { text: 'beta' })

  const ui = await $.ui.mount(FOOTER)
  expect(await modesOf(ui)).toEqual(['plan', 'alpha · beta'])
  await ui.unmount()
})

test('no segments leaves modes unchanged', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await call($, 'ak-a', 'declare', { name: 'ak-a', title: 'A', summary: 's', details: 'd' })
  await call($, 'ak-a', 'set', { name: 'ak-a', on: true })

  const ui = await $.ui.mount(FOOTER)
  expect(await modesOf(ui)).toEqual(['plan'])
  await ui.unmount()
})

test('label drops lowest priority and ends with +N when over FOOTER_COLUMNS', { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  const wide = 'x'.repeat(FOOTER_COLUMNS - 5)
  await publish($, 'ak-a', 'A', { text: wide, priority: 9 })
  await publish($, 'ak-b', 'B', { text: 'low', priority: 1 })

  const ui = await $.ui.mount(FOOTER)
  const [, label] = await modesOf(ui)
  expect(label).toBe(`${wide} · +1`)
  expect(label?.length).toBeLessThanOrEqual(FOOTER_COLUMNS)
  await ui.unmount()
})

test('a segment with a button ends with its /command', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'ready', button: { label: 'go', command: 'fixture-go' } })

  const ui = await $.ui.mount(FOOTER)
  expect(await modesOf(ui)).toEqual(['plan', 'ready /fixture-go'])
  await ui.unmount()
})

test("an off mod's segment is not in the label", { plugins: [consumer('ak-a'), consumer('ak-b')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'shown' })
  await publish($, 'ak-b', 'B', { text: 'hidden' }, false)

  const ui = await $.ui.mount(FOOTER)
  expect(await modesOf(ui)).toEqual(['plan', 'shown'])
  await ui.unmount()
})

test('AbovePrompt on desktop draws nothing from ak-mods', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'ready' })

  const ui = await $.ui.mount({
    plugin: 'ak-mods',
    component: 'AbovePrompt',
    surface: 'desktop',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })
  expect(await ui.drawn()).toMatchObject({ type: 'Text', children: ['below'] })
  await ui.unmount()
})

test('the terminal footer is unchanged', { plugins: [consumer('ak-a')] }, async ($, on) => {
  engine(on)
  await publish($, 'ak-a', 'A', { text: 'ready' })

  const ui = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
  expect(await modesOf(ui)).toEqual(['plan'])
  await ui.unmount()
})
