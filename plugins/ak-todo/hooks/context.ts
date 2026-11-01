import { numbered } from './list'
import type { Numbered, TodoList } from './list'

/** The id of the system-prompt section. */
export const SECTION_ID = 'ak-todo:list'

/** The system-prompt instruction: short, as it rides on every request. */
export const SECTION = [
  'This session has a list of tasks and notes (ak-todo); it arrives with each prompt, with ids.',
  'Notes are context to keep in mind.',
  'When you set something aside, add it as a task with the todo tool.',
  'Do not interrupt your current work for a new entry.',
  'When a piece of work is done and tasks are open, name them and ask whether to continue.',
  'Start a task only when the user asks.',
  "Never remove the user's entries, and never add again what the user removed.",
].join(' ')

const line = ({ ref, entry }: Numbered): string => {
  const marks = entry.kind === 'note' ? ['note'] : [entry.status ?? 'open', ...(entry.isDeferred ? ['deferred'] : [])]

  return `[${ref} id=${entry.id} ${marks.join(', ')}, ${entry.owner}] ${entry.text}`
}

/** The list as Claude reads it, one line per entry; nothing for an empty list. */
export const listContext = (list: TodoList): string | undefined => {
  const { tasks, notes } = numbered(list)
  if (tasks.length + notes.length === 0) return undefined

  return ['Session list (ak-todo):', ...tasks.map(line), ...notes.map(line)].join('\n')
}

/** The person's changes since Claude's last turn, as one block; nothing when there are none. */
export const joinNotes = (notes: readonly string[]): string | undefined =>
  notes.length === 0 ? undefined : ['Changed by the user since your last turn:', ...notes.map(n => `- ${n}`)].join('\n')

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
