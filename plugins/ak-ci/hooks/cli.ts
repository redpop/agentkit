// What every call to a CLI shares. A leaf: it imports nothing at run time, so the provider and the
// modules beneath it can all reach it without importing each other.

import type { EngineInterface } from 'claude-code'

import type { Unavailable } from './model'

/** How long a call to a host's CLI, to `git`, or to `open`, may run. */
export const TIMEOUT_MS = 10_000

// The CLI is not installed: the call could not start it. Any other rejection is a call still
// running at the timeout, which a slow network causes and the next fetch may not.
export const NOT_STARTED = /ENOENT|not found|no such file/i

/** A call that did not answer: why, as the segment reports it. */
export class Refused extends Error {
  constructor(readonly reason: Unavailable) {
    super(reason)
  }
}

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those.

/** What a command writes to stdout, trimmed; undefined when it exits non-zero or cannot start. */
export async function out($: EngineInterface, argv: string[]): Promise<string | undefined> {
  try {
    const result = await $.process.run(argv, { timeoutMs: TIMEOUT_MS })

    return result.exitCode === 0 ? result.stdout.trim() : undefined
  } catch {
    return undefined
  }
}

// Readers for a CLI's JSON answer, each one plain or undefined whatever the answer holds.

export type Raw = Record<string, unknown>

export const record = (value: unknown): Raw | undefined => (typeof value === 'object' && value !== null ? (value as Raw) : undefined)
export const list = (value: unknown): Raw[] => (Array.isArray(value) ? value.map(record).filter((one): one is Raw => one !== undefined) : [])
export const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
