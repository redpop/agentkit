import { expect, test } from 'claude-code/testing'

import { MAX_ENTRIES, add, clean, emptyList, move, numbered, remove, resolve, restore, update } from '../hooks/list'
import type { Changed, Failure, Kind, Owner, TodoList } from '../hooks/list'

const T = 1_000

const ok = (result: Changed | Failure): Changed => {
  if ('error' in result) throw new Error(`expected a change, got ${result.error}`)

  return result
}

const withEntries = (...items: [Kind, string, Owner?][]): TodoList =>
  items.reduce((list, [kind, text, owner]) => ok(add(list, { kind, text, owner: owner ?? 'user' }, T)).list, emptyList(T))

const refs = (list: TodoList) => {
  const { tasks, notes } = numbered(list)

  return { tasks: tasks.map(n => `${n.ref} ${n.entry.text}`), notes: notes.map(n => `${n.ref} ${n.entry.text}`) }
}

test('numbers open tasks before deferred before done', () => {
  let list = withEntries(['task', 'a'], ['task', 'b'], ['note', 'n'], ['task', 'c'], ['task', 'd'])
  list = ok(update(list, 1, { status: 'done' }, T)).list
  list = ok(update(list, 2, { isDeferred: true }, T)).list
  list = ok(update(list, 4, { status: 'doing' }, T)).list
  expect(refs(list)).toEqual({ tasks: ['T1 c', 'T2 d', 'T3 b', 'T4 a'], notes: ['N1 n'] })
})

test('resolves T3, N2 and a bare 3', () => {
  const list = withEntries(['task', 'a'], ['note', 'm'], ['task', 'b'], ['note', 'n'], ['task', 'c'])
  expect(resolve(list, 'T3')?.text).toBe('c')
  expect(resolve(list, 't3')?.text).toBe('c')
  expect(resolve(list, 'N2')?.text).toBe('n')
  expect(resolve(list, '3')?.text).toBe('c')
  expect(resolve(list, 'T9')).toBeUndefined()
  expect(resolve(list, 'x')).toBeUndefined()
})

test('cleans a newline and ESC to one line and caps at 500', () => {
  const text = clean('a\nb\u001b' + 'x'.repeat(2000))
  expect(text.includes('\n')).toBe(false)
  expect(text.includes('\u001b')).toBe(false)
  expect(text.length).toBe(500)
})

test('refuses an entry that is empty once cleaned', () => {
  expect(add(emptyList(T), { kind: 'task', text: ' \n\t ', owner: 'user' }, T)).toEqual({ error: 'empty' })
})

test('refuses a 101st entry', () => {
  let list = emptyList(T)
  for (let i = 0; i < MAX_ENTRIES; i++) list = ok(add(list, { kind: 'note', text: `n${i}`, owner: 'user' }, T)).list
  expect(add(list, { kind: 'task', text: 'one more', owner: 'user' }, T)).toEqual({ error: 'full' })
})

test('refuses Claude re-adding a text the user removed, case and spaces ignored', () => {
  const list = ok(remove(withEntries(['task', 'Fix  Login']), 1, 'user', T)).list
  expect(add(list, { kind: 'task', text: 'fix login', owner: 'claude' }, T)).toEqual({ error: 'removed' })
})

test('lets the user re-add what they removed', () => {
  const list = ok(remove(withEntries(['task', 'Fix Login']), 1, 'user', T)).list
  expect(ok(add(list, { kind: 'task', text: 'fix login', owner: 'user' }, T)).entry.text).toBe('fix login')
})

test('refuses Claude removing a user entry', () => {
  expect(remove(withEntries(['task', 'a']), 1, 'claude', T)).toEqual({ error: 'owned-by-user' })
})

test('lets Claude remove its own entry without recording the text', () => {
  const list = ok(remove(withEntries(['task', 'mine', 'claude']), 1, 'claude', T)).list
  expect(list.removed).toEqual([])
  expect(list.trash.map(e => e.text)).toEqual(['mine'])
})

test('keeps 50 in the trash, newest first', () => {
  let list = emptyList(T)
  for (let i = 0; i < 60; i++) {
    list = ok(add(list, { kind: 'note', text: `n${i}`, owner: 'user' }, T)).list
    list = ok(remove(list, list.entries[0]!.id, 'user', T)).list
  }
  expect(list.trash.length).toBe(50)
  expect(list.trash[0]!.text).toBe('n59')
  expect(list.removed.length).toBe(60)
})

test('moves T3 to position 1 among tasks only', () => {
  const list = withEntries(['note', 'n'], ['task', 'a'], ['task', 'b'], ['task', 'c'])
  const moved = ok(move(list, 4, 1, T)).list
  expect(refs(moved)).toEqual({ tasks: ['T1 c', 'T2 a', 'T3 b'], notes: ['N1 n'] })
})

test('refuses a status on a note', () => {
  expect(update(withEntries(['note', 'n']), 1, { status: 'done' }, T)).toEqual({ error: 'not-a-task' })
})

test('restore puts the entry back at the end of its kind', () => {
  let list = withEntries(['task', 'a'], ['task', 'b'], ['note', 'n'])
  list = ok(remove(list, 1, 'user', T)).list
  list = ok(restore(list, 1, T)).list
  expect(refs(list)).toEqual({ tasks: ['T1 b', 'T2 a'], notes: ['N1 n'] })
  expect(list.trash).toEqual([])
  expect(restore(list, 1, T)).toEqual({ error: 'not-found' })
})

test('does not mutate its input', () => {
  const list = withEntries(['task', 'a'], ['task', 'b'])
  const before = JSON.stringify(list)
  add(list, { kind: 'note', text: 'n', owner: 'user' }, T + 1)
  update(list, 1, { status: 'done' }, T + 1)
  remove(list, 1, 'user', T + 1)
  move(list, 2, 1, T + 1)
  expect(JSON.stringify(list)).toBe(before)
})

test('every change sets touched', () => {
  expect(ok(add(emptyList(T), { kind: 'task', text: 'a', owner: 'user' }, T + 5)).list.touched).toBe(T + 5)
})
