import type { SessionUsage } from 'claude-code'

// From here a figure is drawn as a warning, and from ALERT as an alert. The 7-day window shows only
// from WARN on: below it, it says nothing the 5-hour window does not.
export const WARN = 75
export const ALERT = 90

// The cells of a figure's bar: each one a fifth of the window.
const CELLS = 5

type Tone = 'ok' | 'warn' | 'alert'

export type Reading = { text: string; parts: { text: string; tone: Tone | 'dim' }[]; detail: string; tone: Tone }

// The context's fill, a whole percentage; undefined before the first response has reported one.
const contextPercent = ({ context }: SessionUsage): number | undefined => {
  const tokens = context.tokens ?? 0
  if (tokens <= 0 || !(context.window > 0)) return undefined

  return Math.round(context.percent ?? (tokens / context.window) * 100)
}

const windowPercent = ({ rateLimits }: SessionUsage, kind: string): number | undefined => {
  const limit = rateLimits.find(one => one.kind === kind)

  return limit === undefined ? undefined : Math.round(limit.percentUsed)
}

const toneOf = (percent: number): Tone => (percent >= ALERT ? 'alert' : percent >= WARN ? 'warn' : 'ok')

// A figure's fill in five cells, to the nearest fifth.
const bar = (percent: number): string => {
  const filled = Math.min(CELLS, Math.max(0, Math.round(percent / (100 / CELLS))))

  return '▰'.repeat(filled) + '▱'.repeat(CELLS - filled)
}

/**
 * The compact line the band shows: a bar a figure, `ctx ▰▰▰▱▱  5h ▰▰▱▱▱`, the week joining once it
 * runs short. A figure from 75 % adds its percentage, as it needs attention. The labels draw dim,
 * each bar and percentage in its own figure's tone; the segment's tone follows the fullest figure.
 * The detail holds every percentage: `ctx 67% · 5h 42%`. Undefined while there is nothing to show.
 */
export const reading = (usage: SessionUsage): Reading | undefined => {
  const week = windowPercent(usage, 'seven_day')
  const figures = [
    { label: 'ctx', percent: contextPercent(usage) },
    { label: '5h', percent: windowPercent(usage, 'five_hour') },
    { label: '7d', percent: week !== undefined && week >= WARN ? week : undefined },
  ].filter((one): one is { label: string; percent: number } => one.percent !== undefined)
  if (figures.length === 0) return undefined

  const parts = figures.flatMap(({ label, percent }, at) => [
    { text: `${at > 0 ? '  ' : ''}${label} `, tone: 'dim' as const },
    { text: percent >= WARN ? `${bar(percent)} ${percent}%` : bar(percent), tone: toneOf(percent) },
  ])

  return {
    text: parts.map(part => part.text).join(''),
    parts,
    detail: figures.map(one => `${one.label} ${one.percent}%`).join(' · '),
    tone: toneOf(Math.max(...figures.map(one => one.percent))),
  }
}
