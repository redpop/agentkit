// How the merge request and its pipeline read: the segment in the band, the card in the Mods pane
// and the toast when the pipeline settles.

import type { EngineInterface } from 'claude-code'

import type { Lang } from './i18n'
import { texts } from './i18n'
import type { Job, Mr, Pipeline, Status } from './model'
import { firstFailed, phaseOf, progressOf } from './model'

type Segment = NonNullable<Parameters<EngineInterface['mods']['segment']>[0]>
type CardRow = { label: string; value: string }

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

/** The segment for what a fetch found; undefined where there is nothing to show. */
export function segmentFor(status: Status, nowMs: number, lang: Lang): Segment | undefined {
  if (status.kind !== 'mr') return undefined
  const t = texts(lang)
  const { mr } = status
  const id = `!${mr.iid}`
  const open = { label: t.open, command: 'gitlab-open' }
  const pipeline = mr.pipeline
  const phase = phaseOf(pipeline)
  if (pipeline === undefined || phase === 'none') {
    return {
      text: `${id} ${t.noPipeline}`,
      rich: [
        { text: id, tone: 'dim' },
        { text: ` ${t.noPipeline}`, tone: 'dim' },
      ],
      compact: { text: id },
      tone: 'dim',
      priority: 6,
      button: open,
    }
  }

  if (phase === 'running') {
    const { done, total } = progressOf(pipeline)
    const jobs = `${done}/${total}`
    const time = elapsed(nowMs - since(pipeline))
    const minutes = status.estimateMs === undefined ? undefined : String(Math.max(1, Math.round(status.estimateMs / 60_000)))

    return {
      text: `${id} ${jobs} ${time}${minutes === undefined ? '' : `/~${minutes}m`}`,
      parts: [
        { text: `${id} `, tone: 'dim' },
        { text: jobs, tone: 'info' },
        { text: ` ${time}${minutes === undefined ? '' : `/~${minutes}m`}`, tone: 'dim' },
      ],
      rich: [
        { text: `${id} `, tone: 'dim' },
        { text: jobs, tone: 'info', ring: total === 0 ? 0 : Math.round((done / total) * 100) },
        { text: ` ${jobs}`, tone: 'info' },
        { text: ` · ${time}${minutes === undefined ? '' : ` ${t.of(minutes)}`}`, tone: 'dim' },
      ],
      compact: {
        text: `${id} ${jobs}`,
        parts: [
          { text: `${id} `, tone: 'dim' },
          { text: jobs, tone: 'info' },
        ],
      },
      tone: 'info',
      priority: 6,
      button: open,
    }
  }

  // A settled pipeline: one mark in its tone, the duration dim where GitLab names an end.
  const duration = ran(pipeline)
  const time = duration === undefined ? undefined : elapsed(duration)
  const settled: { tone: NonNullable<Segment['tone']>; mark: string; short: string; rich: string | undefined } =
    phase === 'failed'
      ? { tone: 'alert', mark: `✗ ${firstFailed(pipeline)?.name ?? ''}`.trimEnd(), short: '✗', rich: undefined }
      : phase === 'success'
        ? { tone: 'ok', mark: '✓', short: '✓', rich: '✓ Pipeline' }
        : phase === 'manual'
          ? { tone: 'warn', mark: `⏸ ${held(pipeline)?.name ?? ''}`.trimEnd(), short: '⏸', rich: undefined }
          : { tone: 'dim', mark: t.canceled, short: t.canceled, rich: undefined }
  const tone = settled.tone
  // Held and canceled pipelines show no duration: it says nothing about the work.
  const shown = phase === 'failed' || phase === 'success' ? time : undefined

  return {
    text: `${id} ${settled.mark}${shown === undefined ? '' : ` ${shown}`}`,
    parts: [
      { text: id, tone: 'dim' },
      { text: ` ${settled.mark}`, tone },
      ...(shown === undefined ? [] : [{ text: ` ${shown}`, tone: 'dim' as const }]),
    ],
    rich: [
      { text: id, tone: 'dim' },
      { text: ` ${settled.rich ?? settled.mark}`, tone },
      ...(shown === undefined ? [] : [{ text: ` · ${shown}`, tone: 'dim' as const }]),
    ],
    compact: {
      text: `${id} ${settled.short}`,
      parts: [
        { text: id, tone: 'dim' },
        { text: ` ${settled.short}`, tone },
      ],
    },
    tone,
    priority: 6,
    button: phase === 'failed' ? { label: t.errors, command: 'gitlab-errors' } : open,
  }
}

// A stage's mark: failed, all through, still moving, or not reached.
const stageMark = (jobs: readonly Job[]) =>
  jobs.some(job => job.status === 'failed' && !job.allowFailure)
    ? '✗'
    : jobs.every(job => job.status === 'success' || (job.status === 'failed' && job.allowFailure))
      ? '✓'
      : jobs.some(job => ['running', 'pending', 'preparing', 'waiting_for_resource'].includes(job.status))
        ? '◐'
        : '○'

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
  for (const job of pipeline.jobs) stages.set(job.stage, [...(stages.get(job.stage) ?? []), job])
  const failed = pipeline.jobs.filter(job => job.status === 'failed' && !job.allowFailure).map(job => job.name)
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
  switch (phaseOf(pipeline)) {
    case 'success':
      return pipeline === undefined
        ? undefined
        : { key: `${pipeline.id}:${pipeline.finishedAt}`, text: t.green(mr.iid, elapsed(ran(pipeline) ?? 0)) }
    case 'failed':
      return pipeline === undefined
        ? undefined
        : { key: `${pipeline.id}:${pipeline.finishedAt}`, text: t.failed(mr.iid, firstFailed(pipeline)?.name ?? '') }
    case 'manual':
      return pipeline === undefined ? undefined : { key: `${pipeline.id}:manual`, text: t.waits(mr.iid, held(pipeline)?.name ?? '') }
    default:
      return undefined
  }
}
