import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

// Run on its own, ak-showcase finds no ak-mods: the mod is on (fail-open), draws its pane and its
// own band.
const PANE = {
  plugin: 'ak-showcase',
  component: 'Pane',
  requestId: 'ak-showcase',
  props: {
    title: 'Showcase',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const BAND = {
  plugin: 'ak-showcase',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 3,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 3 },
    view: {},
  },
} as const

const SECTIONS = [
  'text', 'colors', 'spacing', 'layout', 'hover', 'buttons', 'forms', 'content', 'graphics', 'band', 'feedback',
] as const

// Everything a control could set off past the pane. A hook here records the event and answers it
// as refused, so a control that reached one would show in `reached`.
const OUTSIDE = [
  'prompt.submit', 'prompt.fill', 'tool.call', 'agent.spawn', 'process.run', 'http.fetch',
  'fs.read', 'fs.write', 'fs.list', 'model.complete', 'model.classify', 'model.fork',
] as const

// The engine beneath the plugin: the pane's opening and closing, toasts and the status line, and a
// record of every event past the pane.
const engine = (on: On) => {
  const opened: string[] = []
  const toasts: string[] = []
  const statuses: (string | undefined)[] = []
  const reached: string[] = []
  const commands: string[] = []
  const clock = mock.clock(on, { now: 0 })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', (_, e) => {
    opened.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    statuses.push(e.text)

    return { value: undefined }
  })
  for (const event of OUTSIDE) {
    on(event, () => {
      reached.push(event)
      throw new Error(`${event} is out of bounds for the showcase`)
    })
  }
  // Commands the test does not run itself: the test runs /showcase through `$`, past this record.
  on('command.run', ($, e, next) => {
    commands.push(e.command)

    return next(e)
  })

  return { clock, opened, toasts, statuses, reached, commands }
}

const start = ($: Engine) => $.session.start({ cwd: '/', surface: null, isInteractive: false })

// Mounts the pane on a surface that draws a Select, and picks `section` in it as a person would.
const mountAt = async ($: Engine, surface: 'desktop' | 'terminal' | 'vscode', section: string) => {
  const ui = await $.ui.mount({ ...PANE, surface })
  await ui.select({ key: 'section', value: section })

  return ui
}

// The mobile app draws no Select: the section's Button picks there.
const mountMobileAt = async ($: Engine, section: string) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await ui.press({ key: `section-${section}` })

  return ui
}

const showcase = ($: Engine, args = '') =>
  $.command.run({
    command: 'showcase',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

test('/showcase opens the pane and says so', async ($, on) => {
  const { opened } = engine(on)
  await start($)

  expect((await showcase($)).text).toBe('Showcase opened.')
  expect(opened).toEqual(['ak-showcase'])
})

test('every section draws on every surface', async ($, on) => {
  engine(on)
  await start($)

  for (const surface of ['desktop', 'terminal', 'vscode', 'mobile'] as const) {
    for (const section of SECTIONS) {
      const ui = surface === 'mobile' ? await mountMobileAt($, section) : await mountAt($, surface, section)
      expect(await ui.drawn()).toMatchObject({ type: 'Box' })
      await ui.unmount()
    }
  }
})

test('the section picker switches the section, by Select or by Button', async ($, on) => {
  engine(on)
  await start($)

  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await desktop.select({ key: 'section', value: 'buttons' })
  expect(await desktop.find({ key: 'button-primary' })).toBeDefined()
  await desktop.unmount()

  // The mobile app draws no Select: a row of Buttons picks there.
  const mobile = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await mobile.press({ key: 'section-hover' })
  expect(await mobile.find({ type: 'Text', text: 'Hover' })).toBeDefined()
  await mobile.unmount()
})

test('every control only records itself and reaches nothing past the pane', async ($, on) => {
  const { reached, commands, toasts, statuses, clock } = engine(on)
  await start($)

  for (const section of SECTIONS) {
    const ui = await mountAt($, 'desktop', section)
    for (const button of await ui.findAll({ type: 'Button' })) {
      if (button.key !== undefined && !button.key.startsWith('section-')) await ui.press({ key: button.key })
    }
    for (const input of await ui.findAll({ type: 'Input' })) {
      if (input.key !== undefined) await ui.input({ key: input.key, text: 'hello' })
    }
    for (const select of await ui.findAll({ type: 'Select' })) {
      const options = (select.props.options ?? []) as { value: string }[]
      const last = options.at(-1)
      if (select.key !== undefined && select.key !== 'section' && last !== undefined) {
        await ui.select({ key: select.key, value: last.value })
      }
    }
    await ui.unmount()
  }
  await clock.settle()

  expect(reached).toEqual([])
  expect(commands).toEqual([])
  // The feedback section's three controls are the only ones that show anything outside the pane.
  expect(toasts).toEqual(['A toast from the showcase'])
  expect(statuses).toEqual(['Showcase: status line', undefined])
})

test('a press is reported as the last action', async ($, on) => {
  engine(on)
  await start($)
  const ui = await mountAt($, 'desktop', 'buttons')
  expect(await ui.find({ type: 'Text', text: 'Last action: none yet' })).toBeDefined()
  await ui.press({ key: 'button-primary' })
  expect(await ui.find({ type: 'Text', text: 'Last action: Button primary' })).toBeDefined()
  await ui.unmount()
})

test('typing and picking keep the value under the element', async ($, on) => {
  engine(on)
  await start($)
  const ui = await mountAt($, 'terminal', 'forms')
  await ui.input({ key: 'input-single', text: 'Ada' })
  await ui.select({ key: 'select-fruit', value: 'plum' })
  await ui.press({ key: 'toggle-on' })
  expect(await ui.find({ type: 'Text', text: 'Typed: Ada' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Picked: plum' })).toBeDefined()
  expect((await ui.find({ key: 'toggle-on' }))?.props.variant).toBe('primary')
  await ui.unmount()
})

test('/showcase tone sets the demo tone; anything else names the usage', async ($, on) => {
  engine(on)
  await start($)

  expect((await showcase($, 'tone warn')).text).toBe('Demo segment tone: warn')
  const ui = await mountAt($, 'desktop', 'band')
  expect(await ui.find({ type: 'Text', text: /tone: 'warn'/ })).toBeDefined()
  await ui.unmount()
  expect((await showcase($, 'tone purple')).text).toBe('Usage: /showcase [tone ok|warn|alert|info|dim]')
  expect((await showcase($, 'loud')).text).toBe('Usage: /showcase [tone ok|warn|alert|info|dim]')
})

test('without ak-mods the own band opens the pane', async ($, on) => {
  const { opened } = engine(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Showcase' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await ui.press({ key: 'showcase-open' })
  expect(opened).toEqual(['ak-showcase'])
  await ui.unmount()
})

test('the band section says ak-mods does not switch the mod', async ($, on) => {
  engine(on)
  await start($)
  const ui = await mountAt($, 'desktop', 'band')
  expect(
    await ui.find({ type: 'Text', text: /ak-mods does not switch this mod/ }),
  ).toBeDefined()
  await ui.unmount()
})

test('the texts are German when the locale is', async ($, on) => {
  mock.env(on, { LANG: 'de_DE.UTF-8' })
  engine(on)
  await start($)

  expect((await showcase($)).text).toBe('Showcase geöffnet.')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Letzte Aktion: noch keine' })).toBeDefined()
  await ui.unmount()
})
