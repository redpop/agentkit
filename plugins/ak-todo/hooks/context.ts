import { numbered } from './list'
import type { Numbered, TodoList } from './list'

const line = ({ ref, entry }: Numbered): string => {
  const marks = entry.kind === 'note' ? ['note'] : [entry.status ?? 'open', ...(entry.isDeferred ? ['deferred'] : [])]

  return `[${ref} id=${entry.id} ${marks.join(', ')}, ${entry.owner}] ${entry.text}`
}

/** The list as Claude reads it, one line per entry; nothing for an empty list. */
export const listContext = (list: TodoList): string | undefined => {
  const { tasks, notes } = numbered(list)
  if (tasks.length + notes.length === 0) return undefined

  return ['Session list (ak-todo) — reference only: start a task only when the user asks; do not interrupt current work for a new entry; add work you set aside as a task with the todo tool; when a piece of work is done and tasks are open, name them and ask whether to continue:', ...tasks.map(line), ...notes.map(line)].join('\n')
}

/** What an empty list sends instead: the one rule that still applies. */
export const EMPTY_CONTEXT = 'Session list (ak-todo) is empty: add work you set aside as a task with the todo tool.'

/** The person's changes since Claude's last turn, as one block; nothing when there are none. */
export const joinNotes = (notes: readonly string[]): string | undefined =>
  notes.length === 0 ? undefined : ['List changes by the user (for reference, not a request):', ...notes.map(n => `- ${n}`)].join('\n')

/**
 * The change notes still to send, once a prompt carried `sent`: what was added after it went. The
 * queue keeps its last 20, so the oldest sent may be gone already; and a conversation that moved on
 * holds notes of its own, which match nothing sent.
 */
export const unsent = (current: readonly string[], sent: readonly string[]): string[] => {
  for (let k = Math.min(sent.length, current.length); k > 0; k--) {
    if (current.slice(0, k).every((note, i) => note === sent[sent.length - k + i])) return current.slice(k)
  }

  return [...current]
}
