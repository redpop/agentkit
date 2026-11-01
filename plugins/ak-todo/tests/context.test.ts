import { expect, test } from 'claude-code/testing'

import { SECTION, joinNotes, listContext, unsent } from '../hooks/context'
import { add, emptyList, update } from '../hooks/list'
import type { Changed, Failure } from '../hooks/list'

const ok = (result: Changed | Failure): Changed => {
  if ('error' in result) throw new Error(result.error)

  return result
}

test('empty list renders nothing', () => {
  expect(listContext(emptyList(1))).toBeUndefined()
})

test('renders ref, id, status and owner per line', () => {
  let list = ok(add(emptyList(1), { kind: 'task', text: 'Fix login', owner: 'user' }, 1)).list
  list = ok(add(list, { kind: 'note', text: 'Uses port 3000', owner: 'claude' }, 1)).list
  list = ok(add(list, { kind: 'task', text: 'Later thing', owner: 'claude' }, 1)).list
  list = ok(update(list, 3, { isDeferred: true }, 1)).list
  expect(listContext(list)).toBe(
    ['Session list (ak-todo):', '[T1 id=1 open, user] Fix login', '[T2 id=3 open, deferred, claude] Later thing', '[N1 id=2 note, claude] Uses port 3000'].join('\n'),
  )
})

test('SECTION names the ask-first rule and the no-remove rule', () => {
  expect(SECTION.includes('ask')).toBe(true)
  expect(SECTION.includes('Never remove')).toBe(true)
  expect(SECTION.split(/\s+/).length < 120).toBe(true)
})

test('joinNotes of nothing is undefined', () => {
  expect(joinNotes([])).toBeUndefined()
  expect(joinNotes(['a', 'b'])).toBe('Changed by the user since your last turn:\n- a\n- b')
})

test('unsent keeps the notes added after the prompt was sent, also when the cap dropped some', () => {
  expect(unsent(['a', 'b', 'c'], ['a', 'b'])).toEqual(['c'])
  expect(unsent(['b', 'c', 'd'], ['a', 'b'])).toEqual(['c', 'd'])
  expect(unsent(['x'], ['a', 'b'])).toEqual(['x'])
  expect(unsent(['a', 'b'], ['a', 'b'])).toEqual([])
})
