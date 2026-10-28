import type { SessionUsage } from 'claude-code'

// From here a figure is drawn as a warning, and from ALERT as an alert. The 7-day window shows only
// from WARN on: below it, it says nothing the 5-hour window does not.
export const WARN = 75
export const ALERT = 90

export type Reading = { text: string; tone: 'ok' | 'warn' | 'alert' }

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

/**
 * The compact line the band shows: `ctx 67% · 5h 42%`, and `· 7d 81%` once the week runs short.
 * Its tone follows the fullest figure shown. Undefined while there is nothing to show.
 */
export const reading = (usage: SessionUsage): Reading | undefined => {
  const week = windowPercent(usage, 'seven_day')
  const figures = [
    { label: 'ctx', percent: contextPercent(usage) },
    { label: '5h', percent: windowPercent(usage, 'five_hour') },
    { label: '7d', percent: week !== undefined && week >= WARN ? week : undefined },
  ].filter((one): one is { label: string; percent: number } => one.percent !== undefined)
  if (figures.length === 0) return undefined

  const top = Math.max(...figures.map(one => one.percent))
  const tone = top >= ALERT ? 'alert' : top >= WARN ? 'warn' : 'ok'

  return { text: figures.map(one => `${one.label} ${one.percent}%`).join(' · '), tone }
}
