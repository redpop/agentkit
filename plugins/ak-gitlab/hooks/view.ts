// How the merge request and its pipeline read: the segment in the band, the card in the Mods pane
// and the toast when the pipeline settles.

import type { EngineInterface } from 'claude-code'

import type { Lang } from './i18n'
import { texts } from './i18n'
import type { Job, Mr, Pipeline, Status } from './model'
import { firstFailed, isBlocking, phaseOf, progressOf } from './model'
import type { Phase } from './model'

/** What ak-mods draws in the band for the mod. */
export type Segment = NonNullable<Parameters<EngineInterface['mods']['segment']>[0]>
type Part = NonNullable<Segment['parts']>[number]
type Tone = NonNullable<Segment['tone']>
type CardRow = NonNullable<Segment['card']>[number]

const PRIORITY = 6

/** A span of time as minutes and seconds: `3:12`, `62:05`. */
export function elapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// When the pipeline began to run; a pending one counts from its creation.
const since = (pipeline: Pipeline) => Date.parse(pipeline.startedAt ?? pipeline.createdAt)

// How long a settled pipeline ran; undefined while GitLab names no end (a held one).
const ran = (pipeline: Pipeline) =>
  pipeline.finishedAt === undefined ? undefined : Date.parse(pipeline.finishedAt) - since(pipeline)

// The job a held pipeline waits for: the first manual job it may not pass by.
const held = (pipeline: Pipeline) =>
  pipeline.jobs.find(job => job.status === 'manual' && !job.allowFailure) ??
  pipeline.jobs.find(job => job.status === 'manual')

// A segment whose text is its parts joined, as the contract asks; `rich` for the desktop app,
// `compact` for a band short of room.
const drawn = (parts: Part[], rich: Part[], compact: Part[], tone: Tone, button: Segment['button']): Segment => ({
  text: parts.map(part => part.text).join(''),
  parts,
  rich,
  compact: { text: compact.map(part => part.text).join(''), parts: compact },
  tone,
  priority: PRIORITY,
  button,
})

// How a settled pipeline reads: its mark in its tone, short when room is short, and whether its
// duration says something (a held or canceled one's does not).
function settledLook(phase: Exclude<Phase, 'none' | 'running'>, pipeline: Pipeline, lang: Lang) {
  const t = texts(lang)
  switch (phase) {
    case 'failed':
      return { tone: 'alert' as const, mark: `✗ ${firstFailed(pipeline)?.name ?? ''}`.trimEnd(), short: '✗', rich: undefined, isTimed: true }
    case 'success':
      return { tone: 'ok' as const, mark: '✓', short: '✓', rich: '✓ Pipeline', isTimed: true }
    case 'manual':
      return { tone: 'warn' as const, mark: `⏸ ${held(pipeline)?.name ?? ''}`.trimEnd(), short: '⏸', rich: undefined, isTimed: false }
    case 'canceled':
      return { tone: 'dim' as const, mark: t.canceled, short: t.canceled, rich: undefined, isTimed: false }
  }
}

/** The segment for what a fetch found; undefined where there is nothing to show. */
export function segmentFor(status: Status, nowMs: number, lang: Lang): Segment | undefined {
  if (status.kind !== 'mr') return undefined
  const t = texts(lang)
  const id: Part = { text: `!${status.mr.iid}`, tone: 'dim' }
  const open = { label: t.open, command: 'gitlab-open' }
  const pipeline = status.mr.pipeline
  const phase = phaseOf(pipeline)
  if (pipeline === undefined || phase === 'none') {
    const parts: Part[] = [id, { text: ` ${t.noPipeline}`, tone: 'dim' }]

    return drawn(parts, parts, [id], 'dim', open)
  }

  if (phase === 'running') {
    const { done, total } = progressOf(pipeline)
    const jobs = `${done}/${total}`
    const time = elapsed(nowMs - since(pipeline))
    const minutes = status.estimateMs === undefined ? undefined : String(Math.max(1, Math.round(status.estimateMs / 60_000)))
    const lead: Part = { text: `${id.text} `, tone: 'dim' }
    const count: Part = { text: jobs, tone: 'info' }

    return drawn(
      [lead, count, { text: ` ${time}${minutes === undefined ? '' : `/~${minutes}m`}`, tone: 'dim' }],
      [
        lead,
        { ...count, ring: total === 0 ? 0 : Math.round((done / total) * 100) },
        { text: ` ${jobs}`, tone: 'info' },
        { text: ` ${time}${minutes === undefined ? '' : ` ${t.of(minutes)}`}`, tone: 'dim' },
      ],
      [lead, count],
      'info',
      open,
    )
  }

  const look = settledLook(phase, pipeline, lang)
  const duration = ran(pipeline)
  const time = look.isTimed && duration !== undefined ? elapsed(duration) : undefined

  return drawn(
    [id, { text: ` ${look.mark}`, tone: look.tone }, ...(time === undefined ? [] : [{ text: ` ${time}`, tone: 'dim' as const }])],
    [id, { text: ` ${look.rich ?? look.mark}`, tone: look.tone }, ...(time === undefined ? [] : [{ text: ` ${time}`, tone: 'dim' as const }])],
    [id, { text: ` ${look.short}`, tone: look.tone }],
    look.tone,
    phase === 'failed' ? { label: t.errors, command: 'gitlab-errors' } : open,
  )
}

// A stage's mark: failed, all through, still moving, or not reached.
const stageMark = (jobs: readonly Job[]) => {
  if (jobs.some(isBlocking)) return '✗'
  if (jobs.every(job => job.status === 'success' || (job.status === 'failed' && job.allowFailure))) return '✓'
  if (jobs.some(job => ['running', 'pending', 'preparing', 'waiting_for_resource'].includes(job.status))) return '◐'

  return '○'
}

/** The card's rows in the Mods pane: the merge request, then its pipeline. */
export function cardFor(mr: Mr, nowMs: number, lang: Lang): CardRow[] {
  const t = texts(lang)
  const rows: CardRow[] = [
    { label: t.card.mr, value: `!${mr.iid} ${mr.title}` },
    { label: t.card.target, value: mr.target },
    { label: t.card.draft, value: mr.isDraft ? t.yes : t.no },
  ]
  const pipeline = mr.pipeline
  if (pipeline === undefined) return rows

  const stages = new Map<string, Job[]>()
  for (const job of pipeline.jobs) {
    const stage = stages.get(job.stage) ?? []
    stage.push(job)
    stages.set(job.stage, stage)
  }
  const failed = pipeline.jobs.filter(isBlocking).map(job => job.name)
  const start = new Date(since(pipeline))
  const duration = phaseOf(pipeline) === 'running' ? nowMs - since(pipeline) : ran(pipeline)

  return [
    ...rows,
    { label: t.card.pipeline, value: `#${pipeline.id} ${pipeline.status}` },
    { label: t.card.stages, value: [...stages].map(([name, jobs]) => `${name} ${stageMark(jobs)}`).join(' · ') },
    ...(failed.length === 0 ? [] : [{ label: t.card.failed, value: failed.join(', ') }]),
    { label: t.card.started, value: t.time(start.getHours(), start.getMinutes()) },
    ...(duration === undefined ? [] : [{ label: t.card.duration, value: elapsed(duration) }]),
  ]
}

/**
 * The toast for a pipeline that settled, keyed by the state it reached: a retry that finishes the
 * same pipeline again gets a key of its own. Undefined for every state that gets none.
 */
export function toastFor(mr: Mr, lang: Lang): { key: string; text: string } | undefined {
  const t = texts(lang)
  const pipeline = mr.pipeline
  if (pipeline === undefined) return undefined
  const finished = `${pipeline.id}:${pipeline.finishedAt}`
  switch (phaseOf(pipeline)) {
    case 'success':
      return { key: finished, text: t.green(mr.iid, elapsed(ran(pipeline) ?? 0)) }
    case 'failed':
      return { key: finished, text: t.failed(mr.iid, firstFailed(pipeline)?.name ?? '') }
    case 'manual':
      {
      const name = held(pipeline)?.name ?? ''

      return { key: `${pipeline.id}:manual:${name}`, text: t.waits(mr.iid, name) }
    }
    default:
      return undefined
  }
}
