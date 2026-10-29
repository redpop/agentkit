import { expect, mock, test } from 'claude-code/testing'
import type { EngineInterface, On, PromptEditInput, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import type { Block } from '../hooks/block'

// A local morning: no late hint.
const T = new Date(2026, 9, 29, 9, 0).getTime()
const MIN = 60_000

// A block that started `minutes` ago, with an input a minute ago.
const running = (minutes: number, now = T): Block => ({
  lastActive: now - MIN,
  blockStart: now - minutes * MIN,
  waterSince: now - MIN,
  day: { date: '2026-10-29', breaks: 0, longest: 0 },
})

// The engine beneath the plugin: the clock, the store the sessions share (its writes counted, a
// read that fails on demand), the toasts and the notifications.
const engine = (on: On, stored: Record<string, unknown> = {}, { isFailing = false } = {}) => {
  const clock = mock.clock(on, { now: T })
  // The texts are German: the strings the spec fixes.
  mock.env(on, { LANG: 'de_DE.UTF-8' })
  const toasts: string[] = []
  const notes: string[] = []
  const writes: unknown[] = []
  const reads: string[] = []
  on('store.get', (_, e) => {
    reads.push(e.key)
    if (isFailing) throw new Error('no store')

    return { value: stored[e.key] }
  })
  on('store.set', (_, e) => {
    stored[e.key] = JSON.parse(JSON.stringify(e.value))
    writes.push(stored[e.key])

    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.notify', (_, e) => {
    notes.push(e.text)

    return { value: { isSent: true, channel: 'kitty' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('prompt.edit', (_, e) => ({ text: e.text + e.inputText, cursor: e.start + e.inputText.length }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: 'hi' }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  return { clock, toasts, notes, writes, reads, stored }
}

type Segment = Parameters<EngineInterface['mods']['segment']>[0]

const SEGMENT = 'segment '

// ak-mods cannot be loaded here, so a plugin above the mod stands in for it, as in ak-gitlab's
// tests: declaring switches the mod on, and each published segment comes out as a toast.
const owner: Register = on => {
  // Between `hold` and `release` a segment call resolves without being stored, as inside the call
  // ak-mods makes when its band's button runs a command.
  let isPressing = false
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
          if (isPressing) return
          await built.ui.toast('segment ' + JSON.stringify(typeof segment?.text === 'string' ? segment : null))
        },
      },
    }
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'stand-in', description: 'Controls the ak-mods stand-in', immediate: true })

    return next(e)
  })
  on('command.run', { command: 'stand-in' }, async ($, e) => {
    if (e.args === 'hold' || e.args === 'release') {
      isPressing = e.args === 'hold'

      return {}
    }
    await $.mods.set({ name: 'ak-pause', on: e.args === 'on' })

    return {}
  })
}

const OWNED = { plugins: [{ name: 'ak-mods', tier: 'prepend', register: owner }] } as const

const segments = (toasts: string[]): Segment[] =>
  toasts.filter(t => t.startsWith(SEGMENT)).map(t => JSON.parse(t.slice(SEGMENT.length)) ?? undefined)
const plain = (toasts: string[]) => toasts.filter(t => !t.startsWith(SEGMENT))
const last = (toasts: string[]) => segments(toasts).at(-1)?.text

const start = ($: Engine) => $.session.start({ cwd: '/', surface: null, isInteractive: false })
const submit = ($: Engine, kind: 'composer' | 'sdk' | 'task-notification' | 'scheduled-trigger' = 'composer') =>
  $.prompt.submit({ text: 'weiter', wait: false, origin: { kind } })
// The kit raises `prompt.edit` as the composer does, but its `Engine` type does not list the event.
type Edit = { edit: (e: PromptEditInput) => Promise<unknown> }
const type = ($: Engine) =>
  ($.prompt as unknown as Edit).edit({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: 'a' })
const begin = ($: Engine, agentId?: string) => $.turn.start({ text: 'los', turnId: 'T1', ...(agentId ? { agentId } : {}) })
const turn = ($: Engine, agentId?: string) =>
  $.turn.complete({ turnId: 'T1', reason: 'answer', answer: 'hi', durationMs: 1, isAborted: false, ...(agentId ? { agentId } : {}) })
const run = ($: Engine, command: string, args = '') =>
  $.command.run({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

test('an input starts the count', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on)
  await start($)
  await submit($)
  await clock.advance(9 * MIN)
  await submit($)
  await clock.advance(9 * MIN)
  await submit($)
  await clock.advance(5 * MIN)
  expect(last(toasts)).toBe('23 min am Stück')
  expect(segments(toasts).at(-1)?.card?.[0]).toEqual({ label: 'Am Stück seit', value: '09:00' })
})

test("another session's activity continues the block", OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { block: { ...running(30), lastActive: T - 2 * MIN } })
  await start($)
  await submit($)
  await clock.settle()
  expect(last(toasts)).toBe('30 min am Stück')
})

test('the tick shows the break without input', OWNED, async ($, on) => {
  const { clock, toasts, writes } = engine(on)
  await start($)
  await submit($)
  expect(writes.length).toBe(1)
  await clock.advance(9 * MIN)
  expect(last(toasts)).toBe('9 min am Stück')
  await clock.advance(MIN)
  expect(last(toasts)).toBe('Pause')
  expect(writes.length).toBe(1)
})

test('typing writes at most once a minute', OWNED, async ($, on) => {
  const { clock, writes, reads } = engine(on)
  await start($)
  await type($)
  await clock.advance(10_000)
  const before = reads.length
  await type($)
  // Within the minute a keystroke touches no store.
  expect(reads.length).toBe(before)
  await clock.advance(10_000)
  await type($)
  expect(writes.length).toBe(1)
  await clock.advance(41_000)
  await type($)
  expect(writes.length).toBe(2)
})

test('drinking clears the water hint', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { block: { ...running(40), waterSince: T - 40 * MIN } })
  await start($)
  await submit($)
  await clock.advance(6 * MIN)
  expect(last(toasts)).toBe('46 min am Stück Wasser')
  expect(segments(toasts).at(-1)?.button).toEqual({ label: 'Getrunken', command: 'pause-drink' })
  // Pressed in the band: the command runs inside ak-mods' call, where a publish is lost.
  await run($, 'stand-in', 'hold')
  await run($, 'pause-drink')
  await run($, 'stand-in', 'release')
  await clock.settle()
  expect(last(toasts)).toBe('46 min am Stück')
})

test('one toast per block', OWNED, async ($, on) => {
  const { clock, toasts, stored } = engine(on, { block: running(61) })
  await start($)
  await turn($)
  await turn($)
  await clock.settle()
  expect(plain(toasts)).toEqual(['1 h 01 am Stück. Guter Moment für eine Pause.'])

  // A later block, after a break, gets its own.
  await clock.advance(30 * MIN)
  stored.block = running(60, T + 30 * MIN)
  await turn($)
  await clock.settle()
  expect(plain(toasts)).toEqual(['1 h 01 am Stück. Guter Moment für eine Pause.', '1 h 00 am Stück. Guter Moment für eine Pause.'])
})

test('a long turn notifies', OWNED, async ($, on) => {
  const { clock, toasts, notes } = engine(on, { block: running(51) })
  await start($)
  await begin($)
  await clock.advance(3 * MIN)
  expect(notes).toEqual(['Claude arbeitet noch. 54 min am Stück: guter Moment für eine Pause.'])
  await clock.advance(7 * MIN)
  await submit($)
  await turn($)
  await clock.settle()
  expect(plain(toasts)).toEqual([])
})

test('no notification for a short or a subagent turn', OWNED, async ($, on) => {
  const { clock, notes } = engine(on, { block: running(51) })
  await start($)
  await begin($)
  await clock.advance(MIN)
  await turn($)
  await clock.advance(3 * MIN)
  await begin($, 'A1')
  await clock.advance(3 * MIN)
  expect(notes).toEqual([])
})

test('switched off means quiet', OWNED, async ($, on) => {
  const { clock, toasts, notes } = engine(on, { block: running(61) })
  await start($)
  await clock.settle()
  await run($, 'stand-in', 'off')
  await clock.settle()
  const shown = segments(toasts).length
  await begin($)
  await clock.advance(5 * MIN)
  await turn($)
  await clock.settle()
  expect(segments(toasts).length).toBe(shown)
  expect(plain(toasts)).toEqual([])
  expect(notes).toEqual([])

  await run($, 'stand-in', 'on')
  await clock.settle()
  expect(segments(toasts).length).toBeGreaterThan(shown)
})

test('an unreadable store shows nothing', OWNED, async ($, on) => {
  const { clock, toasts, writes } = engine(on, {}, { isFailing: true })
  await start($)
  await submit($)
  await clock.advance(2 * MIN)
  expect(segments(toasts).filter(one => one !== undefined)).toEqual([])
  expect(writes).toEqual([])
})

test('without ak-mods the own band shows the segment', async ($, on) => {
  const { clock } = engine(on, { block: running(22) })
  await start($)
  await submit($)
  await clock.advance(MIN)
  const ui = await $.ui.mount({
    plugin: 'ak-pause',
    component: 'AbovePrompt',
    surface: 'terminal',
    props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: '23 min am Stück' })).toBeDefined()
  await ui.unmount()
})

test('prompts nobody typed are not activity', OWNED, async ($, on) => {
  const { clock, toasts, writes } = engine(on)
  await start($)
  await submit($)
  await clock.advance(9 * MIN)
  await submit($, 'task-notification')
  await clock.advance(MIN)
  await submit($, 'scheduled-trigger')
  expect(writes.length).toBe(1)
  expect(last(toasts)).toBe('Pause')
  // The desktop app's own prompts are the person's.
  await submit($, 'sdk')
  expect(writes.length).toBe(2)
  expect(last(toasts)).toBe('0 min am Stück')
})

test('no hint while the person types', OWNED, async ($, on) => {
  const { clock, toasts } = engine(on, { block: running(61) })
  await start($)
  await type($)
  await turn($)
  await clock.settle()
  expect(plain(toasts)).toEqual([])
  await clock.advance(6_000)
  await turn($)
  await clock.settle()
  expect(plain(toasts)).toEqual(['1 h 01 am Stück. Guter Moment für eine Pause.'])
})
