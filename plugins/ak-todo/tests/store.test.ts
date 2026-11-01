import { expect, test } from 'claude-code/testing'
import type { EngineInterface } from 'claude-code'

import { add, emptyList } from '../hooks/list'
import type { TodoList } from '../hooks/list'
import { KEEP_MS, LIST_PREFIX, evictable, loadList, loadSettings, parseList, parseSettings, pruneStale, saveList, stale } from '../hooks/store'

const DAY = 24 * 60 * 60 * 1000
const NOW = 100 * DAY

const listAt = (touched: number): TodoList => ({ ...emptyList(touched) })

// A `$` with a store of its own. `rejectsWhile` makes `set` reject while it answers true for the
// keys held at that moment; `throws` makes every call throw.
const host = (entries: Record<string, unknown> = {}, opts: { rejectsWhile?: (keys: string[]) => boolean; throws?: boolean } = {}) => {
  const data = new Map(Object.entries(entries))
  const deleted: string[] = []
  const fail = () => {
    if (opts.throws) throw new Error('store unavailable')
  }
  const store = {
    get: async (key: string) => (fail(), data.get(key)),
    set: async (key: string, value: unknown) => {
      fail()
      if (opts.rejectsWhile?.([...data.keys()])) throw new Error('store: over its limit')
      data.set(key, JSON.parse(JSON.stringify(value)))
    },
    delete: async (key: string) => (fail(), deleted.push(key), void data.delete(key)),
    keys: async () => (fail(), [...data.keys()]),
  }

  return { $: { store, session: { id: async () => 'now' } } as unknown as EngineInterface, data, deleted }
}

test('parseList refuses v: 2, a missing field and a string', () => {
  const good = add(emptyList(1), { kind: 'task', text: 'a', owner: 'user' }, 1)
  if ('error' in good) throw new Error('setup')
  expect(parseList(JSON.parse(JSON.stringify(good.list)))).toEqual(good.list)
  expect(parseList({ ...good.list, v: 2 })).toBeUndefined()
  const { trash: _, ...noTrash } = good.list
  expect(parseList(noTrash)).toBeUndefined()
  expect(parseList({ ...good.list, entries: [{ id: 1, kind: 'task', text: 7, owner: 'user' }] })).toBeUndefined()
  expect(parseList('list')).toBeUndefined()
})

test('parseSettings falls back to detection off with haiku', () => {
  expect(parseSettings(undefined)).toEqual({ detect: false, model: 'haiku' })
  expect(parseSettings({ detect: 'yes', model: 3 })).toEqual({ detect: false, model: 'haiku' })
  expect(parseSettings({ detect: true, model: 'sonnet' })).toEqual({ detect: true, model: 'sonnet' })
})

test('stale lists keys older than 30 days', () => {
  const lists = { a: listAt(NOW - KEEP_MS - 1), b: listAt(NOW - KEEP_MS + 1) }
  expect(stale(lists, NOW)).toEqual(['a'])
})

test('evictable never names the current key and orders oldest first', () => {
  const lists = { cur: listAt(1), x: listAt(30), y: listAt(10) }
  expect(evictable(lists, 'cur')).toEqual(['y', 'x'])
})

test('loadList answers undefined when the store throws', async () => {
  expect(await loadList(host({}, { throws: true }).$, 'c')).toBeUndefined()
})

test('loadList answers undefined for a bad shape', async () => {
  expect(await loadList(host({ [LIST_PREFIX + 'c']: { v: 9 } }).$, 'c')).toBeUndefined()
})

test('saveList evicts the oldest other list when set rejects, then succeeds', async () => {
  const h = host(
    { [LIST_PREFIX + 'old']: listAt(1), [LIST_PREFIX + 'mid']: listAt(5), settings: { detect: false, model: 'haiku' } },
    { rejectsWhile: keys => keys.filter(k => k.startsWith(LIST_PREFIX)).length >= 2 },
  )
  expect(await saveList(h.$, 'now', listAt(NOW), 10)).toBe(true)
  expect(h.deleted).toEqual([LIST_PREFIX + 'old'])
  expect(h.data.has(LIST_PREFIX + 'now')).toBe(true)
  expect(h.data.has('settings')).toBe(true)
})

test('saveList answers false when only the current list is left and set still rejects', async () => {
  const h = host({ [LIST_PREFIX + 'now']: listAt(1), [LIST_PREFIX + 'o']: listAt(2) }, { rejectsWhile: () => true })
  expect(await saveList(h.$, 'now', listAt(NOW), 10)).toBe(false)
  expect(h.deleted).toEqual([LIST_PREFIX + 'o'])
})

test('saveList deletes nothing when set fails while the store is far from full', async () => {
  const h = host({ [LIST_PREFIX + 'o']: listAt(2) }, { rejectsWhile: () => true })
  expect(await saveList(h.$, 'now', listAt(NOW))).toBe(false)
  expect(h.deleted).toEqual([])
})

test('pruneStale drops lists untouched for 30 days and keeps the rest, a bad shape too', async () => {
  const h = host({ [LIST_PREFIX + 'a']: listAt(NOW - KEEP_MS - 1), [LIST_PREFIX + 'b']: listAt(NOW), [LIST_PREFIX + 'bad']: { v: 2 }, settings: {} })
  await pruneStale(h.$, NOW)
  expect([...h.data.keys()].sort()).toEqual([LIST_PREFIX + 'b', LIST_PREFIX + 'bad', 'settings'])
})

test('loadSettings answers the default when the store throws', async () => {
  expect(await loadSettings(host({}, { throws: true }).$)).toEqual({ detect: false, model: 'haiku' })
})
