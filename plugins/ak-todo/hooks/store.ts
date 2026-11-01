import type { EngineInterface } from 'claude-code'

import type { Entry, TodoList } from './list'

/** A list's store key: this prefix and the conversation's id. */
export const LIST_PREFIX = 'list:'
export const SETTINGS_KEY = 'settings'
/** What `$.store` holds for all sessions together. */
export const STORE_LIMIT = 4 * 1024 * 1024
/** Lists untouched this long are dropped at a session start. */
export const KEEP_MS = 30 * 24 * 60 * 60 * 1000

/** Global settings: the detection pass and its model. */
export type Settings = { detect: boolean; model: string }
const DEFAULT_SETTINGS: Settings = { detect: false, model: 'haiku' }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const isEntry = (value: unknown): value is Entry =>
  isRecord(value) &&
  isNumber(value.id) &&
  (value.kind === 'task' || value.kind === 'note') &&
  typeof value.text === 'string' &&
  (value.owner === 'user' || value.owner === 'claude') &&
  (value.status === undefined || value.status === 'open' || value.status === 'doing' || value.status === 'done') &&
  (value.isDeferred === undefined || value.isDeferred === true)

/** A stored list, or undefined unless it has this version's shape throughout. */
export const parseList = (value: unknown): TodoList | undefined =>
  isRecord(value) &&
  value.v === 1 &&
  isNumber(value.nextId) &&
  isNumber(value.touched) &&
  Array.isArray(value.entries) &&
  value.entries.every(isEntry) &&
  Array.isArray(value.trash) &&
  value.trash.every(isEntry) &&
  Array.isArray(value.removed) &&
  value.removed.every(r => typeof r === 'string')
    ? (value as TodoList)
    : undefined

/** Stored settings, each field that is missing or of the wrong type taken from the default. */
export const parseSettings = (value: unknown): Settings => ({
  detect: isRecord(value) && typeof value.detect === 'boolean' ? value.detect : DEFAULT_SETTINGS.detect,
  model: isRecord(value) && typeof value.model === 'string' && value.model !== '' ? value.model : DEFAULT_SETTINGS.model,
})

/** The keys of lists untouched for longer than KEEP_MS. */
export const stale = (lists: Record<string, TodoList>, now: number): string[] =>
  Object.keys(lists).filter(key => now - lists[key]!.touched > KEEP_MS)

/** The keys of lists other than `current`, touched longest ago first. */
export const evictable = (lists: Record<string, TodoList>, current: string): string[] =>
  Object.keys(lists)
    .filter(key => key !== current)
    .sort((a, b) => lists[a]!.touched - lists[b]!.touched)

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those.

/** The id the list belongs to: the conversation's, which a reopen keeps and /clear replaces. */
export async function conversationId($: EngineInterface): Promise<string> {
  return $.session.id()
}

/** This conversation's stored list; undefined when there is none, it has a bad shape, or the read fails. */
export async function loadList($: EngineInterface, id: string): Promise<TodoList | undefined> {
  try {
    return parseList(await $.store.get(LIST_PREFIX + id))
  } catch {
    return undefined
  }
}

// Every stored list by its full key; one with a bad shape is left out.
async function storedLists($: EngineInterface): Promise<{ lists: Record<string, TodoList> }> {
  const lists: Record<string, TodoList> = {}
  for (const key of await $.store.keys()) {
    if (!key.startsWith(LIST_PREFIX)) continue
    const list = parseList(await $.store.get(key))
    if (list) lists[key] = list
  }

  return { lists }
}

// What the store holds, counted as JSON, with `list` in place of what `key` holds now.
async function storedSize($: EngineInterface, key: string, list: TodoList): Promise<number> {
  let size = JSON.stringify(list).length + key.length
  for (const other of await $.store.keys()) {
    if (other !== key) size += other.length + JSON.stringify((await $.store.get(other)) ?? null).length
  }

  return size
}

/**
 * Writes this conversation's list. When the store refuses the write while it is near its limit,
 * the lists of other conversations touched longest ago are dropped one by one and the write tried
 * again; false once none is left to drop and the write still fails. A refusal while the store is
 * far from full (out of reach, a write cut short) drops nothing.
 */
export async function saveList($: EngineInterface, id: string, list: TodoList, limit = STORE_LIMIT): Promise<boolean> {
  const key = LIST_PREFIX + id
  try {
    await $.store.set(key, list)

    return true
  } catch {
    // Over the store's limit, or the store is out of reach: decide below.
  }
  let others: string[]
  try {
    if ((await storedSize($, key, list)) < limit * 0.9) return false
    others = evictable((await storedLists($)).lists, key)
  } catch {
    return false
  }
  for (const other of others) {
    try {
      await $.store.delete(other)
      await $.store.set(key, list)

      return true
    } catch {
      // Still refused: drop the next.
    }
  }

  return false
}

/**
 * Drops the lists untouched for 30 days. A value of a shape this version cannot read stays: a later
 * version may have written it.
 */
export async function pruneStale($: EngineInterface, now: number): Promise<void> {
  try {
    const { lists } = await storedLists($)
    for (const key of stale(lists, now)) await $.store.delete(key)
  } catch {
    // The store is out of reach: prune at the next start.
  }
}

export async function loadSettings($: EngineInterface): Promise<Settings> {
  try {
    return parseSettings(await $.store.get(SETTINGS_KEY))
  } catch {
    return parseSettings(undefined)
  }
}

export async function saveSettings($: EngineInterface, settings: Settings): Promise<void> {
  await $.store.set(SETTINGS_KEY, settings)
}
