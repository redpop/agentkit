// A failed job's log, cut to what a reader needs: the lines that look like errors, with a little
// around them, and the end of the log.

import type { Lang } from './i18n'
import { texts } from './i18n'
import type { Change, Job } from './model'

// GitLab's collapsible sections: `section_start:<time>:<name>[<options>]\r\e[0K`.
const SECTION = /section_(?:start|end):\d+:[^\r\n]*?\r\x1b\[0K/g
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g
const ERROR_LIKE = /\b(?:error|failed|failure|fatal|exception|panic)\b|[✗✖]/i
const AROUND = 3
const TAIL = 30

/** The log's lines as a terminal shows them: no colours, no section markers, a `\r` overwrite resolved. */
export function clean(trace: string): string[] {
  return trace.split('\n').map(line => {
    const plain = line.replace(SECTION, '').replace(/\r+$/, '').replace(ANSI, '')

    return plain.slice(plain.lastIndexOf('\r') + 1)
  })
}

/**
 * The error-like lines with three lines around each, then the last 30 lines, `…` between parts that
 * do not join; longer than `maxChars`, cut from the front.
 */
export function excerpt(trace: string, maxChars = 12_000): string {
  const all = clean(trace)
  const kept = new Set<number>()
  all.forEach((line, at) => {
    if (!ERROR_LIKE.test(line)) return
    for (let near = Math.max(0, at - AROUND); near <= Math.min(all.length - 1, at + AROUND); near++) kept.add(near)
  })
  for (let at = Math.max(0, all.length - TAIL); at < all.length; at++) kept.add(at)

  const out: string[] = []
  let last: number | undefined
  for (const at of [...kept].sort((a, b) => a - b)) {
    if (last !== undefined && at !== last + 1) out.push('…')
    out.push(all[at] ?? '')
    last = at
  }
  const text = out.join('\n')

  return text.length <= maxChars ? text : `…${text.slice(text.length - maxChars + 1)}`
}

/**
 * The prompt-box draft: what failed where, then the excerpt in a fenced block. A log cut at the
 * read limit says that its end, where the error usually is, is missing.
 */
export function draftFor(change: Change, job: Job, excerpt: string, lang: Lang, isCut = false): string {
  const t = texts(lang)

  return `${t.draft(change.ref, job.name, job.group)}\n\n${isCut ? `${t.cut}\n\n` : ''}\`\`\`text\n${excerpt}\n\`\`\``
}
