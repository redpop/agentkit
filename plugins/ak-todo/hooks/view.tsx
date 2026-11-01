import type { EngineInterface } from 'claude-code'

import type { Lang } from './i18n'
import { texts } from './i18n'
import { clean, numbered } from './list'
import type { TodoList } from './list'
import type { Settings } from './store'

export type Segment = NonNullable<Parameters<EngineInterface['mods']['segment']>[0]>

// The band shows the first open task up to this many characters.
const FIRST_MAX = 40

const cut = (raw: string): string => {
  const text = clean(raw)

  return Array.from(text).length > FIRST_MAX ? Array.from(text).slice(0, FIRST_MAX - 1).join('') + '…' : text
}

/**
 * The mod's part of the shared band: open tasks and the first of them, notes counted, and the
 * detection settings for the Mods pane; none for an empty list.
 */
export const segmentOf = (list: TodoList, lang: Lang, settings: Settings): Segment | undefined => {
  const t = texts(lang)
  const { tasks, notes } = numbered(list)
  if (tasks.length + notes.length === 0) return undefined
  const open = tasks.filter(n => n.entry.status !== 'done' && n.entry.isDeferred !== true)
  const head = open.length > 0 ? `${t.open(open.length)} · ${cut(open[0]!.entry.text)}` : tasks.length > 0 ? t.allDone : ''
  const text = [head, notes.length > 0 ? t.notes(notes.length) : ''].filter(Boolean).join(' · ')

  return {
    text,
    tone: 'ok',
    button: { label: t.show, command: 'todo', isOnText: true },
    settings: {
      command: 'todo',
      rows: [
        { key: 'detect', label: t.detectSetting, value: settings.detect ? 'on' : 'off', options: [{ value: 'on', label: t.on }, { value: 'off', label: t.off }] },
        { key: 'model', label: t.modelSetting, value: settings.model, options: [{ value: 'haiku' }, { value: 'sonnet' }] },
      ],
    },
  }
}
