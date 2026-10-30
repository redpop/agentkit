// The time worked without a break, as every session of the mod shares it: plain values and their
// transitions, read from and written to the store in `register.tsx` and nowhere else.

/** A block of work: an hour by default, then a break is due. */
export const WORK_MS = 3_600_000
/** Ten minutes without input count as a break, by default. */
export const BREAK_MS = 600_000
/** Water is due after this long since the last. */
export const WATER_MS = 2_700_000
/** A turn running this long leaves the person waiting. */
export const LONG_TURN_MS = 180_000
/** The system's last input moves the block on once it is this much newer. */
export const SENSE_STEP_MS = 60_000

/** The local day's tally; `lastBreak` is the latest break's end of work and its length. */
export type Day = { date: string; breaks: number; longest: number; lastBreak?: { at: number; ms: number } }

/** The state every session shares, under the store key `block`. */
export type Block = { lastActive: number; blockStart: number; waterSince: number; day: Day; noticed?: number }

/** The block and break lengths the person set, the same in every session, under the store key `limits`. */
export type Limits = { workMs: number; breakMs: number }

/** What a person can set, in minutes; the defaults are 60 and 10. */
export const WORK_MINUTES = [30, 45, 50, 60, 75, 90] as const
export const BREAK_MINUTES = [5, 10, 15, 20] as const

export const DEFAULT_LIMITS: Limits = { workMs: WORK_MS, breakMs: BREAK_MS }

const MINUTE_MS = 60_000

/** A stored value as limits, each minute count one of its options; anything else keeps its default. */
export function limitsOf(value: unknown): Limits {
  const stored = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const pick = (minutes: unknown, options: readonly number[], fallback: number) =>
    typeof minutes === 'number' && options.includes(minutes) ? minutes * MINUTE_MS : fallback

  return {
    workMs: pick(stored.workMinutes, WORK_MINUTES, WORK_MS),
    breakMs: pick(stored.breakMinutes, BREAK_MINUTES, BREAK_MS),
  }
}

/** The limits as stored, in minutes. */
export function storedLimits(limits: Limits): { workMinutes: number; breakMinutes: number } {
  return { workMinutes: limits.workMs / MINUTE_MS, breakMinutes: limits.breakMs / MINUTE_MS }
}

/** From this long into a block, a long turn is a good moment for a break: ten minutes before its end. */
export function notifyAtMs(limits: Limits): number {
  return limits.workMs - 10 * MINUTE_MS
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The local date of `ms`, as `YYYY-MM-DD`. */
export function dateOf(ms: number): string {
  const at = new Date(ms)

  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const isDay = (value: unknown): value is Day => {
  if (typeof value !== 'object' || value === null) return false
  const day = value as Record<string, unknown>
  if (typeof day.date !== 'string' || !isTime(day.breaks) || !isTime(day.longest)) return false
  if (day.lastBreak === undefined) return true
  const last = day.lastBreak as Record<string, unknown> | null

  return typeof last === 'object' && last !== null && isTime(last.at) && isTime(last.ms)
}

/** A stored value as a block, checked field by field; anything else is no block. */
export function parse(value: unknown): Block | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const block = value as Record<string, unknown>
  if (!isTime(block.lastActive) || !isTime(block.blockStart) || !isTime(block.waterSince)) return undefined
  if (!isDay(block.day) || (block.noticed !== undefined && !isTime(block.noticed))) return undefined

  return value as Block
}

/** Whether the last input lies a break back. */
export function isIdle(block: Block, now: number, breakMs = BREAK_MS): boolean {
  return now - block.lastActive >= breakMs
}

/** How long the current block has run; 0 during a break. */
export function workedMs(block: Block, now: number, breakMs = BREAK_MS): number {
  return isIdle(block, now, breakMs) ? 0 : Math.max(0, now - block.blockStart)
}

/**
 * The block after an input at `now`. After a break the old block is tallied, on its own day only:
 * a block from another day starts the new day's tally empty.
 */
export function touch(block: Block | undefined, now: number, breakMs = BREAK_MS): Block {
  if (block === undefined) {
    return { lastActive: now, blockStart: now, waterSince: now, day: { date: dateOf(now), breaks: 0, longest: 0 } }
  }
  if (!isIdle(block, now, breakMs)) return { ...block, lastActive: Math.max(block.lastActive, now) }

  const date = dateOf(now)
  const day: Day =
    block.day.date === date
      ? {
          date,
          breaks: block.day.breaks + 1,
          longest: Math.max(block.day.longest, block.lastActive - block.blockStart),
          lastBreak: { at: block.lastActive, ms: now - block.lastActive },
        }
      : { date, breaks: 0, longest: 0 }

  return { lastActive: now, blockStart: now, waterSince: now, day }
}

/**
 * The block after the system's last input at `at`, or undefined when there is nothing to write: an
 * input less than a minute newer than the block's own, or, with no block yet, one a break back.
 * That one would start a block nobody worked in, and its first input would count a break.
 */
export function sensed(block: Block | undefined, at: number, now: number, breakMs = BREAK_MS): Block | undefined {
  if (block === undefined) return now - at >= breakMs ? undefined : touch(undefined, at, breakMs)

  return at - block.lastActive < SENSE_STEP_MS ? undefined : touch(block, at, breakMs)
}

/** The block once the person drank at `now`. */
export function drink(block: Block, now: number): Block {
  return { ...block, waterSince: now }
}

/** Whether water is due: working, and 45 minutes since the last. */
export function isWaterDue(block: Block, now: number, breakMs = BREAK_MS): boolean {
  return !isIdle(block, now, breakMs) && now - block.waterSince >= WATER_MS
}

/** Whether it is 22:00 or later, local time. */
export function isLate(now: number): boolean {
  return new Date(now).getHours() >= 22
}

/** Whether a hint may go out: working at least `atMs`, and none yet for this block. */
export function mayNotice(block: Block, now: number, atMs: number, breakMs = BREAK_MS): boolean {
  return !isIdle(block, now, breakMs) && workedMs(block, now, breakMs) >= atMs && block.noticed !== block.blockStart
}

/** The block once its one hint went out. */
export function notice(block: Block): Block {
  return { ...block, noticed: block.blockStart }
}
