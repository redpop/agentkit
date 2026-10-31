// The change of the current branch and its checks, as the mod reasons about them: plain values,
// mapped from each provider's answers in `providers/` and nowhere else. The provider's words (merge
// request, pipeline, stage) stay in the texts.

/**
 * One job of the checks, in a group (GitLab's stage); a bridge to a downstream pipeline counts as
 * one too, and names that pipeline in `downstream`. `hasLog` says whether the job has a log of its own.
 */
export type Job = {
  id: number
  name: string
  group: string
  status: string
  allowFailure: boolean
  hasLog: boolean
  downstream?: { project: number; pipeline: number }
}

/**
 * The checks of one commit with their jobs, in the order the provider lists them: on GitLab the
 * merge request's head pipeline. `key` names them for estimates and toasts.
 */
export type Checks = {
  key: string
  status: string
  webUrl: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  jobs: readonly Job[]
}

/** The change whose checks the mod shows: a merge or pull request, or a branch tip without one. */
export type Change = {
  // How the band names it: `!12` (GitLab), `#12` (GitHub), the branch for a tip (`main`).
  ref: string
  // Absent for a branch tip.
  number?: number
  title?: string
  webUrl: string
  // The repository's display name: `group/project`, `owner/repo`.
  repo: string
  target?: string
  isDraft: boolean
  checks?: Checks
}

/** The hosts the mod reads. */
export type ProviderName = 'gitlab' | 'github'

/** Why there is nothing to show: no CLI, the CLI not logged in, no known host here, or another failure. */
export type Unavailable = 'no-cli' | 'no-auth' | 'no-host' | 'error'

/** What one fetch found. `estimateMs` is the mean duration of the project's last green runs. */
export type Status =
  | { kind: 'change'; provider: ProviderName; change: Change; estimateMs?: number }
  | { kind: 'none' }
  | { kind: 'unavailable'; provider?: ProviderName; reason: Unavailable }

/** Where the checks stand, as the segment draws it. */
export type Phase = 'none' | 'running' | 'manual' | 'failed' | 'success' | 'canceled'

// A job that has ended, whatever the outcome.
const ENDED = new Set(['success', 'failed', 'canceled', 'skipped'])

/** The phase of the checks: every status before an end is running, skipped counts as canceled. */
export function phaseOf(checks: Checks | undefined): Phase {
  if (checks === undefined) return 'none'
  switch (checks.status) {
    case 'manual':
    case 'failed':
    case 'success':
    case 'canceled':
      return checks.status
    case 'skipped':
      return 'canceled'
    default:
      return 'running'
  }
}

/** Finished jobs against all: an ended job, and a manual one the checks may pass by. */
export function progressOf(checks: Checks): { done: number; total: number } {
  const done = checks.jobs.filter(job => ENDED.has(job.status) || (job.status === 'manual' && job.allowFailure))

  return { done: done.length, total: checks.jobs.length }
}

/** Whether the job failed the checks; an allowed failure did not. */
export function isBlocking(job: Job): boolean {
  return job.status === 'failed' && !job.allowFailure
}

/** The first job that failed the checks. */
export function firstFailed(checks: Checks): Job | undefined {
  return checks.jobs.find(isBlocking)
}

/** The mean of the durations; undefined without any. */
export function meanMs(durationsMs: readonly number[]): number | undefined {
  return durationsMs.length === 0 ? undefined : durationsMs.reduce((sum, one) => sum + one, 0) / durationsMs.length
}
