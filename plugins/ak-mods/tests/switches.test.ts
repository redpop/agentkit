import { expect, test } from 'claude-code/testing'

import type { ModsInfo } from '../types'
import { DEFAULT_ORDER, fullOrder, isAgentKit, moved, rows, upsert } from '../hooks/switches'

const info = (name: string, title: string): ModsInfo => ({ name, title, summary: 's', details: 'd' })

test('isAgentKit accepts ak-marketplace and inline plugins', () => {
  expect(isAgentKit('ak-x', 'ak-x@ak-marketplace')).toBe(true)
  expect(isAgentKit('ak-x', 'ak-x@inline')).toBe(true)
})

test('isAgentKit refuses another marketplace, whatever the name', () => {
  expect(isAgentKit('ak-evil', 'ak-evil@other-marketplace')).toBe(false)
})

test('isAgentKit judges by name when provenance is unknown', () => {
  expect(isAgentKit('ak-x', undefined)).toBe(true)
  expect(isAgentKit('foo', undefined)).toBe(false)
})

test('isAgentKit judges test-kit plugins by name', () => {
  expect(isAgentKit('ak-x', 'ak-x@claude-plugin-test')).toBe(true)
  expect(isAgentKit('foo', 'foo@claude-plugin-test')).toBe(false)
})

test('upsert replaces the entry of the same name in place', () => {
  const list = [info('ak-a', 'A'), info('ak-b', 'B')]

  expect(upsert(list, info('ak-a', 'A 2'))).toEqual([info('ak-a', 'A 2'), info('ak-b', 'B')])
})

test('upsert appends a new name', () => {
  expect(upsert([info('ak-a', 'A')], info('ak-b', 'B'))).toEqual([info('ak-a', 'A'), info('ak-b', 'B')])
})

test('rows follow the order and map the switches', () => {
  const declared = [info('ak-a', 'alpha'), info('ak-b', 'Bravo'), info('ak-c', 'charlie')]

  expect(rows(declared, { 'ak-a': true }, [], ['ak-c', 'ak-a', 'ak-b']).map(row => row.name)).toEqual(['ak-c', 'ak-a', 'ak-b'])
})

test('rows sort mods the order does not name after it, by title, case-insensitive', () => {
  const declared = [info('ak-c', 'charlie'), info('ak-b', 'Bravo'), info('ak-a', 'alpha'), info('ak-z', 'zulu')]

  expect(rows(declared, { 'ak-a': true, 'ak-b': false }, ['ak-b'], ['ak-z']).map(row => row.name)).toEqual([
    'ak-z',
    'ak-a',
    'ak-b',
    'ak-c',
  ])
  expect(rows(declared, { 'ak-a': true, 'ak-b': false }, ['ak-b'], []).slice(0, 3)).toEqual([
    { ...info('ak-a', 'alpha'), isOn: true, isStandard: false },
    { ...info('ak-b', 'Bravo'), isOn: false, isStandard: true },
    { ...info('ak-c', 'charlie'), isOn: false, isStandard: false },
  ])
})

test('fullOrder is the default until one is stored, and appends the default names a stored one lacks', () => {
  expect(fullOrder([])).toEqual([...DEFAULT_ORDER])
  expect(DEFAULT_ORDER).toEqual(['ak-usage', 'ak-keepwarm', 'ak-pause', 'ak-ci', 'ak-session-id', 'ak-showcase'])
  expect(fullOrder(['ak-session-id', 'ak-x', 'ak-usage', 'ak-x'])).toEqual([
    'ak-session-id',
    'ak-x',
    'ak-usage',
    'ak-keepwarm',
    'ak-pause',
    'ak-ci',
    'ak-showcase',
  ])
})

test('moved swaps a mod with its shown neighbour, past a name not shown', () => {
  const order = ['ak-a', 'ak-gone', 'ak-b', 'ak-c']
  const shown = ['ak-a', 'ak-b', 'ak-c']

  expect(moved(order, shown, 'ak-b', -1)).toEqual(['ak-b', 'ak-gone', 'ak-a', 'ak-c'])
  expect(moved(order, shown, 'ak-b', 1)).toEqual(['ak-a', 'ak-gone', 'ak-c', 'ak-b'])
})

test('moved moves nothing at either end or for a mod not shown', () => {
  const order = ['ak-a', 'ak-b']

  expect(moved(order, order, 'ak-a', -1)).toBeUndefined()
  expect(moved(order, order, 'ak-b', 1)).toBeUndefined()
  expect(moved(order, order, 'ak-x', 1)).toBeUndefined()
})

test('moved gives a shown mod the order does not name its shown place first', () => {
  expect(moved(['ak-a'], ['ak-a', 'ak-x', 'ak-y'], 'ak-y', -1)).toEqual(['ak-a', 'ak-y', 'ak-x'])
})
