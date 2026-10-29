import { expect, test } from 'claude-code/testing'

import { clean, draftFor, excerpt } from '../hooks/joblog'
import type { Job, Mr } from '../hooks/model'

const lines = (count: number, at?: { line: number; text: string }) =>
  Array.from({ length: count }, (_, index) => (at && index + 1 === at.line ? at.text : `line ${index + 1}`)).join('\n')

test('clean drops colours, section markers and overwritten text', () => {
  const trace = [
    'section_start:1700000000:build_script\r\x1b[0K\x1b[0;31mRunning tests\x1b[0m',
    'progress 10%\rprogress 100%',
    'section_end:1700000000:build_script\r\x1b[0K',
    '\x1b[32;1mJob succeeded\x1b[0;m',
  ].join('\n')
  expect(clean(trace)).toEqual(['Running tests', 'progress 100%', '', 'Job succeeded'])
})

test('the excerpt keeps an error with three lines around it and the last 30 lines', () => {
  const result = excerpt(lines(200, { line: 50, text: 'ERROR: boom' })).split('\n')
  expect(result.slice(0, 7)).toEqual(['line 47', 'line 48', 'line 49', 'ERROR: boom', 'line 51', 'line 52', 'line 53'])
  expect(result[7]).toBe('…')
  expect(result.slice(8)).toEqual(Array.from({ length: 30 }, (_, index) => `line ${171 + index}`))
})

test('windows that overlap merge, no line twice', () => {
  const trace = lines(100, { line: 20, text: 'fatal: no remote' }).replace('line 22\n', 'Tests failed\n')
  const result = excerpt(trace).split('\n')
  expect(result.slice(0, 10)).toEqual([
    'line 17',
    'line 18',
    'line 19',
    'fatal: no remote',
    'line 21',
    'Tests failed',
    'line 23',
    'line 24',
    'line 25',
    '…',
  ])
  expect(new Set(result.filter(line => line !== '…')).size).toBe(result.filter(line => line !== '…').length)
})

test('error-like lines include exceptions, panics and crosses', () => {
  for (const text of ['Exception in thread main', 'panic: runtime error', '✗ 2 tests', '✖ lint']) {
    expect(excerpt(lines(100, { line: 10, text })).split('\n')).toContain(text)
  }
})

test('without an error-like line the last 30 lines alone', () => {
  expect(excerpt(lines(100)).split('\n')).toEqual(Array.from({ length: 30 }, (_, index) => `line ${71 + index}`))
})

test('a long excerpt is cut from the front', () => {
  const result = excerpt(lines(100), 50)
  expect(result).toStartWith('…')
  expect(result.length).toBeLessThanOrEqual(50)
  expect(result.endsWith('line 100')).toBe(true)
})

test('the draft names the merge request, job and stage, the excerpt fenced', () => {
  const mr: Mr = { iid: 12, title: 'Add the login form', webUrl: 'https://gitlab.example.com/x', target: 'main', isDraft: false }
  const job: Job = { id: 9, name: 'test:unit', stage: 'test', status: 'failed', allowFailure: false }
  expect(draftFor(mr, job, 'ERROR: boom', 'de')).toBe(
    'Die Pipeline von !12 ist im Job test:unit (Stage test) fehlgeschlagen. Auszug aus dem Log:\n\n```text\nERROR: boom\n```',
  )
})
