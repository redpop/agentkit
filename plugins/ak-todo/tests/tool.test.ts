import { expect, test } from 'claude-code/testing'

import { add, emptyList } from '../hooks/list'
import type { Kind, Owner, TodoList } from '../hooks/list'
import { applyTool } from '../hooks/tool'

const T = 1_000

const withEntries = (...items: [Kind, string, Owner][]): TodoList =>
  items.reduce((list, [kind, text, owner]) => {
    const result = add(list, { kind, text, owner }, T)
    if ('error' in result) throw new Error(result.error)

    return result.list
  }, emptyList(T))

test('add creates a Claude-owned task', () => {
  const result = applyTool(emptyList(T), { action: 'add', kind: 'task', text: 'Check the cache' }, T)
  expect(result.list?.entries).toEqual([{ id: 1, kind: 'task', text: 'Check the cache', owner: 'claude', status: 'open' }])
  expect(result.text.includes('[T1 id=1 open, claude] Check the cache')).toBe(true)
})

test('add without a kind adds a task', () => {
  expect(applyTool(emptyList(T), { action: 'add', text: 'x' }, T).list?.entries[0]?.kind).toBe('task')
})

test('done on a user task works', () => {
  const result = applyTool(withEntries(['task', 'Fix login', 'user']), { action: 'done', id: 1 }, T)
  expect(result.list?.entries[0]?.status).toBe('done')
})

test('remove of a user note is refused with the ask-first text', () => {
  const result = applyTool(withEntries(['task', 'a', 'claude'], ['note', 'n', 'user']), { action: 'remove', id: 2 }, T)
  expect(result.list).toBeUndefined()
  expect(result.text).toBe('N1 belongs to the user. Ask them before removing it.')
})

test('remove of a Claude task goes to the trash and is not recorded as removed', () => {
  const result = applyTool(withEntries(['task', 'mine', 'claude']), { action: 'remove', id: 1 }, T)
  expect(result.list?.trash.map(e => e.text)).toEqual(['mine'])
  expect(result.list?.removed).toEqual([])
})

test('add of a removed text is refused', () => {
  const list = { ...withEntries(), removed: ['fix login'] }
  expect(applyTool(list, { action: 'add', text: 'Fix  login' }, T)).toEqual({ text: 'The user removed this entry earlier. Do not add it again.' })
})

test('an input with no action answers a reason and no list', () => {
  const result = applyTool(emptyList(T), { text: 'x' }, T)
  expect(result.list).toBeUndefined()
  expect(result.text.includes('action')).toBe(true)
  expect(applyTool(emptyList(T), 'nonsense', T).list).toBeUndefined()
  expect(applyTool(emptyList(T), { action: 'done', id: 'one' }, T).list).toBeUndefined()
})

test('update a status on a note is refused', () => {
  expect(applyTool(withEntries(['note', 'n', 'user']), { action: 'update', id: 1, status: 'done' }, T).list).toBeUndefined()
})

test('update defers a task and move reorders', () => {
  let list = withEntries(['task', 'a', 'user'], ['task', 'b', 'user'])
  list = applyTool(list, { action: 'move', id: 2, to: 1 }, T).list!
  expect(list.entries.map(e => e.text)).toEqual(['b', 'a'])
  list = applyTool(list, { action: 'update', id: 2, deferred: true }, T).list!
  expect(list.entries.find(e => e.id === 2)?.isDeferred).toBe(true)
})

test('list answers the rendered list', () => {
  expect(applyTool(withEntries(['task', 'a', 'user']), { action: 'list' }, T)).toEqual({ text: 'Session list (ak-todo):\n[T1 id=1 open, user] a' })
  expect(applyTool(emptyList(T), { action: 'list' }, T)).toEqual({ text: 'The session list is empty.' })
})
