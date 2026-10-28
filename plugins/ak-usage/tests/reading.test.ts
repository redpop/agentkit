import { expect, test } from 'claude-code/testing'
import type { SessionUsage } from 'claude-code'

import { alerts, nextReset, reading, resetClock } from '../hooks/reading'

const usage = (tokens: number | undefined, limits: Record<string, number> = {}): SessionUsage => ({
  startedAt: 0,
  context: { tokens, window: 200000 },
  rateLimits: Object.entries(limits).map(([kind, percentUsed]) => ({ kind, percentUsed })),
})

test('nothing to show before the first response', () => {
  expect(reading(usage(undefined), 0)).toBeUndefined()
  expect(reading(usage(0), 0)).toBeUndefined()
})

test('the context alone where no rate limit is reported', () => {
  expect(reading(usage(134400), 0)).toEqual({
    text: 'ctx ▬▬▬▬▬',
    parts: [
      { text: 'ctx ', tone: 'dim' },
      { text: '▬▬▬', tone: 'ok' },
      { text: '▬▬', tone: 'dim' },
    ],
    rich: [
      { text: 'ctx 67%', tone: 'ok', ring: 67 },
      { text: ' 67%', tone: 'ok' },
      { text: ' ctx', tone: 'dim' },
    ],
    detail: 'ctx 67%',
    tone: 'ok',
  })
})

test('the context and the 5-hour window, the week hidden below 75 %', () => {
  const now = reading(usage(134400, { five_hour: 41.6, seven_day: 74.4 }), 0)
  expect(now).toMatchObject({ text: 'ctx ▬▬▬▬▬  5h ▬▬▬▬▬', detail: 'ctx 67% · 5h 42%', tone: 'ok' })
  expect(now?.parts.map(part => part.text)).toEqual(['ctx ', '▬▬▬', '▬▬', '  5h ', '▬▬', '▬▬▬'])
})

test('the week joins from 75 % with its percentage, in its own tone, and sets the tone', () => {
  const now = reading(usage(20000, { five_hour: 10, seven_day: 81 }), 0)
  expect(now).toMatchObject({ text: 'ctx ▬▬▬▬▬  5h ▬▬▬▬▬  7d ▬▬▬▬▬ 81%', detail: 'ctx 10% · 5h 10% · 7d 81%', tone: 'warn' })
  expect(now?.parts.slice(-3)).toEqual([
    { text: '▬▬▬▬', tone: 'warn' },
    { text: '▬', tone: 'dim' },
    { text: ' 81%', tone: 'warn' },
  ])
  // The calm figures keep their own tone: only the one that needs attention is coloured.
  expect(now?.parts[1]).toEqual({ text: '▬', tone: 'ok' })
})

test('a bar fills to the nearest fifth, one cell at least once anything is used: empty at 0, full at 100', () => {
  const ctx = (percent: number) =>
    reading({ ...usage(1), context: { tokens: 1, window: 200000, percent } }, 0)?.parts.slice(1).map(part => [part.text, part.tone])
  expect(ctx(0)).toEqual([['▬▬▬▬▬', 'dim']])
  expect(ctx(1)).toEqual([['▬', 'ok'], ['▬▬▬▬', 'dim']])
  expect(ctx(9)).toEqual([['▬', 'ok'], ['▬▬▬▬', 'dim']])
  expect(ctx(10)).toEqual([['▬', 'ok'], ['▬▬▬▬', 'dim']])
  expect(ctx(50)).toEqual([['▬▬▬', 'ok'], ['▬▬', 'dim']])
  expect(ctx(100)).toEqual([['▬▬▬▬▬', 'alert'], [' 100%', 'alert']])
})

test('the fullest figure sets the tone: yellow from 75 %, red from 90 %', () => {
  expect(reading(usage(150000, { five_hour: 20 }), 0)?.tone).toBe('warn')
  expect(reading(usage(20000, { five_hour: 90 }), 0)?.tone).toBe('alert')
  expect(reading(usage(20000, { five_hour: 74.4 }), 0)?.tone).toBe('ok')
})

test("the engine's own percentage wins over the computed one", () => {
  expect(reading({ ...usage(100000), context: { tokens: 100000, window: 200000, percent: 52 } }, 0)?.detail).toBe('ctx 52%')
})

test('a 5-hour reading without context still shows', () => {
  expect(reading(usage(undefined, { five_hour: 33 }), 0)).toMatchObject({ text: '5h ▬▬▬▬▬', detail: '5h 33%', tone: 'ok' })
})

// A local day and time, as the reset is shown: 2026-10-28 is a Wednesday.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime()
const NOW = at(28, 20)
const resets = (kind: string, percentUsed: number, time: number) => ({ kind, percentUsed, resetsAt: new Date(time).toISOString() })
const windows = (...rateLimits: ReturnType<typeof resets>[]) => ({ ...usage(undefined), rateLimits })

test('a reset reads as the local time, with its weekday on another day', () => {
  expect(resetClock(at(28, 23, 10), NOW)).toBe('11:10pm')
  expect(resetClock(at(28, 9, 5), NOW)).toBe('9:05am')
  expect(resetClock(at(28, 0), NOW)).toBe('12:00am')
  expect(resetClock(at(31, 10), NOW)).toBe('Sat 10:00am')
})

test('a window from 75 % adds its reset, dim, after its percentage', () => {
  const now = reading(windows(resets('five_hour', 81, at(28, 23, 10))), NOW)
  expect(now?.text).toBe('5h ▬▬▬▬▬ 81%  resets 11:10pm')
  expect(now?.parts.at(-1)).toEqual({ text: '  resets 11:10pm', tone: 'dim' })
  expect(now?.detail).toBe('5h 81% (resets 11:10pm)')
})

test('below 75 % the reset shows only in the detail', () => {
  const now = reading(windows(resets('five_hour', 42, at(28, 23, 10)), resets('seven_day', 80, at(31, 10))), NOW)
  expect(now?.text).toBe('5h ▬▬▬▬▬  7d ▬▬▬▬▬ 80%  resets Sat 10:00am')
  expect(now?.detail).toBe('5h 42% (resets 11:10pm) · 7d 80% (resets Sat 10:00am)')
})

test('a window whose reset has passed is left out, and with it the alert', () => {
  const limits = [resets('five_hour', 95, at(28, 19)), resets('seven_day', 80, at(31, 10))]
  expect(reading(windows(...limits), NOW)?.detail).toBe('7d 80% (resets Sat 10:00am)')
  expect(reading(windows(limits[0]!), NOW)).toBeUndefined()
  expect(alerts(limits, NOW)).toEqual([])
})

test('the next reset is the earliest still ahead among the windows shown', () => {
  expect(nextReset(windows(resets('five_hour', 42, at(28, 23, 10)), resets('seven_day', 80, at(31, 10))), NOW)).toBe(at(28, 23, 10))
  // A week below 75 % is not shown, so its reset changes nothing.
  expect(nextReset(windows(resets('seven_day', 40, at(28, 21))), NOW)).toBeUndefined()
  expect(nextReset(usage(1000, { five_hour: 42 }), NOW)).toBeUndefined()
})

test('a window at 90 % or more is an alert, keyed by its kind and reset', () => {
  const five = resets('five_hour', 91.6, at(28, 23, 10))
  expect(alerts([five, resets('seven_day', 89.4, at(31, 10))], NOW)).toEqual([
    { key: `five_hour@${five.resetsAt}`, text: '5-hour limit at 92 %, resets 11:10pm' },
  ])
  expect(alerts([{ kind: 'seven_day', percentUsed: 90 }], NOW)).toEqual([{ key: 'seven_day@', text: '7-day limit at 90 %' }])
})

test('where the band draws pictures, each figure is a ring with its percentage and label, a short window with its reset', () => {
  const now = reading(windows(resets('five_hour', 81, at(28, 23, 10))), NOW)
  expect(now?.rich).toEqual([
    { text: '5h 81%', tone: 'warn', ring: 81 },
    { text: ' 81%', tone: 'warn' },
    { text: ' 5h', tone: 'dim' },
    { text: '  resets 11:10pm', tone: 'dim' },
  ])
  const two = reading({ ...usage(134400, { five_hour: 7 }) }, NOW)
  expect(two?.rich.map(part => part.text).join('')).toBe('ctx 67% 67% ctx   5h 7% 7% 5h')
})
