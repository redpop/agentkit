import { expect, test } from 'claude-code/testing'
import type { SessionUsage } from 'claude-code'

import { reading } from '../hooks/reading'

const usage = (tokens: number | undefined, limits: Record<string, number> = {}): SessionUsage => ({
  startedAt: 0,
  context: { tokens, window: 200000 },
  rateLimits: Object.entries(limits).map(([kind, percentUsed]) => ({ kind, percentUsed })),
})

test('nothing to show before the first response', () => {
  expect(reading(usage(undefined))).toBeUndefined()
  expect(reading(usage(0))).toBeUndefined()
})

test('the context alone where no rate limit is reported', () => {
  expect(reading(usage(134400))).toEqual({
    text: 'ctx ▬▬▬▬▬',
    parts: [
      { text: 'ctx ', tone: 'dim' },
      { text: '▬▬▬', tone: 'ok' },
      { text: '▬▬', tone: 'dim' },
    ],
    detail: 'ctx 67%',
    tone: 'ok',
  })
})

test('the context and the 5-hour window, the week hidden below 75 %', () => {
  const now = reading(usage(134400, { five_hour: 41.6, seven_day: 74.4 }))
  expect(now).toMatchObject({ text: 'ctx ▬▬▬▬▬  5h ▬▬▬▬▬', detail: 'ctx 67% · 5h 42%', tone: 'ok' })
  expect(now?.parts.map(part => part.text)).toEqual(['ctx ', '▬▬▬', '▬▬', '  5h ', '▬▬', '▬▬▬'])
})

test('the week joins from 75 % with its percentage, in its own tone, and sets the tone', () => {
  const now = reading(usage(20000, { five_hour: 10, seven_day: 81 }))
  expect(now).toMatchObject({ text: 'ctx ▬▬▬▬▬  5h ▬▬▬▬▬  7d ▬▬▬▬▬ 81%', detail: 'ctx 10% · 5h 10% · 7d 81%', tone: 'warn' })
  expect(now?.parts.slice(-3)).toEqual([
    { text: '▬▬▬▬', tone: 'warn' },
    { text: '▬', tone: 'dim' },
    { text: ' 81%', tone: 'warn' },
  ])
  // The calm figures keep their own tone: only the one that needs attention is coloured.
  expect(now?.parts[1]).toEqual({ text: '▬', tone: 'ok' })
})

test('a bar fills to the nearest fifth: empty at 0, full at 100', () => {
  const ctx = (percent: number) =>
    reading({ ...usage(1), context: { tokens: 1, window: 200000, percent } })?.parts.slice(1).map(part => [part.text, part.tone])
  expect(ctx(0)).toEqual([['▬▬▬▬▬', 'dim']])
  expect(ctx(9)).toEqual([['▬▬▬▬▬', 'dim']])
  expect(ctx(10)).toEqual([['▬', 'ok'], ['▬▬▬▬', 'dim']])
  expect(ctx(50)).toEqual([['▬▬▬', 'ok'], ['▬▬', 'dim']])
  expect(ctx(100)).toEqual([['▬▬▬▬▬', 'alert'], [' 100%', 'alert']])
})

test('the fullest figure sets the tone: yellow from 75 %, red from 90 %', () => {
  expect(reading(usage(150000, { five_hour: 20 }))?.tone).toBe('warn')
  expect(reading(usage(20000, { five_hour: 90 }))?.tone).toBe('alert')
  expect(reading(usage(20000, { five_hour: 74.4 }))?.tone).toBe('ok')
})

test("the engine's own percentage wins over the computed one", () => {
  expect(reading({ ...usage(100000), context: { tokens: 100000, window: 200000, percent: 52 } })?.detail).toBe('ctx 52%')
})

test('a 5-hour reading without context still shows', () => {
  expect(reading(usage(undefined, { five_hour: 33 }))).toMatchObject({ text: '5h ▬▬▬▬▬', detail: '5h 33%', tone: 'ok' })
})
