// GitLab through glab. glab resolves the project and the branch from the repository (`:id`,
// `:branch`) and brings its own login, so the mod holds no token. GitLab's snake_case answers
// become the plain values of `model.ts` here and nowhere else.

import type { EngineInterface } from 'claude-code'

import type { Change, Checks, Job, Status, Unavailable } from '../model'
import { isBlocking, meanMs, phaseOf } from '../model'
import type { Failure } from '../provider'
import { TIMEOUT_MS } from '../provider'

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

/**
 * What glab writes for an API path, and whether it was cut at the read limit; throws `Refused`
 * with the reason when it does not answer.
 */
async function run($: EngineInterface, path: string): Promise<{ stdout: string; isCut: boolean }> {
  let result
  try {
    result = await $.process.run(['glab', 'api', path], { timeoutMs: TIMEOUT_MS })
  } catch (error) {
    throw new Refused(NOT_STARTED.test(String(error)) ? 'no-cli' : 'error')
  }
  if (result.exitCode !== 0) {
    throw new Refused(NOT_GITLAB.test(result.stderr) ? 'no-host' : NO_AUTH.test(result.stderr) ? 'no-auth' : 'error')
  }

  return { stdout: result.stdout, isCut: result.isStdoutTruncated }
}

/** The JSON glab answers for an API path; throws `Refused` when there is none. */
async function api($: EngineInterface, path: string): Promise<unknown> {
  const { stdout } = await run($, path)
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

const job = (raw: Raw): Job => {
  const downstream = record(raw.downstream_pipeline)

  return {
    id: Number(raw.id),
    name: text(raw.name) ?? '',
    group: text(raw.stage) ?? '',
    status: text(raw.status) ?? '',
    allowFailure: raw.allow_failure === true,
    hasLog: true,
    ...(downstream === undefined ? {} : { downstream: { project: Number(downstream.project_id), pipeline: Number(downstream.id) } }),
  }
}

/** The jobs of a pipeline and its bridges to downstream pipelines, each bridge one job. */
async function jobsOf($: EngineInterface, id: number): Promise<Job[]> {
  const [jobs, bridges] = await Promise.all([
    api($, `projects/:id/pipelines/${id}/jobs?per_page=100`),
    api($, `projects/:id/pipelines/${id}/bridges?per_page=100`),
  ])

  // A bridge has no log of its own, with or without a downstream pipeline: its jobs have.
  return [...list(jobs).map(job), ...list(bridges).map(one => ({ ...job(one), hasLog: false }))]
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

// The project's display name (`group/project`) for each working directory, fetched once.
const repos = new Map<string, string>()

/**
 * The project's display name, fetched once per working directory. One that fails is left empty,
 * not the status, and asked again next time.
 */
async function repoOf($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd().catch(() => '')
  const known = repos.get(cwd)
  if (known !== undefined) return known
  try {
    const name = text(record(await api($, 'projects/:id'))?.path_with_namespace)
    if (name === undefined) return ''
    repos.set(cwd, name)

    return name
  } catch {
    return ''
  }
}

/**
 * The open merge request whose source is the current branch, with its head pipeline and the
 * estimate. `estimates` keeps each pipeline's estimate across calls, so it is fetched once.
 */
export async function fetchStatus($: EngineInterface, estimates: Map<string, number | undefined>): Promise<Status> {
  try {
    const [first] = list(await api($, 'projects/:id/merge_requests?source_branch=:branch&state=opened&order_by=updated_at&per_page=1'))
    if (first === undefined) return { kind: 'none' }
    const [found, repo] = await Promise.all([api($, `projects/:id/merge_requests/${Number(first.iid)}`), repoOf($)])
    const detail = record(found) ?? {}
    const iid = Number(detail.iid)
    const change: Change = {
      ref: `!${iid}`,
      number: iid,
      title: text(detail.title) ?? '',
      webUrl: text(detail.web_url) ?? '',
      repo,
      target: text(detail.target_branch) ?? '',
      isDraft: detail.draft === true,
    }
    const head = record(detail.head_pipeline)
    if (head === undefined) return { kind: 'change', provider: 'gitlab', change }

    const id = Number(head.id)
    const key = String(id)
    const startedAt = text(head.started_at)
    const finishedAt = text(head.finished_at)
    const bare: Checks = {
      key,
      status: text(head.status) ?? '',
      webUrl: text(head.web_url) ?? '',
      createdAt: text(head.created_at) ?? '',
      ...(startedAt === undefined ? {} : { startedAt }),
      ...(finishedAt === undefined ? {} : { finishedAt }),
      jobs: [],
    }
    // The estimate shows only while the pipeline runs: fetched then, once, beside the jobs. One
    // that fails leaves the estimate out and is asked again next time.
    const isEstimated = !estimates.has(key) && phaseOf(bare) === 'running'
    const [jobs, estimate] = await Promise.all([
      jobsOf($, id),
      isEstimated ? estimateFor($, id).then(ms => ({ ms }), () => undefined) : undefined,
    ])
    if (estimate !== undefined) estimates.set(key, estimate.ms)
    const checks: Checks = { ...bare, jobs }
    const estimateMs = estimates.get(key)

    return { kind: 'change', provider: 'gitlab', change: { ...change, checks }, ...(estimateMs === undefined ? {} : { estimateMs }) }
  } catch (error) {
    return { kind: 'unavailable', provider: 'gitlab', reason: error instanceof Refused ? error.reason : 'error' }
  }
}

/**
 * The job that failed the pipeline, with its log: a job of its own first; else a failed bridge's
 * downstream pipeline, one level down, and its first failed job. Undefined when glab hands none over.
 */
export async function fetchFailure($: EngineInterface, checks: Checks): Promise<Failure | undefined> {
  try {
    const own = checks.jobs.find(one => isBlocking(one) && one.downstream === undefined)
    if (own !== undefined) {
      const { stdout, isCut } = await run($, `projects/:id/jobs/${own.id}/trace`)

      return { job: own, trace: stdout, isCut }
    }
    const downstream = checks.jobs.find(one => isBlocking(one) && one.downstream !== undefined)?.downstream
    if (downstream === undefined) return undefined
    const failed = list(await api($, `projects/${downstream.project}/pipelines/${downstream.pipeline}/jobs?per_page=100`))
      .map(job)
      .find(isBlocking)
    if (failed === undefined) return undefined
    const { stdout, isCut } = await run($, `projects/${downstream.project}/jobs/${failed.id}/trace`)

    return { job: failed, trace: stdout, isCut }
  } catch {
    return undefined
  }
}
