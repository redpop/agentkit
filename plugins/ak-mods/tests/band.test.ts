import { expect, test } from 'claude-code/testing'

import { layout } from '../hooks/band'
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

test('layout fills the first row only as far as leaves the mods button room on the second', () => {
  // 25 + 3 + 25 + 3 + 25 = 81 fills one row of 81, but the button needs 10 more.
  const text = 'x'.repeat(25)
  const result = layout([seg('a', text), seg('b', text), seg('c', text)], 81)

  expect(names(result.rows)).toEqual([['a', 'b'], ['c']])
  expect(result.hidden).toEqual([])
})

test('layout reserves room for the mods button even when nothing is dropped', () => {
  // 70 + 10 for `m: mods` with its separator: 80 fits, 79 cuts.
  expect(layout([seg('a', 'x'.repeat(70))], 80).rows[0]?.[0]?.text).toBe('x'.repeat(70))
  expect(layout([seg('a', 'x'.repeat(70))], 79).rows[0]?.[0]?.text).toBe(`${'x'.repeat(68)}…`)
})

test('layout reserves room for the mods button on the last row', () => {
  const text = 'x'.repeat(38)
  const result = layout([seg('a', text), seg('b', text), seg('c', text), seg('d', text), seg('e', text)], 80)
  const last = result.rows[result.rows.length - 1] ?? []
  const width = last.reduce((sum, one) => sum + one.text.length, 0) + 3 * (last.length - 1)

  expect(result.hidden.length).toBeGreaterThan(0)
  expect(width + 3 + 'm: '.length + `mods +${result.hidden.length}`.length).toBeLessThanOrEqual(80)
})

test('layout gives no rows for no segments', () => {
  expect(layout([], 80)).toEqual({ rows: [], hidden: [] })
})

test('layout keeps an overlong single segment alone, cut with an ellipsis', () => {
  const result = layout([seg('a', 'x'.repeat(100)), seg('b', 'y')], 40)

  expect(result.rows.length).toBe(1)
  expect(result.rows[0]?.length).toBe(1)
  // 40 less 13 for `m: mods +1` with its separator.
  expect(result.rows[0]?.[0]?.text).toBe(`${'x'.repeat(26)}…`)
  expect(result.hidden).toEqual(['b'])
})

test('layout drops the parts of a segment it cuts, and keeps those of one it does not', () => {
  const parts = [{ text: 'x'.repeat(50) }, { text: 'x'.repeat(50), tone: 'warn' as const }]
  const cutOne = layout([seg('a', 'x'.repeat(100), { parts })], 40).rows[0]?.[0]
  expect(cutOne?.text).toBe(`${'x'.repeat(29)}…`)
  expect(cutOne?.parts).toBeUndefined()

  const whole = [{ text: 'ab' }, { text: 'cd', tone: 'warn' as const }]
  expect(layout([seg('a', 'abcd', { parts: whole })], 40).rows[0]?.[0]?.parts).toEqual(whole)
})

test('layout counts button label and hotkey in the width', () => {
  const button = { label: 'Go', hotkey: 'g', command: 'go' }
  // 20 + (2 + 1 + 3) = 26 each; two plus separator = 55 > 50
  const result = layout([seg('a', 'x'.repeat(20), { button }), seg('b', 'x'.repeat(20), { button })], 50)

  expect(result.rows.length).toBe(2)

  // Without a hotkey the extra is label.length + 1 = 3: 23 + 3 + 23 = 49, and 10 for the mods button
  const plain = { label: 'Go', command: 'go' }
  const fits = layout([seg('a', 'x'.repeat(20), { button: plain }), seg('b', 'x'.repeat(20), { button: plain })], 59)

  expect(fits.rows.length).toBe(1)
})

test('layout counts a pictured band by the rich runs, a picture as three cells', () => {
  // `text` 30 each: 30 + 3 + 30 + 10 = 73 > 60, two rows on the terminal
  const rich = [{ text: 'ring alt text that is long', ring: 50 }, { text: ' 50% ctx' }]
  const one = [seg('a', 'x'.repeat(30), { rich }), seg('b', 'y'.repeat(30), { rich })]

  expect(layout(one, 60).rows.length).toBe(2)
  // rich 3 + 8 = 11 each: 11 + 3 + 11 + 10 = 35
  expect(layout(one, 60, true).rows.length).toBe(1)
  // Without rich runs a pictured band counts the text
  expect(layout([seg('a', 'x'.repeat(30)), seg('b', 'y'.repeat(30))], 60, true).rows.length).toBe(2)
})

test('layout leaves a button on the text out of a pictured band only', () => {
  const button = { label: 'copy', hotkey: 'c', command: 'copy', isOnText: true }
  // 20 + (4 + 1 + 3) = 28 each: 28 + 3 + 28 + 10 = 69 > 60; on the text, 20 + 3 + 20 + 10 = 53
  const two = [seg('a', 'x'.repeat(20), { button }), seg('b', 'y'.repeat(20), { button })]

  expect(layout(two, 60).rows.length).toBe(2)
  expect(layout(two, 60, true).rows.length).toBe(1)
})

test('layout leaves rich runs wider than the room out of a pictured band', () => {
  const rich = [{ text: 'z'.repeat(40) }]
  // text 10 fits 30 - 10 = 20; the rich runs, 40, do not
  const kept = layout([seg('a', 'x'.repeat(10), { rich })], 30, true).rows[0]?.[0]

  expect(kept?.text).toBe('x'.repeat(10))
  expect(kept?.rich).toBeUndefined()
})

test('layout parts the segments of a pictured band by two cells', () => {
  // 20 + 3 + 20 + 10 = 53 > 52 on the terminal; 20 + 2 + 20 + 10 = 52 pictured
  const two = [seg('a', 'x'.repeat(20)), seg('b', 'y'.repeat(20))]

  expect(layout(two, 52).rows.length).toBe(2)
  expect(layout(two, 52, true).rows.length).toBe(1)
})

const compact = { text: 'c'.repeat(5) }

test('layout keeps full forms on one row while they fit', () => {
  const result = layout([seg('a', 'x'.repeat(20), { compact }), seg('b', 'y'.repeat(20), { compact })], 80)

  expect(result.rows.length).toBe(1)
  expect(result.rows[0]?.map(one => [one.text, one.isCompact])).toEqual([
    ['x'.repeat(20), undefined],
    ['y'.repeat(20), undefined],
  ])
})

test('layout switches the whole band to compact before a second row', () => {
  // full: 30 + 3 + 30 + 10 = 73 > 60; compact: 5 + 3 + 30 + 10 = 48, b having no compact form
  const result = layout([seg('a', 'x'.repeat(30), { compact }), seg('b', 'y'.repeat(30))], 60)

  expect(result.rows.length).toBe(1)
  expect(result.rows[0]?.map(one => [one.text, one.isCompact])).toEqual([
    ['ccccc', true],
    ['y'.repeat(30), undefined],
  ])
})

test('layout puts compact forms on two rows when one is too few', () => {
  const wide = { text: 'c'.repeat(30) }
  const result = layout([seg('a', 'x'.repeat(40), { compact: wide }), seg('b', 'y'.repeat(40), { compact: wide })], 50)

  expect(result.rows.length).toBe(2)
  expect(result.rows.flat().map(one => one.isCompact)).toEqual([true, true])
})

test('a compact segment counts no button width', () => {
  const button = { label: 'keep warm', hotkey: '1', command: 'k' }
  // compact 5 + 3 + 5 + 10 = 23 <= 25 only without the button's 13
  const result = layout([seg('a', 'x'.repeat(40), { compact, button }), seg('b', 'y'.repeat(40), { compact, button })], 25)

  expect(result.hidden).toEqual([])
  expect(result.rows.flat().map(one => one.text)).toEqual(['ccccc', 'ccccc'])
})

test('without any compact form the band lays out as before, two full rows', () => {
  const result = layout([seg('a', 'x'.repeat(30)), seg('b', 'y'.repeat(30))], 60)

  expect(result.rows.length).toBe(2)
  expect(result.rows.flat().every(one => one.isCompact === undefined)).toBe(true)
})

test('compact steps drop the lowest priority', () => {
  const result = layout([seg('a', 'x'.repeat(30), { compact, priority: 9 }), seg('b', 'y'.repeat(60), { priority: 1 })], 30)

  expect(result.hidden).toEqual(['b'])
  expect(result.rows[0]?.[0]?.text).toBe('ccccc')
})

test('a pictured band counts its text at 0.9 of a cell, a proportional face being narrower', () => {
  const two = [seg('a', 'x'.repeat(40)), seg('b', 'y'.repeat(40))]

  // Terminal: 40 + 3 + 40 + 10 = 93 > 84. Pictured: 36 + 2 + 36 + 10 = 84.
  expect(layout(two, 84).rows.length).toBe(2)
  expect(layout(two, 84, true).rows.length).toBe(1)
  expect(layout(two, 83, true).rows.length).toBe(2)
})
