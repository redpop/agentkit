import type { EngineInterface } from 'claude-code'

import type { Lang } from './i18n'
import { texts } from './i18n'
import { numbered } from './list'
import type { TodoList } from './list'
import type { Settings } from './store'

export type Segment = NonNullable<Parameters<EngineInterface['mods']['segment']>[0]>

type Part = NonNullable<Segment['parts']>[number]

// Between the tasks and the notes on the desktop app: an em space, wider than a plain one and kept.
const GROUP_SPACE = '\u2003'

/**
 * The mod's part of the shared band, read as the other mods' are: an icon, a figure and its dim
 * label, once for the tasks and once for the notes (`✓ 5 open  ✎ 4 notes`). The task figure counts
 * the open ones; with none open, what waits for later, then what is done. Short of room, the icons
 * and the figures. No card: the segment's text opens the pane, which shows it all. An empty list's
 * segment is the Mods pane's alone, so its card keeps the button to the pane and the settings.
 */
export const segmentOf = (list: TodoList, lang: Lang, settings: Settings): Segment => {
  const t = texts(lang)
  const { tasks, notes } = numbered(list)
  const button = { label: t.show, command: 'todo', args: 'show', isOnText: true }
  const settingRows = {
    command: 'todo',
    rows: [
      { key: 'detect', label: t.detectSetting, value: settings.detect ? 'on' : 'off', options: [{ value: 'on', label: t.on }, { value: 'off', label: t.off }] },
      { key: 'model', label: t.modelSetting, value: settings.model, options: [{ value: 'haiku' }, { value: 'sonnet' }] },
    ],
  }
  // Empty, the band shows nothing, and the Mods card still holds the way in and the settings.
  if (tasks.length + notes.length === 0) return { text: t.emptySegment, tone: 'dim', isPaneOnly: true, button, settings: settingRows }
  const open = tasks.filter(n => n.entry.status !== 'done' && n.entry.isDeferred !== true)
  const later = tasks.filter(n => n.entry.status !== 'done' && n.entry.isDeferred === true)
  const done = tasks.filter(n => n.entry.status === 'done')
  const [count, label] = open.length > 0 ? [open.length, t.openWord] : later.length > 0 ? [later.length, t.laterWord] : [done.length, t.doneWord]
  // Each group a figure and its dim label. On the desktop app an em space parts them, which the band
  // does not squeeze as it does plain spaces; dim, it is a run of its own and not part of the
  // pressed figure before it, whose button would grow by it. The terminal parts them by a dim dot. An icon run's text is what a reader gets in its place, and what
  // an ak-mods without the icon draws.
  const groups: { icon: 'tasks' | 'note'; glyph: string; figure: number; label: string }[] = [
    ...(tasks.length > 0 ? [{ icon: 'tasks' as const, glyph: '✓', figure: count, label }] : []),
    ...(notes.length > 0 ? [{ icon: 'note' as const, glyph: '✎', figure: notes.length, label: t.noteWord(notes.length) }] : []),
  ]
  const parts: Part[] = groups.flatMap((group, i): Part[] => [
    ...(i > 0 ? [{ text: ' · ', tone: 'dim' as const }] : []),
    { text: String(group.figure) },
    { text: ` ${group.label}`, tone: 'dim' },
  ])
  const rich: Part[] = groups.flatMap((group, i): Part[] => [
    ...(i > 0 ? [{ text: GROUP_SPACE, tone: 'dim' as const }] : []),
    { text: group.glyph, icon: group.icon },
    { text: ` ${group.figure}` },
    { text: ` ${group.label}`, tone: 'dim' },
  ])
  const short: Part[] = groups.flatMap((group, i): Part[] => [
    ...(i > 0 ? [{ text: ' · ', tone: 'dim' as const }] : []),
    { text: `${group.glyph}${group.figure}` },
  ])
  const shortRich: Part[] = groups.flatMap((group, i): Part[] => [
    ...(i > 0 ? [{ text: GROUP_SPACE, tone: 'dim' as const }] : []),
    { text: group.glyph, icon: group.icon },
    { text: ` ${group.figure}` },
  ])
  const join = (runs: Part[]) => runs.map(run => run.text).join('')

  return {
    text: join(parts),
    parts,
    rich,
    compact: { text: join(short), parts: short, rich: shortRich },
    tone: 'ok',
    priority: 3,
    button,
    settings: settingRows,
  }
}
