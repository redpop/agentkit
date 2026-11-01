import { expect, test } from 'claude-code/testing'

import { applyCommand, parseCommand } from '../hooks/command'
import { add, emptyList, numbered } from '../hooks/list'
import type { Kind, TodoList } from '../hooks/list'

const T = 1_000

const withEntries = (...items: [Kind, string][]): TodoList =>
  items.reduce((list, [kind, text]) => {
    const result = add(list, { kind, text, owner: 'user' }, T)
    if ('error' in result) throw new Error(result.error)

    return result.list
  }, emptyList(T))

const apply = (list: TodoList, command: 'todo' | 'note', args: string) => applyCommand(list, parseCommand(command, args), T, 'en')

test('parses done T3', () => {
  expect(parseCommand('todo', 'done T3')).toEqual({ kind: 'done', ref: 'T3' })
})

test('treats "done the docs" as text to add', () => {
  expect(parseCommand('todo', 'done the docs')).toEqual({ kind: 'add', entry: 'task', text: 'done the docs' })
})

test('parses move 3 1 and edit N2 new text', () => {
  expect(parseCommand('todo', 'move 3 1')).toEqual({ kind: 'move', ref: '3', to: 1 })
  expect(parseCommand('note', 'edit N2 new  text')).toEqual({ kind: 'edit', ref: 'N2', text: 'new  text' })
})

test('parses the subcommands without a ref', () => {
  expect(parseCommand('todo', 'sel')).toEqual({ kind: 'sel', entry: 'task' })
  expect(parseCommand('note', 'sel')).toEqual({ kind: 'sel', entry: 'note' })
  expect(parseCommand('todo', 'trash')).toEqual({ kind: 'trash' })
  expect(parseCommand('todo', 'restore 2')).toEqual({ kind: 'restore', index: 2 })
  expect(parseCommand('todo', 'clear done')).toEqual({ kind: 'clear-done' })
  expect(parseCommand('todo', 'detect on')).toEqual({ kind: 'detect', isOn: true })
  expect(parseCommand('todo', 'model sonnet')).toEqual({ kind: 'model', alias: 'sonnet' })
  expect(parseCommand('todo', 'model of the car')).toEqual({ kind: 'add', entry: 'task', text: 'model of the car' })
  expect(parseCommand('todo', 'model opus')).toEqual({ kind: 'bad-model', alias: 'opus' })
  expect(parseCommand('todo', 'ask T1 what now?')).toEqual({ kind: 'ask', ref: 'T1', text: 'what now?' })
})

test('empty /todo is toggle', () => {
  expect(parseCommand('todo', '  ')).toEqual({ kind: 'toggle' })
})

test('/note text adds a note', () => {
  const result = apply(emptyList(T), 'note', 'API key lives in .env')
  if (!('list' in result)) throw new Error('no list')
  expect(numbered(result.list).notes.map(n => n.entry.text)).toEqual(['API key lives in .env'])
  expect(result.reply).toBe('Added: N1 API key lives in .env')
})

test('unknown ref T9 replies with the ref and leaves the list unchanged', () => {
  const result = apply(withEntries(['task', 'a']), 'todo', 'done T9')
  expect('list' in result).toBe(false)
  expect(result.reply.includes('T9')).toBe(true)
})

test('0 and -1 are refs that match nothing, and change nothing', () => {
  const list = withEntries(['task', 'a'])
  for (const args of ['done 0', 'rm -1', 'move T1 0', 'restore 0', 'edit 0 x']) {
    const result = apply(list, 'todo', args)
    expect('list' in result).toBe(false)
    expect(/0|-1/.test(result.reply)).toBe(true)
  }
  expect(parseCommand('todo', 'done 0 days')).toEqual({ kind: 'add', entry: 'task', text: 'done 0 days' })
})

test('done echoes the entry\'s ref and text', () => {
  const result = apply(withEntries(['task', 'a'], ['task', 'Fix login']), 'todo', 'done 2')
  expect(result.reply).toBe('Done: T2 Fix login')
  expect('note' in result && result.note?.includes('Fix login')).toBe(true)
})

test('rm records the text as removed by the user', () => {
  const result = apply(withEntries(['task', 'Fix Login']), 'todo', 'rm T1')
  if (!('list' in result)) throw new Error('no list')
  expect(result.list.removed).toEqual(['fix login'])
  expect(result.list.entries).toEqual([])
})

test('clear done reports how many went to the trash', () => {
  const done = applyCommand(withEntries(['task', 'a'], ['task', 'b']), { kind: 'done', ref: 'T1' }, T, 'de')
  if (!('list' in done)) throw new Error('no list')
  const cleared = applyCommand(done.list, { kind: 'clear-done' }, T, 'de')
  expect(cleared.reply).toBe('1 erledigte in den Papierkorb gelegt.')
})

test('later and back echo the entry, in both languages', () => {
  const later = applyCommand(withEntries(['task', 'a']), { kind: 'later', ref: 'T1' }, T, 'de')
  if (!('list' in later)) throw new Error('no list')
  expect(later.reply).toBe('Später: T1 a')
  expect(applyCommand(later.list, { kind: 'later', ref: 'T1' }, T, 'en').reply).toBe('Back: T1 a')
})
