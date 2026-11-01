import type { ToolSpec } from 'claude-code'

import { listContext } from './context'
import { add, move, numbered, remove, update } from './list'
import type { Changed, Entry, Failure, Kind, Status, TodoList } from './list'

/** What the model may send; `applyTool` checks every field itself. */
export type ToolInput = {
  action: 'list' | 'add' | 'update' | 'done' | 'remove' | 'move'
  kind?: Kind
  text?: string
  id?: number
  status?: Status
  deferred?: boolean
  to?: number
}

const ACTIONS = ['list', 'add', 'update', 'done', 'remove', 'move'] as const

export const TOOL: ToolSpec = {
  name: 'todo',
  description:
    "Reads and changes this session's list of tasks and notes (ak-todo). Address entries by the id " +
    'shown in the list you receive each turn. Notes are context to keep in mind. You may add entries ' +
    "and change the user's (text, status, deferred, order) but not remove them: ask the user instead. " +
    'You cannot add again what the user removed.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: [...ACTIONS] },
      kind: { type: 'string', enum: ['task', 'note'], description: 'For add; default task.' },
      text: { type: 'string', description: 'For add, or a new text for update.' },
      id: { type: 'integer', description: 'The entry, for update, done, remove and move.' },
      status: { type: 'string', enum: ['open', 'doing', 'done'], description: 'For update, tasks only.' },
      deferred: { type: 'boolean', description: 'For update, tasks only: set aside for later.' },
      to: { type: 'integer', minimum: 1, description: 'For move: the 1-based position among entries of its kind.' },
    },
    required: ['action'],
  },
  isDeferred: false,
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const refOf = (list: TodoList, entry: Entry): string =>
  [...numbered(list).tasks, ...numbered(list).notes].find(n => n.entry.id === entry.id)?.ref ?? `id ${entry.id}`

const REASONS: Record<Failure['error'], string> = {
  empty: 'The text is empty.',
  full: 'The list is full (100 entries).',
  removed: 'The user removed this entry earlier. Do not add it again.',
  'not-found': 'No entry with that id. Use the ids from the list.',
  'not-a-task': 'That entry is a note: status and deferred apply to tasks only.',
  'owned-by-user': 'That entry belongs to the user. Ask them before removing it.',
}

const answer = (list: TodoList, result: Changed | Failure, verb: string): { list?: TodoList; text: string } => {
  if ('error' in result) return { text: REASONS[result.error] }

  return { list: result.list, text: `${verb}: ${refOf(result.list, result.entry)} id=${result.entry.id}.\n${listContext(result.list) ?? 'The session list is empty.'}` }
}

/** Applies a call of the tool to the list; `list` is set only when it changed. */
export const applyTool = (list: TodoList, input: unknown, now: number): { list?: TodoList; text: string } => {
  if (!isRecord(input) || !ACTIONS.includes(input.action as never)) return { text: `Unknown action: give action as one of ${ACTIONS.join(', ')}.` }
  const action = input.action as ToolInput['action']
  if (action === 'list') return { text: listContext(list) ?? 'The session list is empty.' }
  if (action === 'add') {
    if (typeof input.text !== 'string') return { text: 'add needs a text.' }
    const kind: Kind = input.kind === 'note' ? 'note' : 'task'

    return answer(list, add(list, { kind, text: input.text, owner: 'claude' }, now), 'Added')
  }
  if (typeof input.id !== 'number' || !Number.isInteger(input.id)) return { text: `${action} needs the entry's id.` }
  const id = input.id
  if (action === 'done') return answer(list, update(list, id, { status: 'done' }, now, 'claude'), 'Done')
  if (action === 'move') {
    if (typeof input.to !== 'number' || !Number.isInteger(input.to) || input.to < 1) return { text: 'move needs to, a position from 1.' }

    return answer(list, move(list, id, input.to, now), 'Moved')
  }
  if (action === 'remove') {
    const entry = list.entries.find(e => e.id === id)
    const result = remove(list, id, 'claude', now)
    if ('error' in result && result.error === 'owned-by-user' && entry) return { text: `${refOf(list, entry)} belongs to the user. Ask them before removing it.` }

    return answer(list, result, 'Removed')
  }
  const patch: { text?: string; status?: Status; isDeferred?: boolean } = {}
  if (typeof input.text === 'string') patch.text = input.text
  if (input.status === 'open' || input.status === 'doing' || input.status === 'done') patch.status = input.status
  if (typeof input.deferred === 'boolean') patch.isDeferred = input.deferred
  if (Object.keys(patch).length === 0) return { text: 'update needs text, status or deferred.' }

  return answer(list, update(list, id, patch, now, 'claude'), 'Updated')
}
