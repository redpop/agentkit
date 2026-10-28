import { expect, mock, test } from 'claude-code/testing'
import type { EngineInterface, On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { usd } from '../hooks/fmt'
import { rewriteCost } from '../hooks/pricing'

// Run on its own, ak-keepwarm finds no ak-mods: the mod is on (fail-open).
const START = 1_000_000
const MIN = 60000

const BAND = {
  plugin: 'ak-keepwarm',
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

const usage = (read: number, written: number) => ({
  input_tokens: 10,
  output_tokens: 5,
  cache_read_input_tokens: read,
  cache_creation_input_tokens: written,
  model: 'claude-sonnet-5-5',
})

// The engine beneath the plugin: a clock, a model, and the fork the pings go through.
const engine = (on: On, fork: { usage: ReturnType<typeof usage> | null; calls: number }) => {
  const clock = mock.clock(on, { now: START })
  const toasts: string[] = []
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: usage(200000, 0) }
  })
  on('turn.complete', () => ({ text: 'hi' }))
  on('model.fork', () => {
    fork.calls += 1

    return fork.usage
      ? { value: { isAnswered: true, text: 'ok', usage: fork.usage } }
      : { value: { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: usage(0, 0) } }
  })

  return { clock, toasts }
}

const startChat = async ($: Engine) => {
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  await $.turn.start({ turnId: 'T1', text: 'hi' })
  const step = $.turn.step({ turnId: 'T1', index: 0, model: 'claude-sonnet-5-5', messageCount: 1 })
  for await (const _ of step) void _
  await step.result
  await $.turn.complete({ turnId: 'T1', reason: 'answer', answer: 'hi', durationMs: 1, isAborted: false })
}

const keepwarm = ($: Engine, args = '') =>
  $.command.run({
    command: 'keepwarm',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

test('a ping reads the cache before it expires and keeps the chat warm', async ($, on) => {
  const fork = { usage: usage(200000, 0), calls: 0 }
  const { clock } = engine(on, fork)
  await startChat($)
  await keepwarm($)

  // Far from expiry (1 hour TTL, 8 minute margin): no ping yet.
  await clock.advance(30 * MIN)
  expect(fork.calls).toBe(0)

  await clock.advance(25 * MIN)
  expect(fork.calls).toBe(1)

  // The ping restarted the timer: no second one right away.
  await clock.advance(5 * MIN)
  expect(fork.calls).toBe(1)
})

test('a ping that writes to the cache turns keep warm off', async ($, on) => {
  const fork = { usage: usage(1000, 150000), calls: 0 }
  const { clock, toasts } = engine(on, fork)
  await startChat($)
  await keepwarm($)

  await clock.advance(55 * MIN)
  expect(fork.calls).toBe(1)
  expect(toasts.some(t => t.includes('Keep warm off') && t.includes('instead of reading the cache'))).toBe(true)

  await clock.advance(60 * MIN)
  expect(fork.calls).toBe(1)
})

test('a ping with no answer turns keep warm off', async ($, on) => {
  const fork = { usage: null, calls: 0 }
  const { clock, toasts } = engine(on, fork)
  await startChat($)
  await keepwarm($)

  await clock.advance(55 * MIN)
  expect(toasts.some(t => t.includes('Keep warm off') && t.includes('no answer'))).toBe(true)
})

test('/keepwarm off stops the pings, and the hours argument sets the limit', async ($, on) => {
  const fork = { usage: usage(200000, 0), calls: 0 }
  const { clock, toasts } = engine(on, fork)
  await startChat($)

  await keepwarm($, '1')
  expect(toasts.at(-1)).toContain('Keeping this cache warm until')
  await keepwarm($, 'off')
  expect(toasts.at(-1)).toContain('Keep warm off (turned off)')

  await clock.advance(55 * MIN)
  expect(fork.calls).toBe(0)

  // The time limit ends a run on its own.
  await keepwarm($, '1')
  await clock.advance(70 * MIN)
  expect(toasts.at(-1)).toContain('time limit reached')
})

test('a cleared chat starts from an unknown cache', async ($, on) => {
  const fork = { usage: usage(200000, 0), calls: 0 }
  const { clock } = engine(on, fork)
  await startChat($)
  await keepwarm($)
  await $.session.end({ reason: 'clear', sessionId: 'S1', resume: { id: 'S1' } })

  await clock.advance(55 * MIN)
  expect(fork.calls).toBe(0)
})

test('the band shows the cache state and the button, on every surface', async ($, on) => {
  const fork = { usage: usage(200000, 0), calls: 0 }
  const { clock } = engine(on, fork)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await startChat($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /cache warm 60m/ })).toBeDefined()
    expect((await ui.find({ key: 'keepwarm' }))?.text).toBe('keep warm')
    await ui.press({ key: 'keepwarm' })
    expect(await ui.find({ type: 'Text', text: /kept warm/ })).toBeDefined()
    expect((await ui.find({ key: 'keepwarm' }))?.text).toBe('stop')
    await ui.press({ key: 'keepwarm' })
    await ui.unmount()
  }

  // Past the TTL the cache is cold and pinging cannot help: no button.
  await clock.advance(61 * MIN)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /cache cold/ })).toBeDefined()
  expect(await ui.find({ key: 'keepwarm' })).toBeUndefined()
  await ui.unmount()
})

type Segment = Parameters<EngineInterface['mods']['segment']>[0]

const SEGMENT = 'segment '

// ak-mods cannot be loaded here, so a plugin above the mod stands in for it: declaring switches the
// mod on, the switch lives where ak-mods keeps it, and each published segment comes out as a toast,
// as does the clear ak-mods makes when the mod is switched off. An inline plugin is loaded as a
// module of its own: it names nothing of this file, and reaches the test only through `$`.
const owner: Register = on => {
  // `fail`: a segment with text is refused, a clear lands; `break`: every segment call is refused.
  let refuses: 'none' | 'fail' | 'break' = 'none'
  // Like ak-mods, a segment published from inside the mod's `state.set` hook, while `set` still
  // runs, never reaches the store: it resolves and is dropped.
  let isSetting = false

  on('engine.create', async ($, e, next) => {
    const built = await next(e)
    const set = async ({ name, on: isOn }: { name: string; on: boolean }) => {
      const held = await built.state.get({ plugin: 'ak-mods', key: 'on' })
      isSetting = true
      try {
        await built.state.set({ plugin: 'ak-mods', key: 'on' }, { ...held.value, [name]: isOn })
      } finally {
        isSetting = false
      }
      if (!isOn) await built.ui.toast('segment null')
    }

    return {
      ...built,
      mods: {
        declare: async ({ name }: { name: string }) => {
          await set({ name, on: true })

          return true
        },
        isOn: async ({ name }: { name: string }) => (await built.state.get({ plugin: 'ak-mods', key: 'on' })).value?.[name] === true,
        set,
        setStandard: async () => {},
        list: async () => [],
        // `$.mods.segment(undefined)` may arrive as `{}`: no text is a clear.
        segment: async (segment: Segment) => {
          if (isSetting) return
          const isClear = typeof segment?.text !== 'string'
          if (refuses === 'break' || (refuses === 'fail' && !isClear)) throw new Error('refused')
          await built.ui.toast('segment ' + JSON.stringify(typeof segment?.text === 'string' ? segment : null))
        },
      },
    }
  })

  // `/stand-in on|off|fail|break|heal` is the test's control: the test's `$` carries no plugin's nouns.
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'stand-in', description: 'Controls the ak-mods stand-in', immediate: true })

    return next(e)
  })
  on('command.run', { command: 'stand-in' }, async ($, e) => {
    if (e.args === 'fail' || e.args === 'break') refuses = e.args
    else if (e.args === 'heal') refuses = 'none'
    else await $.mods.set({ name: 'ak-keepwarm', on: e.args === 'on' })

    return {}
  })
}

// Named ak-mods: the switches it writes are that plugin's state.
const OWNED = { plugins: [{ name: 'ak-mods', tier: 'prepend', register: owner }] } as const

const segments = (toasts: string[]): Segment[] =>
  toasts.filter(t => t.startsWith(SEGMENT)).map(t => JSON.parse(t.slice(SEGMENT.length)) ?? undefined)

const standIn = ($: Engine, args: 'on' | 'off' | 'fail' | 'break' | 'heal') =>
  $.command.run({
    command: 'stand-in',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

const REWRITE = ` · rewrite ≈ ${usd(rewriteCost(200010, 'claude-sonnet-5-5', 60))}`
const KEEP = { label: 'keep warm', hotkey: '1', command: 'keepwarm' }

test('publishes the ok segment while warm', OWNED, async ($, on) => {
  const { toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  expect(segments(toasts).at(-1)).toEqual({ text: '● cache warm 60m', tone: 'ok', priority: 6, button: KEEP })
})

// Run from ak-mods' button, /keepwarm is nested in ak-mods' own call, where an inline publish
// would not reach ak-mods (plugins/ak-mods/tests/button.test.tsx proves it with the real one): the
// command publishes once it has returned.
test('/keepwarm publishes the kept-warm segment off its hook', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  const before = segments(toasts).length
  await keepwarm($)
  expect(segments(toasts).length).toBe(before)
  await clock.settle()
  expect(segments(toasts).at(-1)?.text).toBe('◆ kept warm')
  expect(segments(toasts).at(-1)?.button?.label).toBe('stop')
})

test('publishes the warn segment with the keepwarm button while cooling', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  await clock.advance(56 * MIN)
  expect(segments(toasts).at(-1)).toEqual({ text: `◐ cools in 4m${REWRITE}`, tone: 'warn', priority: 6, button: KEEP })
})

test('publishes the cold segment without a button', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  await clock.advance(72 * MIN)
  expect(segments(toasts).at(-1)).toEqual({ text: `○ cold 12m${REWRITE}`, tone: 'dim', priority: 6 })
})

test('publishes the kept-warm segment with the stop button, without its end', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  await keepwarm($)
  await clock.settle()
  expect(segments(toasts).at(-1)).toEqual({
    text: '◆ kept warm',
    tone: 'info',
    priority: 6,
    button: { label: 'stop', hotkey: '1', command: 'keepwarm' },
  })
})

test('the kept-warm segment carries the pings and their cost as its detail, once there is one', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  await keepwarm($)
  await clock.advance(55 * MIN)
  expect(segments(toasts).at(-1)?.text).toBe('◆ kept warm')
  expect(segments(toasts).at(-1)?.detail).toMatch(/^1 ping \$/)
})

test('no segment before the first request', OWNED, async ($, on) => {
  const { toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await $.session.start({ cwd: '/', surface: null, isInteractive: false })
  expect(segments(toasts)).toEqual([undefined])
})

test('clears the segment on /clear and publishes nothing while off', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  await $.session.end({ reason: 'clear', sessionId: 'S1', resume: { id: 'S1' } })
  await clock.settle()
  expect(segments(toasts).at(-1)).toBeUndefined()

  await startChat($)
  await standIn($, 'off')
  const count = segments(toasts).length
  await clock.advance(56 * MIN)
  expect(segments(toasts).length).toBe(count)

  // Switched on again, the segment comes back on the next turn of the clock.
  await standIn($, 'on')
  await clock.advance(0)
  expect(segments(toasts).at(-1)?.text).toMatch(/^◐ cools in 4m/)
})

test('draws no band of its own while ak-mods owns the drawing', OWNED, async ($, on) => {
  engine(on, { usage: usage(200000, 0), calls: 0 })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await startChat($)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /cache warm/ })).toBeUndefined()
  expect(await ui.find({ key: 'keepwarm' })).toBeUndefined()
  await ui.unmount()
})

test('after switch-off and on again the segment is published', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  const warm = segments(toasts).at(-1)
  expect(warm?.text).toBe('● cache warm 60m')

  await standIn($, 'off')
  expect(segments(toasts).at(-1)).toBeUndefined()
  await standIn($, 'on')
  // Published on the next turn of the clock, after the switch's own hook has returned.
  await clock.advance(0)
  expect(segments(toasts).at(-1)).toEqual(warm)
})

test('the segment after a switch-on counts from the time of the switch-on', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  await standIn($, 'off')
  // The last tick ran at 90 s, when 58.5 minutes were left; at 119 s, 58.02 are.
  await clock.advance(119 * 1000)
  await standIn($, 'on')
  await clock.advance(0)
  expect(segments(toasts).at(-1)?.text).toBe('● cache warm 58m')
})

test('a switch-off before the scheduled publish drops it', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  await standIn($, 'off')
  await standIn($, 'on')
  await standIn($, 'off')
  const count = segments(toasts).length
  await clock.advance(0)
  expect(segments(toasts).length).toBe(count)
  expect(segments(toasts).at(-1)).toBeUndefined()
})

test('on, off and on again publish the segment once', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  await startChat($)
  await standIn($, 'off')
  await standIn($, 'on')
  await standIn($, 'off')
  await standIn($, 'on')
  const count = segments(toasts).length
  await clock.advance(0)
  expect(segments(toasts).slice(count)).toEqual([{ text: '● cache warm 60m', tone: 'ok', priority: 6, button: KEEP }])
})

test('a refused publish clears the earlier segment and sends again later', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { usage: usage(200000, 0), calls: 0 })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await startChat($)
  expect(segments(toasts).at(-1)?.text).toBe('● cache warm 60m')

  await standIn($, 'fail')
  await clock.advance(MIN)
  // The stale segment is gone, and the mod does not draw beside ak-mods.
  expect(segments(toasts).at(-1)).toBeUndefined()
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /cache warm/ })).toBeUndefined()
  await ui.unmount()

  await standIn($, 'heal')
  await clock.advance(MIN / 2)
  expect(segments(toasts).at(-1)?.text).toMatch(/^● cache warm 5\dm$/)
})

test('a publish refused for good on the clock draws the own band at once', OWNED, async ($, on) => {
  const { clock } = engine(on, { usage: usage(200000, 0), calls: 0 })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await startChat($)
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /cache warm/ })).toBeUndefined()

  // The tick at one minute is the first with a new segment, and the last before the check.
  await standIn($, 'break')
  await clock.advance(MIN)
  expect(await ui.find({ type: 'Text', text: /cache warm 59m/ })).toBeDefined()
  await ui.unmount()
})

// A stand-in whose segment call fails: the mod cannot be drawn by ak-mods, so it draws its own band.
const broken: Register = on => {
  on('engine.create', async ($, e, next) => ({
    ...(await next(e)),
    mods: {
      declare: async () => true,
      isOn: async () => true,
      set: async () => {},
      setStandard: async () => {},
      list: async () => [],
      segment: async () => {
        throw new Error('no band')
      },
    },
  }))
}

test('a failing publish leaves the mod drawing its own band', { plugins: [{ name: 'ak-mods', tier: 'prepend', register: broken }] }, async ($, on) => {
  engine(on, { usage: usage(200000, 0), calls: 0 })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  await startChat($)

  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /cache warm 60m/ })).toBeDefined()
  expect((await ui.find({ key: 'keepwarm' }))?.text).toBe('keep warm')
  await ui.unmount()
})
