// GitLab through glab: the one module that reaches outside. glab resolves the project and the
// branch from the repository (`:id`, `:branch`) and brings its own login, so the mod holds no token.
// GitLab's snake_case answers become the plain values of `model.ts` here and nowhere else.

import type { EngineInterface } from 'claude-code'

import type { Job, Mr, Pipeline, Status, Unavailable } from './model'
import { meanMs, phaseOf } from './model'

const TIMEOUT_MS = 10_000

// A refusal glab names, by its message.
const NO_AUTH = /401|unauthori[sz]ed|not logged in|authenticat/i
const NOT_GITLAB = /not a git repository|no git remote|none of the git remotes|could not determine/i

/** A call that did not answer: why, as the segment reports it. */
class Refused extends Error {
  constructor(readonly reason: Unavailable) {
    super(reason)
  }
}

// glab is not installed: the call could not start it. Any other rejection is a call still
// running at the timeout, which a slow network causes and the next fetch may not.
const NOT_STARTED = /ENOENT|not found|no such file/i

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those.

/** What glab writes for an API path; throws `Refused` with the reason when it does not answer. */
async function run($: EngineInterface, path: string): Promise<string> {
  let result
  try {
    result = await $.process.run(['glab', 'api', path], { timeoutMs: TIMEOUT_MS })
  } catch (error) {
    throw new Refused(NOT_STARTED.test(String(error)) ? 'no-glab' : 'error')
  }
  if (result.exitCode !== 0) {
    throw new Refused(NO_AUTH.test(result.stderr) ? 'no-auth' : NOT_GITLAB.test(result.stderr) ? 'not-gitlab' : 'error')
  }

  return result.stdout
}

/** The JSON glab answers for an API path; throws `Refused` when there is none. */
async function api($: EngineInterface, path: string): Promise<unknown> {
  const stdout = await run($, path)
  try {
    return JSON.parse(stdout)
  } catch {
    throw new Refused('error')
  }
}

type Raw = Record<string, unknown>

const record = (value: unknown): Raw | undefined => (typeof value === 'object' && value !== null ? (value as Raw) : undefined)
const list = (value: unknown): Raw[] => (Array.isArray(value) ? value.map(record).filter((one): one is Raw => one !== undefined) : [])
const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const job = (raw: Raw): Job => ({
  id: Number(raw.id),
  name: text(raw.name) ?? '',
  stage: text(raw.stage) ?? '',
  status: text(raw.status) ?? '',
  allowFailure: raw.allow_failure === true,
})

/** The jobs of a pipeline and its bridges to downstream pipelines, each bridge one job. */
async function jobsOf($: EngineInterface, id: number): Promise<Job[]> {
  const [jobs, bridges] = await Promise.all([
    api($, `projects/:id/pipelines/${id}/jobs?per_page=100`),
    api($, `projects/:id/pipelines/${id}/bridges?per_page=100`),
  ])

  return [...list(jobs), ...list(bridges)].map(job)
}

/** The mean run of the project's last green pipelines, the head one left out; undefined without any. */
async function estimateFor($: EngineInterface, head: number): Promise<number | undefined> {
  const green = list(await api($, 'projects/:id/pipelines?status=success&per_page=5'))
  const durations = green
    .filter(one => Number(one.id) !== head)
    .map(one => Date.parse(text(one.updated_at) ?? '') - Date.parse(text(one.created_at) ?? ''))
    .filter(ms => Number.isFinite(ms) && ms > 0)

  return meanMs(durations)
}

/**
 * The open merge request whose source is the current branch, with its head pipeline and the
 * estimate. `estimates` keeps each pipeline's estimate across calls, so it is fetched once.
 */
export async function fetchStatus($: EngineInterface, estimates: Map<number, number | undefined>): Promise<Status> {
  try {
    const [first] = list(await api($, 'projects/:id/merge_requests?source_branch=:branch&state=opened&order_by=updated_at&per_page=1'))
    if (first === undefined) return { kind: 'none' }
    const detail = record(await api($, `projects/:id/merge_requests/${Number(first.iid)}`)) ?? {}
    const mr: Mr = {
      iid: Number(detail.iid),
      title: text(detail.title) ?? '',
      webUrl: text(detail.web_url) ?? '',
      target: text(detail.target_branch) ?? '',
      isDraft: detail.draft === true,
    }
    const head = record(detail.head_pipeline)
    if (head === undefined) return { kind: 'mr', mr }

    const id = Number(head.id)
    const startedAt = text(head.started_at)
    const finishedAt = text(head.finished_at)
    const bare: Pipeline = {
      id,
      status: text(head.status) ?? '',
      webUrl: text(head.web_url) ?? '',
      createdAt: text(head.created_at) ?? '',
      ...(startedAt === undefined ? {} : { startedAt }),
      ...(finishedAt === undefined ? {} : { finishedAt }),
      jobs: [],
    }
    // The estimate shows only while the pipeline runs: fetched then, once, beside the jobs.
    const isEstimated = !estimates.has(id) && phaseOf(bare) === 'running'
    const [jobs, estimate] = await Promise.all([jobsOf($, id), isEstimated ? estimateFor($, id) : undefined])
    if (isEstimated) estimates.set(id, estimate)
    const pipeline: Pipeline = { ...bare, jobs }
    const estimateMs = estimates.get(id)

    return { kind: 'mr', mr: { ...mr, pipeline }, ...(estimateMs === undefined ? {} : { estimateMs }) }
  } catch (error) {
    return { kind: 'unavailable', reason: error instanceof Refused ? error.reason : 'error' }
  }
}

/** A job's raw log; undefined when glab does not hand it over. */
export async function fetchTrace($: EngineInterface, jobId: number): Promise<string | undefined> {
  return run($, `projects/:id/jobs/${jobId}/trace`).catch(() => undefined)
}

/** Opens a page in the default browser (macOS `open`). */
export async function openUrl($: EngineInterface, url: string): Promise<void> {
  await $.process.run(['open', url], { timeoutMs: TIMEOUT_MS })
}
