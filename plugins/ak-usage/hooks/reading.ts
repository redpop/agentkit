import type { SessionRateLimit, SessionUsage } from 'claude-code'

// From here a figure is drawn as a warning, and from ALERT as an alert. The 7-day window shows only
// from WARN on: below it, it says nothing the 5-hour window does not.
export const WARN = 75
export const ALERT = 90

// The cells of a figure's bar: each one a fifth of the window. Filled and empty cells are the same
// glyph, the empty ones dim, so the bar reads as one line in any font. One cell wide.
const CELLS = 5
const CELL = '▬'

// The rate-limit windows a reading names: the band's label, the toast's title.
const WINDOWS = [
  { kind: 'five_hour', label: '5h', title: '5-hour limit' },
  { kind: 'seven_day', label: '7d', title: '7-day limit' },
] as const

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Tone = 'ok' | 'warn' | 'alert'

type Part = { text: string; tone: Tone | 'dim' }

export type Reading = { text: string; parts: Part[]; detail: string; tone: Tone }

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

const toneOf = (percent: number): Tone => (percent >= ALERT ? 'alert' : percent >= WARN ? 'warn' : 'ok')

// The local time of a reset, `11:10pm`, with its weekday when it falls on another day: `Sat 10:00am`.
export const resetClock = (at: number, now: number): string => {
  const day = new Date(at)
  const h = day.getHours()
  const time = (h % 12 || 12) + ':' + String(day.getMinutes()).padStart(2, '0') + (h >= 12 ? 'pm' : 'am')

  return day.toDateString() === new Date(now).toDateString() ? time : `${DAYS[day.getDay()]} ${time}`
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
 * Undefined while there is nothing to show.
 */
export const reading = (usage: SessionUsage, now: number): Reading | undefined => {
  const figures = figuresOf(usage, now)
  if (figures.length === 0) return undefined

  const reset = (resetsAt: number | undefined) => (resetsAt === undefined ? '' : `resets ${resetClock(resetsAt, now)}`)
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

  return {
    text: parts.map(part => part.text).join(''),
    parts,
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
export const alerts = (rateLimits: readonly SessionRateLimit[], now: number): Alert[] =>
  WINDOWS.flatMap(({ kind, title }) => {
    const limit = windowOf(rateLimits, kind, now)
    if (limit === undefined || Math.round(limit.percentUsed) < ALERT) return []
    const resetsAt = resetOf(limit)
    const reset = resetsAt === undefined ? '' : `, resets ${resetClock(resetsAt, now)}`

    return [{ key: `${kind}@${limit.resetsAt ?? ''}`, text: `${title} at ${Math.round(limit.percentUsed)} %${reset}` }]
  })
