import type { SessionRateLimit, SessionUsage } from 'claude-code'

import { texts, type Lang } from './i18n'

// From here a figure is drawn as a warning, and from ALERT as an alert. The 7-day window shows only
// from WARN on: below it, it says nothing the 5-hour window does not.
export const WARN = 75
export const ALERT = 90

// The cells of a figure's bar: each one a fifth of the window. Filled and empty cells are the same
// glyph, the empty ones dim, so the bar reads as one line in any font. One cell wide.
const CELLS = 5
const CELL = '▬'

// The rate-limit windows a reading names, by the band's label; their titles are the language's.
const WINDOWS = [
  { kind: 'five_hour', label: '5h' },
  { kind: 'seven_day', label: '7d' },
] as const

type Tone = 'ok' | 'warn' | 'alert'

type Part = { text: string; tone: Tone | 'dim'; ring?: number }

type Row = { label: string; value: string }

export type Reading = { text: string; parts: Part[]; rich: Part[]; compact: { text: string; parts: Part[]; rich: Part[] }; detail: string; card: Row[]; tone: Tone }

// A window at 90 % or more: `key` names it until it resets, `text` is the toast.
export type Alert = { key: string; text: string }

type Figure = { label: string; percent: number; resetsAt?: number }

// The context's fill, a whole percentage; undefined before the first response has reported one.
const contextPercent = ({ context }: SessionUsage): number | undefined => {
  const tokens = context.tokens ?? 0
  if (tokens <= 0 || !(context.window > 0)) return undefined

  return Math.round(context.percent ?? (tokens / context.window) * 100)
}

const resetOf = ({ resetsAt }: SessionRateLimit): number | undefined => {
  const at = resetsAt === undefined ? NaN : Date.parse(resetsAt)

  return Number.isFinite(at) ? at : undefined
}

// A window as the last response reported it; undefined once its reset has passed, as its figure
// then counts a window that is over. It returns with the next response.
const windowOf = (rateLimits: readonly SessionRateLimit[], kind: string, now: number): SessionRateLimit | undefined => {
  const limit = rateLimits.find(one => one.kind === kind)
  const resetsAt = limit === undefined ? undefined : resetOf(limit)

  return resetsAt !== undefined && resetsAt <= now ? undefined : limit
}

// A token count, short: `680k`, `1M`, `1.2M`.
const tokens = (count: number): string => {
  const short = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

  return count >= 1e6 ? `${short(Math.round(count / 1e5) / 10)}M` : count >= 1e3 ? `${Math.round(count / 1e3)}k` : String(count)
}

const toneOf = (percent: number): Tone => (percent >= ALERT ? 'alert' : percent >= WARN ? 'warn' : 'ok')

// The local time of a reset in the language's clock, `11:10pm` or `23:10`, with its weekday when it
// falls on another day: `Sat 10:00am`, `Sa 10:00`.
export const resetClock = (at: number, now: number, lang: Lang = 'en'): string => {
  const t = texts(lang)
  const day = new Date(at)
  const time = t.time(day.getHours(), day.getMinutes())

  return day.toDateString() === new Date(now).toDateString() ? time : `${t.days[day.getDay()]} ${time}`
}

// A figure's fill in five cells, to the nearest fifth, and one cell at least once anything is used:
// the filled run in its tone, the rest dim.
const bar = (percent: number): Part[] => {
  const nearest = Math.min(CELLS, Math.max(0, Math.round(percent / (100 / CELLS))))
  const filled = percent > 0 ? Math.max(1, nearest) : 0

  return [
    { text: CELL.repeat(filled), tone: toneOf(percent) },
    { text: CELL.repeat(CELLS - filled), tone: 'dim' },
  ]
}

const figuresOf = (usage: SessionUsage, now: number): Figure[] => {
  const context = contextPercent(usage)
  const windows = WINDOWS.map(({ kind, label }): Figure | undefined => {
    const limit = windowOf(usage.rateLimits, kind, now)
    if (limit === undefined) return undefined
    const percent = Math.round(limit.percentUsed)
    if (kind === 'seven_day' && percent < WARN) return undefined

    return { label, percent, resetsAt: resetOf(limit) }
  })

  return [context === undefined ? undefined : { label: 'ctx', percent: context }, ...windows].filter(
    (one): one is Figure => one !== undefined,
  )
}

/**
 * The compact line the band shows: a bar a figure, `ctx ▬▬▬▬▬  5h ▬▬▬▬▬`, the week joining once it
 * runs short. A figure from 75 % adds its percentage, and a window its reset, as it needs attention:
 * `5h ▬▬▬▬▬ 81%  resets 11:10pm`. Only the parts tell the fill: the labels, a bar's empty cells and
 * the reset draw dim, its filled cells and percentage in its own figure's tone; the segment's tone
 * follows the fullest figure. A window whose reset has passed is left out until the next response
 * reports it again. The detail holds every percentage and reset: `ctx 67% · 5h 42% (resets 11:10pm)`.
 * Where the band draws pictures, the rich runs show each figure as its label, then a ring with its
 * percentage. Undefined while there is nothing to show.
 */
export const reading = (usage: SessionUsage, now: number, lang: Lang = 'en'): Reading | undefined => {
  const figures = figuresOf(usage, now)
  if (figures.length === 0) return undefined

  const t = texts(lang)
  const reset = (resetsAt: number | undefined) => (resetsAt === undefined ? '' : t.resets(resetClock(resetsAt, now, lang)))
  const parts = figures
    .flatMap(({ label, percent, resetsAt }, at): Part[] => {
      const isShort = percent >= WARN

      return [
        { text: `${at > 0 ? '  ' : ''}${label} `, tone: 'dim' },
        ...bar(percent),
        { text: isShort ? ` ${percent}%` : '', tone: toneOf(percent) },
        { text: isShort && resetsAt !== undefined ? `  ${reset(resetsAt)}` : '', tone: 'dim' },
      ]
    })
    .filter(part => part.text !== '')

  // Where the band draws pictures, each figure is its label, then a ring with its percentage:
  // `5h ◔ 42%`, as the terminal leads with the label. A label after its value sat as near the next
  // ring as its own. Rings and percentages in the figure's tone, labels and resets dim.
  const rich = figures.flatMap(({ label, percent, resetsAt }, at): Part[] => [
    { text: `${at > 0 ? '    ' : ''}${label} `, tone: 'dim' },
    { text: `${label} ${percent}%`, tone: toneOf(percent), ring: percent },
    { text: `${percent}%`, tone: toneOf(percent) },
    ...(percent >= WARN && resetsAt !== undefined ? [{ text: `  ${reset(resetsAt)}`, tone: 'dim' as const }] : []),
  ])

  // Where the band is short of room, each figure's label and percentage: `ctx 67%  5h 2%`, and on
  // the desktop app its label, ring and percentage: `ctx ◔ 67%`. No bars, no resets.
  const compactParts = figures.flatMap(({ label, percent }, at): Part[] => [
    { text: `${at > 0 ? '  ' : ''}${label} `, tone: 'dim' },
    { text: `${percent}%`, tone: toneOf(percent) },
  ])
  const compact = {
    text: compactParts.map(part => part.text).join(''),
    parts: compactParts,
    rich: figures.flatMap(({ label, percent }, at): Part[] => [
      // As wide a gap as the full form's, so the figures stay apart.
      { text: `${at > 0 ? '    ' : ''}${label} `, tone: 'dim' as const },
      { text: `${label} ${percent}%`, tone: toneOf(percent), ring: percent },
      { text: `${percent}%`, tone: toneOf(percent) },
    ]),
  }

  // The card in the Mods pane has the room for every window, the week below 75 % too, each with its reset.
  const context = contextPercent(usage)
  const card: Row[] = [
    ...(context === undefined
      ? []
      : [{ label: t.context, value: `${context}% · ${t.ofTokens(tokens(usage.context.tokens ?? 0), tokens(usage.context.window))}` }]),
    ...WINDOWS.flatMap(({ kind }) => {
      const limit = windowOf(usage.rateLimits, kind, now)
      if (limit === undefined) return []
      const resetsAt = resetOf(limit)
      const value = `${Math.round(limit.percentUsed)}%${resetsAt === undefined ? '' : ` · ${reset(resetsAt)}`}`

      return [{ label: t.windows[kind] ?? kind, value }]
    }),
  ]

  return {
    text: parts.map(part => part.text).join(''),
    parts,
    rich,
    compact,
    card,
    detail: figures
      .map(({ label, percent, resetsAt }) => `${label} ${percent}%${resetsAt === undefined ? '' : ` (${reset(resetsAt)})`}`)
      .join(' · '),
    tone: toneOf(Math.max(...figures.map(one => one.percent))),
  }
}

/** The earliest reset still ahead among the windows a reading shows: there the reading changes. */
export const nextReset = (usage: SessionUsage, now: number): number | undefined => {
  const ahead = figuresOf(usage, now).flatMap(one => (one.resetsAt === undefined ? [] : [one.resetsAt]))

  return ahead.length === 0 ? undefined : Math.min(...ahead)
}

/** The rate-limit windows at 90 % or more: `5-hour limit at 92 %, resets 11:10pm`. */
export const alerts = (rateLimits: readonly SessionRateLimit[], now: number, lang: Lang = 'en'): Alert[] =>
  WINDOWS.flatMap(({ kind }) => {
    const limit = windowOf(rateLimits, kind, now)
    if (limit === undefined || Math.round(limit.percentUsed) < ALERT) return []
    const t = texts(lang)
    const resetsAt = resetOf(limit)
    const reset = resetsAt === undefined ? '' : t.resets(resetClock(resetsAt, now, lang))

    return [{ key: `${kind}@${limit.resetsAt ?? ''}`, text: t.alert(t.windows[kind] ?? kind, Math.round(limit.percentUsed), reset) }]
  })
