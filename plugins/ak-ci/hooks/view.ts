// How the change and its checks read: the segment in the band, the card in the Mods pane and the
// toast when the checks settle.

import type { EngineInterface } from 'claude-code'

import type { Lang } from './i18n'
import { texts } from './i18n'
import type { Checks, Job, ProviderName, Status } from './model'
import { firstFailed, isBlocking, phaseOf, progressOf } from './model'
import type { Phase } from './model'

/** What ak-mods draws in the band for the mod. */
export type Segment = NonNullable<Parameters<EngineInterface['mods']['segment']>[0]>
type Part = NonNullable<Segment['parts']>[number]
type Tone = NonNullable<Segment['tone']>
type CardRow = NonNullable<Segment['card']>[number]

const PRIORITY = 6

/** A span of time as minutes and seconds: `3:12`, `62:05`; empty for one that is not known. */
export function elapsed(ms: number): string {
  if (!Number.isFinite(ms)) return ''
  const seconds = Math.max(0, Math.floor(ms / 1000))

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// When the checks began to run; pending ones count from their creation.
const since = (checks: Checks) => Date.parse(checks.startedAt ?? checks.createdAt)

// How long settled checks ran; undefined while the provider names no end (held ones).
const ran = (checks: Checks) => {
  const ms = checks.finishedAt === undefined ? Number.NaN : Date.parse(checks.finishedAt) - since(checks)

  return Number.isFinite(ms) ? ms : undefined
}

// The job held checks wait for: the first manual job they may not pass by.
const held = (checks: Checks) =>
  checks.jobs.find(job => job.status === 'manual' && !job.allowFailure) ?? checks.jobs.find(job => job.status === 'manual')

// A segment whose text is its parts joined, as the contract asks; `rich` for the desktop app,
// `compact` for a band short of room. The card's menu opens the change or copies its link, whatever
// the button does.
const drawn = (parts: Part[], rich: Part[], compact: Part[], tone: Tone, button: Segment['button'], lang: Lang): Segment => ({
  text: parts.map(part => part.text).join(''),
  parts,
  rich,
  compact: { text: compact.map(part => part.text).join(''), parts: compact },
  tone,
  priority: PRIORITY,
  button,
  actions: [
    { label: texts(lang).open, command: 'ci-open' },
    { label: texts(lang).copyLink, command: 'ci-link' },
  ],
})

// How settled checks read: their mark in their tone, short when room is short, and whether their
// duration says something (held or canceled ones' does not).
function settledLook(phase: Exclude<Phase, 'none' | 'running'>, checks: Checks, provider: ProviderName, lang: Lang) {
  const t = texts(lang)
  switch (phase) {
    case 'failed':
      return { tone: 'alert' as const, mark: `✗ ${firstFailed(checks)?.name ?? ''}`.trimEnd(), short: '✗', rich: undefined, isTimed: true }
    case 'success':
      return { tone: 'ok' as const, mark: '✓', short: '✓', rich: `✓ ${t.checks[provider]}`, isTimed: true }
    case 'manual':
      return { tone: 'warn' as const, mark: `⏸ ${held(checks)?.name ?? ''}`.trimEnd(), short: '⏸', rich: undefined, isTimed: false }
    case 'canceled':
      return { tone: 'dim' as const, mark: t.canceled, short: t.canceled, rich: undefined, isTimed: false }
  }
}

/** The segment for what a fetch found; undefined where there is nothing to show. */
export function segmentFor(status: Status, nowMs: number, lang: Lang): Segment | undefined {
  if (status.kind !== 'change') return undefined
  const t = texts(lang)
  const id: Part = { text: status.change.ref, tone: 'dim' }
  const open = { label: t.open, command: 'ci-open' }
  const checks = status.change.checks
  const phase = phaseOf(checks)
  if (checks === undefined || phase === 'none') {
    const parts: Part[] = [id, { text: ` ${t.noChecks[status.provider]}`, tone: 'dim' }]

    return drawn(parts, parts, [id], 'dim', open, lang)
  }

  if (phase === 'running') {
    const { done, total } = progressOf(checks)
    const jobs = `${done}/${total}`
    const time = elapsed(nowMs - since(checks))
    const minutes = status.estimateMs === undefined ? undefined : String(Math.max(1, Math.round(status.estimateMs / 60_000)))
    const lead: Part = { text: `${id.text} `, tone: 'dim' }
    const count: Part = { text: jobs, tone: 'info' }
    // Without a known start there is no time so far: only the estimate stays.
    const plain = minutes === undefined ? time : `${time}${time === '' ? '~' : '/~'}${minutes}m`
    const rich = minutes === undefined ? time : `${time} ${t.of(minutes)}`.trimStart()

    return drawn(
      [lead, count, ...(plain === '' ? [] : [{ text: ` ${plain}`, tone: 'dim' as const }])],
      [
        lead,
        { ...count, ring: total === 0 ? 0 : Math.round((done / total) * 100) },
        { text: ` ${jobs}`, tone: 'info' },
        ...(rich === '' ? [] : [{ text: ` ${rich}`, tone: 'dim' as const }]),
      ],
      [lead, count],
      'info',
      open,
      lang,
    )
  }

  const look = settledLook(phase, checks, status.provider, lang)
  const duration = ran(checks)
  const time = look.isTimed && duration !== undefined ? elapsed(duration) : undefined

  return drawn(
    [id, { text: ` ${look.mark}`, tone: look.tone }, ...(time === undefined ? [] : [{ text: ` ${time}`, tone: 'dim' as const }])],
    [id, { text: ` ${look.rich ?? look.mark}`, tone: look.tone }, ...(time === undefined ? [] : [{ text: ` ${time}`, tone: 'dim' as const }])],
    [id, { text: ` ${look.short}`, tone: look.tone }],
    look.tone,
    phase === 'failed' ? { label: t.errors, command: 'ci-errors' } : open,
    lang,
  )
}

// A group's mark: failed, all through, still moving, or not reached.
const groupMark = (jobs: readonly Job[]) => {
  if (jobs.some(isBlocking)) return '✗'
  if (jobs.every(job => job.status === 'success' || (job.status === 'failed' && job.allowFailure))) return '✓'
  if (jobs.some(job => ['running', 'pending', 'preparing', 'waiting_for_resource'].includes(job.status))) return '◐'

  return '○'
}

/**
 * The card's rows in the Mods pane: the change with its repository (`owner/repo #12 Title`, a branch
 * tip `owner/repo main`), then its checks. Empty for a status without a change.
 */
export function cardFor(status: Status, nowMs: number, lang: Lang): CardRow[] {
  if (status.kind !== 'change') return []
  const t = texts(lang)
  const { change, provider } = status
  // A repository name or title that could not be read leaves no gap.
  const named = [change.repo, change.ref, change.title].filter(part => part !== undefined && part !== '').join(' ')
  const rows: CardRow[] = [
    { label: t.card.change, value: named },
    ...(change.target === undefined ? [] : [{ label: t.card.target, value: change.target }]),
    // A branch tip is no pull request, so it is no draft either.
    ...(change.number === undefined ? [] : [{ label: t.card.draft, value: change.isDraft ? t.yes : t.no }]),
  ]
  const checks = change.checks
  if (checks === undefined) return rows

  const groups = new Map<string, Job[]>()
  for (const job of checks.jobs) {
    const group = groups.get(job.group) ?? []
    group.push(job)
    groups.set(job.group, group)
  }
  const failed = checks.jobs.filter(isBlocking).map(job => job.name)
  const start = new Date(since(checks))
  const duration = phaseOf(checks) === 'running' ? nowMs - since(checks) : ran(checks)
  const time = duration === undefined ? '' : elapsed(duration)

  return [
    ...rows,
    // GitLab names a pipeline by its id, GitHub the checks by their commit, short as GitHub shows it.
    { label: t.checks[provider], value: `${provider === 'github' ? checks.key.slice(0, 7) : `#${checks.key}`} ${checks.status}` },
    { label: t.card.groups[provider], value: [...groups].map(([name, jobs]) => `${name} ${groupMark(jobs)}`).join(' · ') },
    ...(failed.length === 0 ? [] : [{ label: t.card.failed, value: failed.join(', ') }]),
    ...(Number.isNaN(start.getTime()) ? [] : [{ label: t.card.started, value: t.time(start.getHours(), start.getMinutes()) }]),
    ...(time === '' ? [] : [{ label: t.card.duration, value: time }]),
  ]
}

/**
 * The toast for checks that settled, keyed by the state they reached. Green is keyed by when the
 * checks ended, so a retry that turns the same checks green again gets a key of its own. Failed
 * checks on GitHub turn red at their first failure while others still run, their end moving on:
 * keyed by the checks alone, they toast once (checks that run again clear their keys, in
 * `announce`). A GitLab pipeline fails only once it has ended, keyed by that end as green is.
 * Undefined for every state that gets none.
 */
export function toastFor(status: Status, lang: Lang): { key: string; text: string } | undefined {
  if (status.kind !== 'change') return undefined
  const t = texts(lang)
  const { change, provider } = status
  const checks = change.checks
  if (checks === undefined) return undefined
  // A branch tip has no number: its checks are named by the branch they are on.
  const isTip = change.number === undefined
  const finished = `${checks.key}:${checks.finishedAt}`
  switch (phaseOf(checks)) {
    case 'success':
      return { key: finished, text: t.green(provider, change.ref, isTip, elapsed(ran(checks) ?? 0)) }
    case 'failed':
      return {
        key: provider === 'github' ? `${checks.key}:failed` : finished,
        text: t.failed(provider, change.ref, isTip, firstFailed(checks)?.name ?? ''),
      }
    case 'manual': {
      const name = held(checks)?.name ?? ''

      return { key: `${checks.key}:manual:${name}`, text: t.waits(provider, change.ref, isTip, name) }
    }
    default:
      return undefined
  }
}
