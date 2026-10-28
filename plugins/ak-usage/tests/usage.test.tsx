import { expect, mock, test } from 'claude-code/testing'
import type { EngineInterface, On, Register, SessionUsage } from 'claude-code'
import type { Engine } from 'claude-code/testing'

// Run on its own, ak-usage finds no ak-mods: the mod is on (fail-open) and draws its own band.
const BAND = {
  plugin: 'ak-usage',
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

const figures = (tokens: number | undefined, fiveHour?: number, resetsAt?: number): SessionUsage => ({
  startedAt: 0,
  context: { tokens, window: 200000 },
  rateLimits:
    fiveHour === undefined
      ? []
      : [{ kind: 'five_hour', percentUsed: fiveHour, ...(resetsAt === undefined ? {} : { resetsAt: new Date(resetsAt).toISOString() }) }],
})

// The engine beneath the plugin: the usage it answers, settable by the test, or a read that fails;
// and the toasts.
const engine = (on: On, { isFailing = false } = {}) => {
  const toasts: string[] = []
  let now = figures(undefined)
  const clock = mock.clock(on, { now: 0 })
  on('session.usage', () => {
    if (isFailing) throw new Error('no usage')

    return { value: now }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('turn.complete', () => ({ text: 'hi' }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  return { clock, toasts, set: (next: SessionUsage) => (now = next) }
}

const start = ($: Engine) => $.session.start({ cwd: '/', surface: null, isInteractive: false })

const turn = ($: Engine, agentId?: string) =>
  $.turn.complete({ turnId: 'T1', reason: 'answer', answer: 'hi', durationMs: 1, isAborted: false, ...(agentId ? { agentId } : {}) })

test('without ak-mods the own band shows the figures once there are some', async ($, on) => {
  const { set } = engine(on)
  await start($)

  const before = await $.ui.mount(BAND)
  expect(await before.find({ type: 'Text', text: /ctx/ })).toBeUndefined()
  await before.unmount()

  set(figures(134400, 41.6))
  await turn($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: 'ctx ▬▬▬▬▬  5h ▬▬▬▬▬' })).toBeDefined()
    // The fill shows in the parts' tones alone: the filled cells in the text colour, the rest dim.
    const cells = (await ui.findAll({ type: 'Text', text: /^▬+$/ })).map(one => [one.text, one.props.dimColor === true])
    expect(cells).toEqual([['▬▬▬', false], ['▬▬', true], ['▬▬', false], ['▬▬▬', true]])
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    await ui.unmount()
  }
})

test('a window whose reset passes leaves the own band', async ($, on) => {
  const { clock, set } = engine(on)
  await start($)
  set(figures(134400, 41.6, 60000))
  await turn($)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /5h/ })).toBeDefined()
  await clock.advance(61000)
  expect(await ui.find({ type: 'Text', text: /5h/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'ctx ▬▬▬▬▬' })).toBeDefined()
  await ui.unmount()
})

// A measurement as the engine pushes it, its rate-limit windows moved.
const measure = ($: Engine, fiveHour: number, resetsAt: number) =>
  $.session.measure({ ...figures(undefined, fiveHour, resetsAt), changed: ['rateLimits'] })

test('a window past 90 % is toasted once until it resets', async ($, on) => {
  const { toasts } = engine(on)
  await start($)

  await measure($, 85, 60000)
  expect(toasts.filter(t => t.startsWith('5-hour'))).toEqual([])
  await measure($, 91, 60000)
  await measure($, 95, 60000)
  expect(toasts.filter(t => t.startsWith('5-hour'))).toHaveLength(1)
  expect(toasts.find(t => t.startsWith('5-hour'))).toMatch(/^5-hour limit at 91 %, resets /)

  // The next window is a new one.
  await measure($, 92, 18060000)
  expect(toasts.filter(t => t.startsWith('5-hour'))).toHaveLength(2)
})

test('a failing usage read draws nothing of its own', async ($, on) => {
  engine(on, { isFailing: true })
  await start($)
  await turn($)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /ctx|5h/ })).toBeUndefined()
  await ui.unmount()
})

type Segment = Parameters<EngineInterface['mods']['segment']>[0]

const SEGMENT = 'segment '

// ak-mods cannot be loaded here, so a plugin above the mod stands in for it: declaring switches the
// mod on, the switch lives where ak-mods keeps it, and each published segment comes out as a toast,
// as does the clear ak-mods makes when the mod is switched off. An inline plugin is loaded as a
// module of its own: it names nothing of this file, and reaches the test only through `$`.
const owner: Register = on => {
  on('engine.create', async ($, e, next) => {
    const built = await next(e)
    const set = async ({ name, on: isOn }: { name: string; on: boolean }) => {
      const held = await built.state.get({ plugin: 'ak-mods', key: 'on' })
      await built.state.set({ plugin: 'ak-mods', key: 'on' }, { ...held.value, [name]: isOn })
      if (!isOn) await built.ui.toast('segment null')
    }

    return {
      ...built,
      mods: {
        declare: async ({ name }: { name: string }) => {
          await set({ name, on: true })

          return true
        },
        isOn: async ({ name }: { name: string }) =>
          (await built.state.get({ plugin: 'ak-mods', key: 'on' })).value?.[name] === true,
        set,
        setStandard: async () => {},
        list: async () => [],
        segment: async (segment: Segment) => {
          await built.ui.toast('segment ' + JSON.stringify(typeof segment?.text === 'string' ? segment : null))
        },
      },
    }
  })

  // `/stand-in on|off` is the test's control: the test's `$` carries no plugin's nouns.
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'stand-in', description: 'Controls the ak-mods stand-in', immediate: true })

    return next(e)
  })
  on('command.run', { command: 'stand-in' }, async ($, e) => {
    await $.mods.set({ name: 'ak-usage', on: e.args === 'on' })

    return {}
  })
}

// Named ak-mods: the switches it writes are that plugin's state.
const OWNED = { plugins: [{ name: 'ak-mods', tier: 'prepend', register: owner }] } as const

const segments = (toasts: string[]): Segment[] =>
  toasts.filter(t => t.startsWith(SEGMENT)).map(t => JSON.parse(t.slice(SEGMENT.length)) ?? undefined)

const standIn = ($: Engine, args: 'on' | 'off') =>
  $.command.run({
    command: 'stand-in',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

test('publishes the figures after each main-loop turn, not after a subagent', OWNED, async ($, on) => {
  const { toasts, set } = engine(on)
  await start($)
  expect(segments(toasts).at(-1)).toBeUndefined()

  set(figures(134400, 41.6))
  await turn($)
  expect(segments(toasts).at(-1)).toMatchObject({ text: 'ctx ▬▬▬▬▬  5h ▬▬▬▬▬', detail: 'ctx 67% · 5h 42%', tone: 'ok', priority: 7 })

  set(figures(190000, 41.6))
  await turn($, 'agent-1')
  expect(segments(toasts).at(-1)?.detail).toBe('ctx 67% · 5h 42%')
})

test('publishes again once a window shown resets, without it', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  await start($)
  set(figures(134400, 41.6, 60000))
  await turn($)
  expect(segments(toasts).at(-1)?.text).toBe('ctx ▬▬▬▬▬  5h ▬▬▬▬▬')

  await clock.advance(61000)
  expect(segments(toasts).at(-1)).toMatchObject({ text: 'ctx ▬▬▬▬▬', detail: 'ctx 67%' })
})

test('switched off it toasts no window past 90 %', OWNED, async ($, on) => {
  const { toasts } = engine(on)
  await start($)
  await standIn($, 'off')

  await measure($, 95, 60000)
  expect(toasts.filter(t => t.startsWith('5-hour'))).toEqual([])
})

test('draws no band of its own while ak-mods owns the drawing', OWNED, async ($, on) => {
  const { set } = engine(on)
  await start($)
  set(figures(134400, 41.6))
  await turn($)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /ctx/ })).toBeUndefined()
  await ui.unmount()
})

test('after a chat ends it publishes again once the end has passed', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set(figures(134400, 41.6))
  await start($)
  await clock.settle()
  const before = segments(toasts).length

  set(figures(undefined, 41.6))
  await $.session.end({ reason: 'clear', sessionId: 'S1', resume: { id: 'S1' } })
  expect(segments(toasts).length).toBe(before)
  await clock.settle()
  expect(segments(toasts).at(-1)?.detail).toBe('5h 42%')
})

test('switched off it publishes nothing; switched on again it publishes', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set(figures(134400, 41.6))
  await start($)
  await clock.settle()

  await standIn($, 'off')
  await turn($)
  expect(segments(toasts).at(-1)).toBeUndefined()

  await standIn($, 'on')
  await clock.settle()
  expect(segments(toasts).at(-1)?.detail).toBe('ctx 67% · 5h 42%')
})
