// How the block reads: the segment in the band, the card in the Mods pane, and the two hints.

import type { EngineInterface } from 'claude-code'

import type { Block, Limits } from './block'
import { BREAK_MINUTES, BREAK_MS, DEFAULT_LIMITS, WORK_MINUTES, WORK_MS, dateOf, isIdle, isLate, isWaterDue, notifyAtMs, workedMs } from './block'
import type { Lang } from './i18n'
import { texts } from './i18n'

/** What ak-mods draws in the band for the mod. */
export type Segment = NonNullable<Parameters<EngineInterface['mods']['segment']>[0]>
type Part = NonNullable<Segment['parts']>[number]
type Tone = NonNullable<Segment['tone']>
type CardRow = NonNullable<Segment['card']>[number]
type Settings = NonNullable<Segment['settings']>

/** The command the water button runs. */
export const DRINK = 'pause-drink'

/** The command that sets the block and break lengths: `work <minutes>` or `break <minutes>`. */
export const SET = 'pause-set'

// Below ak-usage (7): the break yields first when the band runs short.
const PRIORITY = 4

/** A span of time: `23 min` below an hour, `1 h 05` from it. */
export function durationText(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  if (minutes < 60) return `${minutes} min`

  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/** The local time of `ms`, as the language writes it. */
export function clockText(ms: number, lang: Lang): string {
  const at = new Date(ms)

  return texts(lang).time(at.getHours(), at.getMinutes())
}

// The tone of a block that has run `ms`: plain until ten minutes before its end, then rising; with
// the default hour, info from 50 minutes, warn from 60, alert from 90.
const toneOf = (ms: number, limits: Limits): Tone => {
  if (ms >= limits.workMs * 1.5) return 'alert'
  if (ms >= limits.workMs) return 'warn'
  if (ms >= notifyAtMs(limits)) return 'info'

  return 'ok'
}

/** The block as the band shows it; undefined before the first input. */
export function segmentOf(block: Block | undefined, now: number, lang: Lang, limits = DEFAULT_LIMITS): Segment | undefined {
  if (block === undefined) return undefined
  const t = texts(lang)
  const isBreak = isIdle(block, now, limits.breakMs)
  const worked = workedMs(block, now, limits.breakMs)
  const tone: Tone = isBreak ? 'dim' : toneOf(worked, limits)
  const short = isBreak ? t.idle : durationText(worked)
  const long = isBreak ? t.idle : t.straight(short)
  const ring = isBreak ? 0 : Math.min(100, Math.round((worked / limits.workMs) * 100))
  const isThirsty = isWaterDue(block, now, limits.breakMs)

  const extras: Part[] = [
    ...(isThirsty ? [{ text: ` ${t.water}`, tone: 'info' as const }] : []),
    ...(isLate(now) ? [{ text: ` ${t.late}`, tone: 'dim' as const }] : []),
  ]
  // The ring's own text is what a reader that cannot see it gets; the run beside it can be pressed.
  const pictured = (lead: string): Part[] => [{ text: lead, tone, ring }, { text: ` ${short}`, tone }, ...extras]
  const parts: Part[] = [{ text: long, tone }, ...extras]
  const compact: Part[] = [{ text: short, tone }, ...extras]

  return {
    text: parts.map(part => part.text).join(''),
    parts,
    rich: pictured(long),
    compact: { text: compact.map(part => part.text).join(''), parts: compact, rich: pictured(short) },
    tone,
    priority: PRIORITY,
    ...(isThirsty ? { button: { label: t.drank, command: DRINK } } : {}),
  }
}

/** The rows of the card in the Mods pane; none before the first input. */
export function cardOf(block: Block | undefined, now: number, lang: Lang, limits = DEFAULT_LIMITS): CardRow[] {
  if (block === undefined) return []
  const t = texts(lang)
  // A tally from another day counts as none today.
  const day = block.day.date === dateOf(now) ? block.day : { breaks: 0, longest: 0, lastBreak: undefined }
  const last = day.lastBreak

  return [
    { label: t.since, value: isIdle(block, now, limits.breakMs) ? '–' : clockText(block.blockStart, lang) },
    { label: t.lastBreak, value: last === undefined ? '–' : `${clockText(last.at, lang)}, ${durationText(last.ms)}` },
    { label: t.breaks, value: String(day.breaks) },
    { label: t.longest, value: durationText(Math.max(day.longest, workedMs(block, now, limits.breakMs))) },
    { label: t.lastWater, value: clockText(block.waterSince, lang) },
  ]
}

/** The two settings as the Mods pane picks them: the block's length and the break's, in minutes. */
export function settingsOf(limits: Limits, lang: Lang): Settings {
  const t = texts(lang)
  const options = (minutes: readonly number[], fallback: number) =>
    minutes.map(n => ({ value: String(n), label: n * 60_000 === fallback ? t.standard(n) : `${n} min` }))

  return {
    command: SET,
    rows: [
      { key: 'work', label: t.workSetting, value: String(limits.workMs / 60_000), options: options(WORK_MINUTES, WORK_MS) },
      { key: 'break', label: t.breakSetting, value: String(limits.breakMs / 60_000), options: options(BREAK_MINUTES, BREAK_MS) },
    ],
  }
}

/** The toast after a turn, `ms` into the block. */
export function toastText(ms: number, lang: Lang): string {
  return texts(lang).toast(durationText(ms))
}

/** The notification during a long turn, `ms` into the block. */
export function notifyText(ms: number, lang: Lang): string {
  return texts(lang).notify(durationText(ms))
}
