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
  expect(reading(usage(134400))).toEqual({ text: 'ctx 67%', tone: 'ok' })
})

test('the context and the 5-hour window, the week hidden below 75 %', () => {
  expect(reading(usage(134400, { five_hour: 41.6, seven_day: 74.4 }))).toEqual({ text: 'ctx 67% · 5h 42%', tone: 'ok' })
})

test('the week joins from 75 % and sets the tone', () => {
  expect(reading(usage(20000, { five_hour: 10, seven_day: 81 }))).toEqual({ text: 'ctx 10% · 5h 10% · 7d 81%', tone: 'warn' })
})

test('the fullest figure sets the tone: yellow from 75 %, red from 90 %', () => {
  expect(reading(usage(150000, { five_hour: 20 }))?.tone).toBe('warn')
  expect(reading(usage(20000, { five_hour: 90 }))?.tone).toBe('alert')
  expect(reading(usage(20000, { five_hour: 74.4 }))?.tone).toBe('ok')
})

test("the engine's own percentage wins over the computed one", () => {
  expect(reading({ ...usage(100000), context: { tokens: 100000, window: 200000, percent: 52 } })?.text).toBe('ctx 52%')
})

test('a 5-hour reading without context still shows', () => {
  expect(reading(usage(undefined, { five_hour: 33 }))).toEqual({ text: '5h 33%', tone: 'ok' })
})
