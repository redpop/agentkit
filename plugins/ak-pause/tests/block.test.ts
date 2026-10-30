import { expect, test } from 'claude-code/testing'

import { dateOf, drink, isIdle, isLate, isWaterDue, mayNotice, notice, parse, sensed, touch, workedMs } from '../hooks/block'
import type { Block } from '../hooks/block'

// A local morning, so that a few hours on stay on the same date.
const T = new Date(2026, 9, 29, 9, 0).getTime()
const MIN = 60_000

const started = touch(undefined, T)

test('a first input starts a block', () => {
  expect(started).toEqual({ lastActive: T, blockStart: T, waterSince: T, day: { date: dateOf(T), breaks: 0, longest: 0 } })
})

test('input within 10 minutes continues', () => {
  expect(touch(started, T + 599_999).blockStart).toBe(T)
})

test('10 minutes of quiet is a break', () => {
  const worked: Block = { ...started, lastActive: T + 30 * MIN }
  const after = touch(worked, T + 40 * MIN)
  expect(after.blockStart).toBe(T + 40 * MIN)
  expect(after.waterSince).toBe(T + 40 * MIN)
  expect(after.lastActive).toBe(T + 40 * MIN)
  expect(after.day).toEqual({ date: dateOf(T), breaks: 1, longest: 30 * MIN, lastBreak: { at: T + 30 * MIN, ms: 10 * MIN } })
  expect(after.noticed).toBeUndefined()
})

test('an input after hours starts a new day', () => {
  const evening = new Date(2026, 9, 29, 20, 0).getTime()
  const morning = evening + 14 * 60 * MIN
  const after = touch(touch(undefined, evening), morning)
  expect(after.day).toEqual({ date: dateOf(morning), breaks: 0, longest: 0 })
  expect(after.day.date).not.toBe(dateOf(evening))
  expect(after.blockStart).toBe(morning)
  expect(workedMs(after, morning)).toBe(0)
})

test('an earlier time never moves lastActive back', () => {
  const later = touch(started, T + 5 * MIN)
  expect(touch(later, T + 4 * MIN).lastActive).toBe(T + 5 * MIN)
})

test('worked time is 0 while idle', () => {
  expect(workedMs(started, T + 9 * MIN)).toBe(9 * MIN)
  expect(isIdle(started, T + 9 * MIN)).toBe(false)
  expect(isIdle(started, T + 10 * MIN)).toBe(true)
  expect(workedMs(started, T + 10 * MIN)).toBe(0)
})

test('water is due after 45 minutes of work', () => {
  const busy: Block = { ...started, lastActive: T + 45 * MIN }
  expect(isWaterDue(busy, T + 2_699_999)).toBe(false)
  expect(isWaterDue(busy, T + 2_700_000)).toBe(true)
  expect(isWaterDue(started, T + 2_700_000)).toBe(false)
  expect(drink(busy, T + 45 * MIN).waterSince).toBe(T + 45 * MIN)
})

test('late from 22:00 local time', () => {
  expect(isLate(new Date(2026, 9, 29, 21, 59).getTime())).toBe(false)
  expect(isLate(new Date(2026, 9, 29, 22, 0).getTime())).toBe(true)
  expect(isLate(new Date(2026, 9, 29, 23, 30).getTime())).toBe(true)
})

test('one notice per block', () => {
  const busy: Block = { ...started, lastActive: T + 60 * MIN }
  expect(mayNotice(busy, T + 59 * MIN, 60 * MIN)).toBe(false)
  expect(mayNotice(busy, T + 60 * MIN, 60 * MIN)).toBe(true)
  const noticed = notice(busy)
  expect(noticed.noticed).toBe(T)
  expect(mayNotice(noticed, T + 60 * MIN, 60 * MIN)).toBe(false)
  const next = touch(noticed, T + 80 * MIN)
  expect(mayNotice({ ...next, lastActive: T + 140 * MIN }, T + 140 * MIN, 60 * MIN)).toBe(true)
})

test('parse rejects what is not a block', () => {
  expect(parse(undefined)).toBeUndefined()
  expect(parse('x')).toBeUndefined()
  expect(parse({})).toBeUndefined()
  expect(parse({ ...started, lastActive: 'x' })).toBeUndefined()
  const { day: _, ...dayless } = started
  expect(parse(dayless)).toBeUndefined()
  expect(parse({ ...started, day: { ...started.day, breaks: 'x' } })).toBeUndefined()
  expect(parse(started)).toEqual(started)
  const noticed = notice(started)
  expect(parse(JSON.parse(JSON.stringify(noticed)))).toEqual(noticed)
})

test("the system's input moves the block on once a minute newer", () => {
  expect(sensed(started, T + 59_999, T + 59_999)).toBeUndefined()
  expect(sensed(started, T + MIN, T + MIN)?.lastActive).toBe(T + MIN)
  // Back from a break: a new block, the break counted.
  expect(sensed(started, T + 15 * MIN, T + 15 * MIN)).toEqual(touch(started, T + 15 * MIN))
})

test('no block starts from an input a break back', () => {
  expect(sensed(undefined, T, T + 10 * MIN)).toBeUndefined()
  expect(sensed(undefined, T, T + 9 * MIN)).toEqual(started)
})
