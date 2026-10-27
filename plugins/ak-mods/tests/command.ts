import type { Engine } from 'claude-code/testing'

/** Runs a slash command on the test's engine as the person typing it in the composer, `columns` wide. */
export const runCommand = ($: Engine, command: string, args = '', columns = 80) =>
  $.command.run({
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns },
  })
