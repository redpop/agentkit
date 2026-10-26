import { expect, test } from 'claude-code/testing'

import type { ModsInfo } from '../types'
import { isAgentKit, rows, upsert } from '../hooks/switches'

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

test('rows sort by title, case-insensitive, and map the switches', () => {
  const declared = [info('ak-c', 'charlie'), info('ak-b', 'Bravo'), info('ak-a', 'alpha')]

  expect(rows(declared, { 'ak-a': true, 'ak-b': false }, ['ak-b'])).toEqual([
    { ...info('ak-a', 'alpha'), isOn: true, isStandard: false },
    { ...info('ak-b', 'Bravo'), isOn: false, isStandard: true },
    { ...info('ak-c', 'charlie'), isOn: false, isStandard: false },
  ])
})
