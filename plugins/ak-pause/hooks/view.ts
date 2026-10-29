// How the block reads: the segment in the band, the card in the Mods pane, and the two hints.

import type { EngineInterface } from 'claude-code'

import type { Block } from './block'
import { WORK_MS, dateOf, isIdle, isLate, isWaterDue, workedMs } from './block'
import type { Lang } from './i18n'
import { texts } from './i18n'

/** What ak-mods draws in the band for the mod. */
export type Segment = NonNullable<Parameters<EngineInterface['mods']['segment']>[0]>
type Part = NonNullable<Segment['parts']>[number]
type Tone = NonNullable<Segment['tone']>
type CardRow = NonNullable<Segment['card']>[number]

/** The command the water button runs. */
export const DRINK = 'pause-drink'

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

// The tone of a block that has run `ms`: plain for the first 50 minutes, then rising.
const toneOf = (ms: number): Tone => {
  const minutes = ms / 60_000
  if (minutes >= 90) return 'alert'
  if (minutes >= 60) return 'warn'
  if (minutes >= 50) return 'info'

  return 'ok'
}

/** The block as the band shows it; undefined before the first input. */
export function segmentOf(block: Block | undefined, now: number, lang: Lang): Segment | undefined {
  if (block === undefined) return undefined
  const t = texts(lang)
  const isBreak = isIdle(block, now)
  const worked = workedMs(block, now)
  const tone: Tone = isBreak ? 'dim' : toneOf(worked)
  const short = isBreak ? t.idle : durationText(worked)
  const long = isBreak ? t.idle : t.straight(short)
  const ring = isBreak ? 0 : Math.min(100, Math.round((worked / WORK_MS) * 100))
  const isThirsty = isWaterDue(block, now)

  const extras: Part[] = [
    ...(isThirsty ? [{ text: ` · ${t.water}`, tone: 'info' as const }] : []),
    ...(isLate(now) ? [{ text: ` · ${t.late}`, tone: 'dim' as const }] : []),
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
export function cardOf(block: Block | undefined, now: number, lang: Lang): CardRow[] {
  if (block === undefined) return []
  const t = texts(lang)
  // A tally from another day counts as none today.
  const day = block.day.date === dateOf(now) ? block.day : { breaks: 0, longest: 0, lastBreak: undefined }
  const last = day.lastBreak

  return [
    { label: t.since, value: isIdle(block, now) ? '–' : clockText(block.blockStart, lang) },
    { label: t.lastBreak, value: last === undefined ? '–' : `${clockText(last.at, lang)}, ${durationText(last.ms)}` },
    { label: t.breaks, value: String(day.breaks) },
    { label: t.longest, value: durationText(Math.max(day.longest, workedMs(block, now))) },
    { label: t.lastWater, value: clockText(block.waterSince, lang) },
  ]
}

/** The toast after a turn, `ms` into the block. */
export function toastText(ms: number, lang: Lang): string {
  return texts(lang).toast(durationText(ms))
}

/** The notification during a long turn, `ms` into the block. */
export function notifyText(ms: number, lang: Lang): string {
  return texts(lang).notify(durationText(ms))
}
