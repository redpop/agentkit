import type { Entry, Kind, Owner, Status, TodoList } from '../types'

export type { Entry, Kind, Owner, Status, TodoList }

/** An entry with the number the person sees: `T1`, `N1`. */
export type Numbered = { ref: string; entry: Entry }
/** Why a change was not made. */
export type Failure = { error: 'empty' | 'full' | 'removed' | 'not-found' | 'owned-by-user' | 'not-a-task' }
/** A change that was made: the new list and the entry it concerns. */
export type Changed = { list: TodoList; entry: Entry }

export const MAX_TEXT = 500
export const MAX_ENTRIES = 100
export const MAX_TRASH = 50
// Kept long enough for any session; the oldest give way past it.
const MAX_REMOVED = 500

export const emptyList = (now: number): TodoList => ({ v: 1, nextId: 1, entries: [], trash: [], removed: [], touched: now })

/** One line: control characters become spaces, runs of white space one, cut to MAX_TEXT characters. */
export const clean = (text: string): string =>
  Array.from(text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, MAX_TEXT)
    .join('')
    .trim()

/** The form texts are compared in: cleaned, lower case. */
export const normalise = (text: string): string => clean(text).toLowerCase()

const isActive = (e: Entry) => e.status !== 'done' && e.isDeferred !== true
const isDone = (e: Entry) => e.status === 'done'

/** Tasks in the order shown (open and doing, then deferred, then done) and notes in list order. */
export const numbered = (list: TodoList): { tasks: Numbered[]; notes: Numbered[] } => {
  const tasks = list.entries.filter(e => e.kind === 'task')
  const ordered = [...tasks.filter(isActive), ...tasks.filter(e => !isActive(e) && !isDone(e)), ...tasks.filter(isDone)]

  return {
    tasks: ordered.map((entry, i) => ({ ref: `T${i + 1}`, entry })),
    notes: list.entries.filter(e => e.kind === 'note').map((entry, i) => ({ ref: `N${i + 1}`, entry })),
  }
}

/** The entry a person's number names: `T3`, `N2`, or a bare `3` for `T3`, in any case. */
export const resolve = (list: TodoList, ref: string): Entry | undefined => {
  const match = /^([tn]?)(\d+)$/i.exec(ref.trim())
  if (!match) return undefined
  const { tasks, notes } = numbered(list)

  return (match[1]!.toLowerCase() === 'n' ? notes : tasks)[Number(match[2]) - 1]?.entry
}

const changed = (list: TodoList, entries: Entry[], entry: Entry, now: number, extra: Partial<TodoList> = {}): Changed => ({
  list: { ...list, ...extra, entries, touched: now },
  entry,
})

const remember = (removed: string[], texts: string[]): string[] => {
  const next = [...removed]
  for (const text of texts) if (!next.includes(text)) next.push(text)

  return next.slice(-MAX_REMOVED)
}

export const add = (list: TodoList, item: { kind: Kind; text: string; owner: Owner }, now: number): Changed | Failure => {
  const text = clean(item.text)
  if (text === '') return { error: 'empty' }
  if (list.entries.length >= MAX_ENTRIES) return { error: 'full' }
  if (item.owner === 'claude' && list.removed.includes(text.toLowerCase())) return { error: 'removed' }
  const entry: Entry = { id: list.nextId, kind: item.kind, text, owner: item.owner, ...(item.kind === 'task' ? { status: 'open' as const } : {}) }

  return changed(list, [...list.entries, entry], entry, now, { nextId: list.nextId + 1 })
}

export const update = (
  list: TodoList,
  id: number,
  patch: { text?: string; status?: Status; isDeferred?: boolean },
  now: number,
  by: Owner = 'user',
): Changed | Failure => {
  const old = list.entries.find(e => e.id === id)
  if (!old) return { error: 'not-found' }
  if (old.kind === 'note' && (patch.status !== undefined || patch.isDeferred !== undefined)) return { error: 'not-a-task' }
  const text = patch.text === undefined ? old.text : clean(patch.text)
  if (text === '') return { error: 'empty' }
  // Claude may not bring back, through a new text, what the user removed.
  if (by === 'claude' && normalise(text) !== normalise(old.text) && list.removed.includes(normalise(text))) return { error: 'removed' }
  const { isDeferred: _, ...rest } = old
  const isDeferred = patch.isDeferred ?? old.isDeferred === true
  const entry: Entry = { ...rest, text, ...(patch.status ? { status: patch.status } : {}), ...(isDeferred ? { isDeferred: true as const } : {}) }

  return changed(list, list.entries.map(e => (e.id === id ? entry : e)), entry, now)
}

/** Moves an entry to the trash. Claude may remove only its own; a user's removal is remembered. */
export const remove = (list: TodoList, id: number, by: Owner, now: number): Changed | Failure => {
  const entry = list.entries.find(e => e.id === id)
  if (!entry) return { error: 'not-found' }
  if (by === 'claude' && entry.owner === 'user') return { error: 'owned-by-user' }

  return changed(list, list.entries.filter(e => e.id !== id), entry, now, {
    trash: [entry, ...list.trash].slice(0, MAX_TRASH),
    removed: by === 'user' ? remember(list.removed, [normalise(entry.text)]) : list.removed,
  })
}

/** Moves an entry to a 1-based position among the entries of its own kind, as numbered. */
export const move = (list: TodoList, id: number, to: number, now: number): Changed | Failure => {
  const entry = list.entries.find(e => e.id === id)
  if (!entry) return { error: 'not-found' }
  const { tasks, notes } = numbered(list)
  const order = (entry.kind === 'task' ? tasks : notes).map(n => n.entry)
  const from = order.indexOf(entry)
  const target = order[Math.min(Math.max(Math.trunc(to), 1), order.length) - 1]!
  if (target === entry) return { list, entry }
  const rest = list.entries.filter(e => e !== entry)
  const at = rest.indexOf(target) + (order.indexOf(target) > from ? 1 : 0)

  return changed(list, [...rest.slice(0, at), entry, ...rest.slice(at)], entry, now)
}

/** Puts every done task in the trash, as removed by the user. */
export const clearDone = (list: TodoList, now: number): TodoList => {
  const done = numbered(list).tasks.map(n => n.entry).filter(isDone)
  if (done.length === 0) return list

  return {
    ...list,
    entries: list.entries.filter(e => !isDone(e)),
    trash: [...[...done].reverse(), ...list.trash].slice(0, MAX_TRASH),
    removed: remember(list.removed, done.map(e => normalise(e.text))),
    touched: now,
  }
}

/** Brings back the trash's `index`-th entry (1-based, newest first) at the end of its kind. */
export const restore = (list: TodoList, index: number, now: number): Changed | Failure => {
  const entry = list.trash[index - 1]
  if (!entry) return { error: 'not-found' }
  if (list.entries.length >= MAX_ENTRIES) return { error: 'full' }
  const text = normalise(entry.text)

  return changed(list, [...list.entries, entry], entry, now, {
    trash: list.trash.filter((_, i) => i !== index - 1),
    removed: list.removed.filter(r => r !== text),
  })
}

/** Empties the trash; every text in it now counts as removed by the user. */
export const emptyTrash = (list: TodoList, now: number): TodoList =>
  list.trash.length === 0
    ? list
    : { ...list, trash: [], removed: remember(list.removed, list.trash.map(e => normalise(e.text))), touched: now }
