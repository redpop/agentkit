// The system's own idle time: how long ago the person last used the mouse, the keyboard or the
// trackpad, in any app. macOS answers it through `ioreg` without a permission prompt; Linux and
// Windows have no such command on every machine, so there the mod sees only the input in Claude.

import type { EngineInterface } from 'claude-code'

const TIMEOUT_MS = 2_000
const IOREG = ['ioreg', '-r', '-c', 'IOHIDSystem', '-k', 'HIDIdleTime', '-d', '1']
// ioreg writes the idle time in nanoseconds.
const IDLE = /"HIDIdleTime" = (\d+)/

/** The idle time in `ioreg`'s output, in milliseconds; undefined when it names none. */
export function parseIdle(stdout: string): number | undefined {
  const match = IDLE.exec(stdout)

  return match ? Math.floor(Number(match[1]) / 1_000_000) : undefined
}

// A function declaration, not an arrow: past an import the hooks loader follows `$` only into those.

/** How long the system has been idle, in milliseconds; undefined where `ioreg` cannot tell. */
export async function systemIdleMs($: EngineInterface): Promise<number | undefined> {
  try {
    const { exitCode, stdout } = await $.process.run(IOREG, { timeoutMs: TIMEOUT_MS })

    return exitCode === 0 ? parseIdle(stdout) : undefined
  } catch {
    return undefined
  }
}
