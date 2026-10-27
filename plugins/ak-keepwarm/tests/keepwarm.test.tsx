import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

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
  on('classic.SessionStart', () => ({}))
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
  await $.classic.SessionStart({ source: 'clear' })

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
    expect((await ui.find({ key: 'keepwarm' }))?.text).toBe('stop warm')
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
