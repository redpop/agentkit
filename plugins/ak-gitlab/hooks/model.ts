// The merge request of the current branch and its head pipeline, as the mod reasons about them:
// plain values, mapped from GitLab's answers in `glab.ts` and nowhere else.

/** One job of a pipeline; a bridge to a downstream pipeline counts as one too. */
export type Job = { id: number; name: string; stage: string; status: string; allowFailure: boolean }

/** A merge request's head pipeline with its jobs, in the order GitLab lists them. */
export type Pipeline = {
  id: number
  status: string
  webUrl: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  jobs: readonly Job[]
}

/** The open merge request whose source is the current branch. */
export type Mr = { iid: number; title: string; webUrl: string; target: string; isDraft: boolean; pipeline?: Pipeline }

/** Why there is nothing to show: no glab, glab not logged in, no GitLab project here, or another failure. */
export type Unavailable = 'no-glab' | 'no-auth' | 'not-gitlab' | 'error'

/** What one fetch found. `estimateMs` is the mean duration of the project's last green pipelines. */
export type Status =
  | { kind: 'mr'; mr: Mr; estimateMs?: number }
  | { kind: 'none' }
  | { kind: 'unavailable'; reason: Unavailable }

/** Where a pipeline stands, as the segment draws it. */
export type Phase = 'none' | 'running' | 'manual' | 'failed' | 'success' | 'canceled'

// A job that has ended, whatever the outcome.
const ENDED = new Set(['success', 'failed', 'canceled', 'skipped'])

/** The phase of a pipeline: every status before an end is running, skipped counts as canceled. */
export function phaseOf(pipeline: Pipeline | undefined): Phase {
  if (pipeline === undefined) return 'none'
  switch (pipeline.status) {
    case 'manual':
    case 'failed':
    case 'success':
    case 'canceled':
      return pipeline.status
    case 'skipped':
      return 'canceled'
    default:
      return 'running'
  }
}

/** Finished jobs against all: an ended job, and a manual one the pipeline may pass by. */
export function progressOf(pipeline: Pipeline): { done: number; total: number } {
  const done = pipeline.jobs.filter(job => ENDED.has(job.status) || (job.status === 'manual' && job.allowFailure))

  return { done: done.length, total: pipeline.jobs.length }
}

/** The first job that failed the pipeline; an allowed failure did not. */
export function firstFailed(pipeline: Pipeline): Job | undefined {
  return pipeline.jobs.find(job => job.status === 'failed' && !job.allowFailure)
}

/** Whether the pipeline has stopped moving by itself, so the fast poll can stop. */
export function isSettled(phase: Phase): boolean {
  return phase !== 'none' && phase !== 'running'
}

/** The mean of the durations; undefined without any. */
export function meanMs(durationsMs: readonly number[]): number | undefined {
  return durationsMs.length === 0 ? undefined : durationsMs.reduce((sum, one) => sum + one, 0) / durationsMs.length
}
