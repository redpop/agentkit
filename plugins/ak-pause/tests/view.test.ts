import { expect, test } from 'claude-code/testing'

import { touch } from '../hooks/block'
import type { Block } from '../hooks/block'
import { DRINK, SET, cardOf, clockText, durationText, notifyText, segmentOf, settingsOf, toastText } from '../hooks/view'

// A local morning; the block started then and the last input was a minute ago.
const T = new Date(2026, 9, 29, 9, 0).getTime()
const MIN = 60_000

const at = (minutes: number): { block: Block; now: number } => {
  const now = T + minutes * MIN
  const block: Block = { ...touch(undefined, T), lastActive: now - MIN, waterSince: now - MIN }

  return { block, now }
}

test('durations read in minutes, then hours and minutes', () => {
  expect(durationText(0)).toBe('0 min')
  expect(durationText(1_380_000)).toBe('23 min')
  expect(durationText(4_320_000)).toBe('1 h 12')
  expect(durationText(3_900_000)).toBe('1 h 05')
})

test('clock times follow the language', () => {
  const evening = new Date(2026, 9, 29, 23, 10).getTime()
  expect(clockText(evening, 'de')).toBe('23:10')
  expect(clockText(evening, 'en')).toBe('11:10pm')
})

test('no segment before the first input', () => {
  expect(segmentOf(undefined, T, 'de')).toBeUndefined()
})

test('23 minutes into a block', () => {
  const { block, now } = at(23)
  expect(segmentOf(block, now, 'de')).toEqual({
    text: '23 min am Stück',
    parts: [{ text: '23 min am Stück', tone: 'ok' }],
    rich: [
      { text: '23 min am Stück', tone: 'ok', icon: 'clock' },
      { text: '23 min', tone: 'ok' },
    ],
    compact: {
      text: '23 min',
      parts: [{ text: '23 min', tone: 'ok' }],
      rich: [
        { text: '23 min', tone: 'ok', icon: 'clock' },
        { text: '23 min', tone: 'ok' },
      ],
    },
    tone: 'ok',
    priority: 4,
  })
})

test('the tone rises with the block', () => {
  expect(segmentOf(at(52).block, at(52).now, 'de')?.tone).toBe('info')
  const hour = segmentOf(at(72).block, at(72).now, 'de')
  expect(hour?.tone).toBe('warn')
  expect(hour?.text).toBe('1 h 12 am Stück')
  expect(segmentOf(at(95).block, at(95).now, 'de')?.tone).toBe('alert')
  expect(segmentOf(at(95).block, at(95).now, 'en')?.text).toBe('1 h 35 straight')
})

test('a break draws dim', () => {
  const block = touch(undefined, T)
  const segment = segmentOf(block, T + 10 * MIN, 'de')
  expect(segment?.text).toBe('Pause')
  expect(segment?.tone).toBe('dim')
  expect(segment?.rich).toEqual([
    { text: 'Pause', tone: 'dim', icon: 'clock' },
    { text: 'Pause', tone: 'dim' },
  ])
  expect(segment?.button).toBeUndefined()
})

test('water due adds a run and the button', () => {
  const { block, now } = at(46)
  const segment = segmentOf({ ...block, waterSince: T }, now, 'de')
  expect(segment?.text).toBe('46 min am Stück Wasser')
  expect(segment?.parts?.at(-1)).toEqual({ text: ' Wasser', tone: 'info' })
  expect(segment?.rich?.at(-1)).toEqual({ text: ' Wasser', tone: 'info' })
  expect(segment?.compact?.text).toBe('46 min Wasser')
  expect(segment?.button).toEqual({ label: 'Getrunken', command: DRINK })
  expect(DRINK).toBe('pause-drink')
})

test('late adds a dim run', () => {
  const late = new Date(2026, 9, 29, 22, 15).getTime()
  const segment = segmentOf({ ...touch(undefined, late - 20 * MIN), lastActive: late - MIN }, late, 'de')
  expect(segment?.text).toBe('20 min am Stück Feierabend?')
  expect(segment?.parts?.at(-1)).toEqual({ text: ' Feierabend?', tone: 'dim' })
})

test('the parts read as the text', () => {
  const { block, now } = at(46)
  const segment = segmentOf({ ...block, waterSince: T }, now, 'de')
  expect(segment?.parts?.map(part => part.text).join('')).toBe(segment?.text)
  expect(segment?.compact?.parts?.map(part => part.text).join('')).toBe(segment?.compact?.text)
})

test('the card in German', () => {
  const now = T + 100 * MIN
  const block: Block = {
    lastActive: now - MIN,
    blockStart: T + 40 * MIN,
    waterSince: T + 70 * MIN,
    day: { date: touch(undefined, T).day.date, breaks: 2, longest: 30 * MIN, lastBreak: { at: T + 22 * MIN, ms: 18 * MIN } },
  }
  expect(cardOf(block, now, 'de')).toEqual([
    { label: 'Am Stück seit', value: '09:40' },
    { label: 'Letzte Pause', value: '09:22, 18 min' },
    { label: 'Pausen heute', value: '2' },
    { label: 'Längster Block heute', value: '1 h 00' },
    { label: 'Wasser zuletzt', value: '10:10' },
  ])
})

test('the card without a break yet, and during one', () => {
  const { block, now } = at(5)
  expect(cardOf(block, now, 'en')[1]).toEqual({ label: 'Last break', value: '–' })
  expect(cardOf(block, now + 20 * MIN, 'de')[0]).toEqual({ label: 'Am Stück seit', value: '–' })
  expect(cardOf(undefined, now, 'de')).toEqual([])
})

test('the hints name the block', () => {
  expect(toastText(3_600_000, 'de')).toBe('1 h 00 am Stück. Guter Moment für eine Pause.')
  expect(notifyText(3_240_000, 'de')).toBe('Claude arbeitet noch. 54 min am Stück: guter Moment für eine Pause.')
  expect(toastText(3_660_000, 'en')).toBe('1 h 01 straight. A good moment for a break.')
})

test('the tones follow the block length set', () => {
  const limits = { workMs: 45 * MIN, breakMs: 10 * MIN }
  const tone = (minutes: number) => {
    const { block, now } = at(minutes)

    return segmentOf(block, now, 'de', limits)?.tone
  }
  expect(tone(34)).toBe('ok')
  expect(tone(35)).toBe('info')
  expect(tone(45)).toBe('warn')
  expect(tone(67)).toBe('warn')
  expect(tone(68)).toBe('alert')
})

test('the settings offer the lengths, the defaults marked, the current ones selected', () => {
  const settings = settingsOf({ workMs: 45 * MIN, breakMs: 10 * MIN }, 'de')
  expect(settings.command).toBe(SET)
  expect(settings.rows.map(row => [row.key, row.label, row.value])).toEqual([
    ['work', 'Block', '45'],
    ['break', 'Pause ab', '10'],
  ])
  expect(settings.rows[0]?.options.map(option => option.label)).toEqual([
    '30 min',
    '45 min',
    '50 min',
    '60 min (Standard)',
    '75 min',
    '90 min',
  ])
  expect(settings.rows[1]?.options.find(option => option.value === '10')?.label).toBe('10 min (Standard)')
})
