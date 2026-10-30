import { expect, test } from 'claude-code/testing'

import { parseIdle } from '../hooks/idle'

test("ioreg's nanoseconds read as milliseconds", () => {
  expect(parseIdle('    | |     "HIDIdleTime" = 221899541\n')).toBe(221)
})

test('output without the idle time reads as none', () => {
  expect(parseIdle('')).toBeUndefined()
  expect(parseIdle('"HIDIdleTime" = <>')).toBeUndefined()
})
