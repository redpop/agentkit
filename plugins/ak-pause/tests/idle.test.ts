import { expect, test } from 'claude-code/testing'

import { parseIdle, parseWake } from '../hooks/idle'

test("ioreg's nanoseconds read as milliseconds", () => {
  expect(parseIdle('    | |     "HIDIdleTime" = 221899541\n')).toBe(221)
})

test('output without the idle time reads as none', () => {
  expect(parseIdle('')).toBeUndefined()
  expect(parseIdle('"HIDIdleTime" = <>')).toBeUndefined()
})

test("sysctl's wake time reads as milliseconds", () => {
  expect(parseWake('{ sec = 1793691895, usec = 181810 } Tue Nov  3 08:44:55 2026\n')).toBe(1_793_691_895_181)
})

test('output without the wake time reads as none', () => {
  expect(parseWake('')).toBeUndefined()
  expect(parseWake('{ sec = 0, usec = 0 }')).toBeUndefined()
})
