// The time worked without a break, as every session of the mod shares it: plain values and their
// transitions, read from and written to the store in `register.tsx` and nowhere else.

/** A block of work: an hour, then a break is due. */
export const WORK_MS = 3_600_000
/** Ten minutes without input count as a break. */
export const BREAK_MS = 600_000
/** Water is due after this long since the last. */
export const WATER_MS = 2_700_000
/** From this long into a block, a long turn is a good moment for a break. */
export const NOTIFY_AT_MS = 3_000_000
/** A turn running this long leaves the person waiting. */
export const LONG_TURN_MS = 180_000

/** The local day's tally; `lastBreak` is the latest break's end of work and its length. */
export type Day = { date: string; breaks: number; longest: number; lastBreak?: { at: number; ms: number } }

/** The state every session shares, under the store key `block`. */
export type Block = { lastActive: number; blockStart: number; waterSince: number; day: Day; noticed?: number }

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
export function isIdle(block: Block, now: number): boolean {
  return now - block.lastActive >= BREAK_MS
}

/** How long the current block has run; 0 during a break. */
export function workedMs(block: Block, now: number): number {
  return isIdle(block, now) ? 0 : Math.max(0, now - block.blockStart)
}

/**
 * The block after an input at `now`. After a break the old block is tallied, on its own day only:
 * a block from another day starts the new day's tally empty.
 */
export function touch(block: Block | undefined, now: number): Block {
  if (block === undefined) {
    return { lastActive: now, blockStart: now, waterSince: now, day: { date: dateOf(now), breaks: 0, longest: 0 } }
  }
  if (!isIdle(block, now)) return { ...block, lastActive: Math.max(block.lastActive, now) }

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

/** The block once the person drank at `now`. */
export function drink(block: Block, now: number): Block {
  return { ...block, waterSince: now }
}

/** Whether water is due: working, and 45 minutes since the last. */
export function isWaterDue(block: Block, now: number): boolean {
  return !isIdle(block, now) && now - block.waterSince >= WATER_MS
}

/** Whether it is 22:00 or later, local time. */
export function isLate(now: number): boolean {
  return new Date(now).getHours() >= 22
}

/** Whether a hint may go out: working at least `atMs`, and none yet for this block. */
export function mayNotice(block: Block, now: number, atMs: number): boolean {
  return !isIdle(block, now) && workedMs(block, now) >= atMs && block.noticed !== block.blockStart
}

/** The block once its one hint went out. */
export function notice(block: Block): Block {
  return { ...block, noticed: block.blockStart }
}
