import { expect, mock, test } from 'claude-code/testing'
import type { On, Register } from 'claude-code'
import { runCommand } from './command'

// A mod whose button runs its own command, and the command publishes a new
// segment off its hook: the band's or the pane's button then shows it.
const zap: Register = on => {
  on('command.run', { command: 'ak-zap' }, async $ => {
    await $.mods.declare({ name: 'ak-zap', title: 'Zap', summary: 's', details: 'd' })
    await $.mods.set({ name: 'ak-zap', on: true })
    await $.mods.segment({ text: 'one', button: { label: 'go', command: 'zap' } })

    return { text: '' }
  })
  // Run from ak-mods' button, the command is nested in ak-mods' own call: a
  // publish made inline would not reach ak-mods, one scheduled off it does.
  on('command.run', { command: 'zap' }, async $ => {
    $.clock.after(0, () => {
      $.mods.segment({ text: 'two', button: { label: 'go', command: 'zap' } }).catch(() => {})
    })

    return { text: '' }
  })
}

const PLUGINS = [{ name: 'ak-zap', register: zap }]

const engine = (on: On) => {
  mock.store(on, {})
  on('session.id', () => ({ value: 'S1' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  return mock.clock(on, { now: 0 })
}

const PANE = {
  plugin: 'ak-mods',
  component: 'Pane',
  requestId: 'ak-mods',
  surface: 'desktop',
  props: { title: 'Mods', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const BAND = {
  plugin: 'ak-mods',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 }, view: {} },
} as const

test("the pane's button shows the segment its command publishes", { plugins: PLUGINS }, async ($, on) => {
  const clock = engine(on)
  await runCommand($, 'ak-zap')

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Text', text: 'one' }))?.text ?? 'no one').toBe('one')
  await ui.press({ key: 'seg-ak-zap' })
  await clock.settle()
  expect((await ui.find({ type: 'Text', text: 'two' }))?.text ?? 'no two').toBe('two')
  await ui.unmount()
})

test("the band's button shows the segment its command publishes", { plugins: PLUGINS }, async ($, on) => {
  const clock = engine(on)
  await runCommand($, 'ak-zap')

  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text', text: 'one' }))?.text ?? 'no one').toBe('one')
  await ui.press({ key: 'seg-ak-zap' })
  await clock.settle()
  expect((await ui.find({ type: 'Text', text: 'two' }))?.text ?? 'no two').toBe('two')
  await ui.unmount()
})
