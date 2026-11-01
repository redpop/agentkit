import type { Lang } from './i18n'
import { texts } from './i18n'
import { add, clearDone, move, numbered, remove, resolve, restore, update } from './list'
import type { Changed, Entry, Failure, Kind, TodoList } from './list'

/** What `/todo` or `/note` was asked to do. */
export type Cmd =
  | { kind: 'toggle' }
  | { kind: 'add'; entry: Kind; text: string }
  | { kind: 'sel'; entry: Kind }
  | { kind: 'done' | 'undo' | 'rm' | 'later'; ref: string }
  | { kind: 'move'; ref: string; to: number }
  | { kind: 'edit' | 'ask'; ref: string; text: string }
  | { kind: 'trash' }
  | { kind: 'restore'; index: number }
  | { kind: 'clear-done' }
  | { kind: 'detect'; isOn: boolean }
  | { kind: 'model'; alias: string }
  | { kind: 'bad-model'; alias: string }
  | { kind: 'not-found'; ref: string }

/** A command's outcome: the changed list and the hidden line for Claude, or only a reply. */
export type Applied = { list: TodoList; reply: string; note?: string } | { reply: string }

const REF = /^[tn]?[1-9]\d*$/i
// What reads as a number but names no entry: `0`, `-1`, `T0`.
const NUMBERISH = /^[tn]?-?\d+$/i
const COUNT = /^[1-9]\d*$/
// The models the detection pass may use.
const MODELS = /^(haiku|sonnet)$/i

/**
 * The first word is a subcommand only when its arguments parse; otherwise the whole argument string
 * is the text of a new entry, so `/todo done the docs` adds a task.
 */
export const parseCommand = (command: 'todo' | 'note', args: string): Cmd => {
  const entry: Kind = command === 'note' ? 'note' : 'task'
  const text = args.trim()
  if (text === '') return { kind: 'toggle' }
  const [word = '', ...rest] = text.split(/\s+/)
  const sub = word.toLowerCase()
  const [first = '', second = ''] = rest
  const tail = text.slice(word.length).trim().slice(first.length).trim()

  if (rest.length === 0) {
    if (sub === 'sel') return { kind: 'sel', entry }
    if (sub === 'trash') return { kind: 'trash' }
  }
  // A subcommand with its arguments in place but a number that names nothing answers so, and adds
  // nothing: `/todo done 0`.
  const isOne = rest.length === 1 && ['done', 'undo', 'rm', 'later', 'restore'].includes(sub)
  const isTwo = (rest.length === 2 && sub === 'move') || (rest.length >= 2 && (sub === 'edit' || sub === 'ask'))
  if ((isOne || isTwo) && NUMBERISH.test(first) && !(sub === 'restore' ? COUNT : REF).test(first)) return { kind: 'not-found', ref: first }
  if (rest.length === 2 && sub === 'move' && REF.test(first) && NUMBERISH.test(second) && !COUNT.test(second)) return { kind: 'not-found', ref: second }
  if (rest.length === 1) {
    if ((sub === 'done' || sub === 'undo' || sub === 'rm' || sub === 'later') && REF.test(first)) return { kind: sub, ref: first }
    if (sub === 'restore' && COUNT.test(first)) return { kind: 'restore', index: Number(first) }
    if (sub === 'clear' && first.toLowerCase() === 'done') return { kind: 'clear-done' }
    if (sub === 'detect' && /^(on|off)$/i.test(first)) return { kind: 'detect', isOn: first.toLowerCase() === 'on' }
    if (sub === 'model' && MODELS.test(first)) return { kind: 'model', alias: first.toLowerCase() }
    if (sub === 'model' && /^[a-z][\w.-]*$/i.test(first)) return { kind: 'bad-model', alias: first }
  }
  if (rest.length === 2 && sub === 'move' && REF.test(first) && COUNT.test(second)) return { kind: 'move', ref: first, to: Number(second) }
  if (rest.length >= 2 && (sub === 'edit' || sub === 'ask') && REF.test(first)) return { kind: sub, ref: first, text: tail }

  return { kind: 'add', entry, text }
}

// The number the entry has in `list` now.
const refOf = (list: TodoList, entry: Entry): string => {
  const { tasks, notes } = numbered(list)

  return [...tasks, ...notes].find(n => n.entry.id === entry.id)?.ref ?? ''
}

/**
 * Applies a command that changes the list. `toggle`, `sel`, `trash`, `ask`, `detect`, `model` and
 * `bad-model` are the
 * caller's: they come back with the list unchanged and no reply.
 */
export const applyCommand = (list: TodoList, cmd: Cmd, now: number, lang: Lang): Applied => {
  const t = texts(lang)
  const failed = (failure: Failure, ref = ''): Applied => ({
    reply: failure.error === 'empty' ? t.empty : failure.error === 'full' ? t.full : failure.error === 'not-a-task' ? t.notATask(ref) : t.notFound(ref),
  })
  // A changed entry is echoed with its new number; the hidden line tells Claude what the person did.
  const echo = (result: Changed | Failure, reply: (ref: string, text: string) => string, what: string, ref = ''): Applied => {
    if ('error' in result) return failed(result, ref)
    const current = refOf(result.list, result.entry)

    return { list: result.list, reply: reply(current || ref, result.entry.text), note: `${what} (id ${result.entry.id}): ${result.entry.text}` }
  }

  switch (cmd.kind) {
    case 'not-found':
      return { reply: t.notFound(cmd.ref.toUpperCase()) }
    case 'add':
      return echo(add(list, { kind: cmd.entry, text: cmd.text, owner: 'user' }, now), t.added, `The person added a ${cmd.entry}`)
    case 'restore': {
      const result = restore(list, cmd.index, now)
      if ('error' in result && result.error === 'not-found') return { reply: t.notInTrash(cmd.index) }

      return echo(result, t.restored, 'The person restored from the trash')
    }
    case 'clear-done': {
      const cleared = clearDone(list, now)
      const n = list.entries.length - cleared.entries.length

      return n === 0 ? { reply: t.cleared(0) } : { list: cleared, reply: t.cleared(n), note: `The person cleared ${n} done task(s).` }
    }
    case 'done':
    case 'undo':
    case 'rm':
    case 'later':
    case 'move':
    case 'edit': {
      const entry = resolve(list, cmd.ref)
      const ref = cmd.ref.toUpperCase().replace(/^(\d)/, 'T$1')
      if (!entry) return { reply: t.notFound(ref) }
      if (cmd.kind === 'done') return echo(update(list, entry.id, { status: 'done' }, now), t.done, 'The person marked a task done', ref)
      if (cmd.kind === 'undo') return echo(update(list, entry.id, { status: 'open' }, now), t.undone, 'The person reopened a task', ref)
      if (cmd.kind === 'later') {
        const isDeferred = entry.isDeferred !== true

        return echo(update(list, entry.id, { isDeferred }, now), isDeferred ? t.later : t.back, isDeferred ? 'The person deferred a task' : 'The person brought a task back', ref)
      }
      if (cmd.kind === 'move') return echo(move(list, entry.id, cmd.to, now), t.moved, 'The person moved an entry', ref)
      if (cmd.kind === 'edit') return echo(update(list, entry.id, { text: cmd.text }, now), t.edited, 'The person changed an entry', ref)
      const result = remove(list, entry.id, 'user', now)
      if ('error' in result) return failed(result, ref)

      return { list: result.list, reply: t.removedEntry(ref, entry.text), note: `The person removed (id ${entry.id}): ${entry.text}. Do not add it again.` }
    }
    default:
      return { reply: '' }
  }
}
