import { expect, test } from 'claude-code/testing'

import { DETECT_SYSTEM, detectPrompt, parseDetected } from '../hooks/detect'
import { add, emptyList } from '../hooks/list'

test('parseDetected reads ["a","b"] inside prose', () => {
  expect(parseDetected('Here you go:\n["Fix the cache", "Ask about the API"]\nDone.')).toEqual(['Fix the cache', 'Ask about the API'])
})

test('parseDetected answers [] for "none" and for {"a":1}', () => {
  expect(parseDetected('none')).toEqual([])
  expect(parseDetected('{"a":1}')).toEqual([])
  expect(parseDetected('[1, 2]')).toEqual([])
  expect(parseDetected('[broken')).toEqual([])
})

test('caps at 5 and cleans each', () => {
  expect(parseDetected(JSON.stringify(['a\nb', ' ', 'c', 'd', 'e', 'f', 'g']))).toEqual(['a b', 'c', 'd', 'e', 'f'])
})

test('detectPrompt carries the answer and the entries to skip', () => {
  const result = add(emptyList(1), { kind: 'task', text: 'Fix login', owner: 'user' }, 1)
  if ('error' in result) throw new Error(result.error)
  const prompt = detectPrompt('I left the cache for later.', result.list)
  expect(prompt.includes('I left the cache for later.')).toBe(true)
  expect(prompt.includes('- Fix login')).toBe(true)
  expect(DETECT_SYSTEM.includes('JSON array')).toBe(true)
})
