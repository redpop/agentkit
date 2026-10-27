import { expect, test } from 'claude-code/testing'

import { footerLabel, layout } from '../hooks/band'
import type { Segment } from '../hooks/band'

const seg = (name: string, text: string, extra: Partial<Segment> = {}): Segment => ({
  name,
  title: name,
  text,
  ...extra,
})

const names = (rows: readonly (readonly Segment[])[]): string[][] => rows.map(row => row.map(one => one.name))

test('layout fits one row', () => {
  const result = layout([seg('a', 'aaa'), seg('b', 'bbb'), seg('c', 'ccc')], 80)

  expect(result.rows.length).toBe(1)
  expect(result.hidden).toEqual([])
})

test('layout grows to two rows without splitting a segment', () => {
  const text = 'x'.repeat(30)
  const result = layout([seg('a', text), seg('b', text), seg('c', text), seg('d', text)], 80)

  expect(result.rows.length).toBe(2)
  expect(result.hidden).toEqual([])
  expect(names(result.rows)).toEqual([['a', 'b'], ['c', 'd']])
})

test('layout drops the lowest priority first, ties by title', () => {
  const text = 'x'.repeat(30)
  const result = layout(
    [
      seg('e', text, { priority: 1 }),
      seg('d', text),
      seg('c', text),
      seg('b', text),
      seg('a', text),
      seg('f', text, { priority: 9 }),
    ],
    80,
  )

  expect(names(result.rows)).toEqual([['f', 'a'], ['b', 'c']])
  expect(result.hidden).toEqual(['d', 'e'])
})

test('layout stops at the first segment that does not fit', () => {
  const result = layout(
    [seg('a', 'x'.repeat(50), { priority: 9 }), seg('b', 'x'.repeat(50), { priority: 5 }), seg('c', 'x'.repeat(70)), seg('d', 'y', { priority: 1 })],
    80,
  )

  expect(names(result.rows)).toEqual([['a'], ['b']])
  expect(result.hidden).toEqual(['c', 'd'])
})

test('layout reserves room for the chip on the last row', () => {
  const text = 'x'.repeat(38)
  const result = layout([seg('a', text), seg('b', text), seg('c', text), seg('d', text), seg('e', text)], 80)
  const last = result.rows[result.rows.length - 1] ?? []
  const width = last.reduce((sum, one) => sum + one.text.length, 0) + 3 * (last.length - 1)

  expect(result.hidden.length).toBeGreaterThan(0)
  expect(width + 3 + 2 + String(result.hidden.length).length).toBeLessThanOrEqual(80)
})

test('layout gives no rows for no segments', () => {
  expect(layout([], 80)).toEqual({ rows: [], hidden: [] })
})

test('layout keeps an overlong single segment alone, cut with an ellipsis', () => {
  const result = layout([seg('a', 'x'.repeat(100)), seg('b', 'y')], 40)

  expect(result.rows.length).toBe(1)
  expect(result.rows[0]?.length).toBe(1)
  expect(result.rows[0]?.[0]?.text).toBe(`${'x'.repeat(39)}…`)
  expect(result.hidden).toEqual(['b'])
})

test('layout counts button label and hotkey in the width', () => {
  const button = { label: 'Go', hotkey: 'g', command: 'go' }
  // 20 + (2 + 1 + 3) = 26 each; two plus separator = 55 > 50
  const result = layout([seg('a', 'x'.repeat(20), { button }), seg('b', 'x'.repeat(20), { button })], 50)

  expect(result.rows.length).toBe(2)

  // Without a hotkey the extra is label.length + 1 = 3: 23 + 3 + 23 = 49
  const plain = { label: 'Go', command: 'go' }
  const fits = layout([seg('a', 'x'.repeat(20), { button: plain }), seg('b', 'x'.repeat(20), { button: plain })], 49)

  expect(fits.rows.length).toBe(1)
})

test('footerLabel joins with a dot and appends the command of a button', () => {
  const result = footerLabel([seg('a', 'one'), seg('b', 'two', { button: { label: 'Go', command: 'go' } })], 80)

  expect(result).toEqual({ text: 'one · two /go', hidden: [] })
})

test('footerLabel honours columns, drops the lowest priority and ends with a count', () => {
  const result = footerLabel(
    [seg('a', 'aaaa', { priority: 1 }), seg('b', 'bbbb'), seg('c', 'cccc'), seg('d', 'dddd', { priority: 1 })],
    16,
  )

  expect(result.text).toBe('bbbb · cccc · +2')
  expect(result.hidden).toEqual(['a', 'd'])
})

test('footerLabel cuts an overlong single segment to columns', () => {
  const result = footerLabel([seg('a', 'x'.repeat(50)), seg('b', 'y')], 10)

  expect(result).toEqual({ text: `${'x'.repeat(9)}…`, hidden: ['b'] })
})
