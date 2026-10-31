// GitHub through gh. gh resolves the repository from the working directory (`{owner}/{repo}`) and
// brings its own login, so the mod holds no token. The checks are those of one commit: the open
// pull request's head, else the tip the branch pushed to its upstream. Every check run and every
// commit status of it is one job; GitHub's answers become the plain values of `model.ts` here and
// nowhere else.

import type { EngineInterface, ProcessRunResult } from 'claude-code'

import { list, NOT_STARTED, out, record, Refused, text, TIMEOUT_MS } from '../cli'
import type { Raw } from '../cli'
import type { Change, Checks, Job, Status, Unavailable } from '../model'
import { isBlocking } from '../model'

// A refusal gh names, by its message; and the one that only says the branch has no pull request.
const NO_AUTH = /401|unauthori[sz]ed|not logged in|authenticat|gh auth login|bad credentials/i
const NO_PR = /no pull requests found/i

// The app whose check runs are GitHub Actions jobs, with a workflow and a log.
const ACTIONS = 'github-actions'

// A check run before it concludes, by its status; one that has, by its conclusion. A commit
// status by its state. Each as the job status `phaseOf` knows.
const RUN_STATUS: Record<string, string> = { queued: 'pending', requested: 'pending', pending: 'pending', in_progress: 'running', waiting: 'manual' }
const CONCLUSION: Record<string, string> = {
  success: 'success',
  neutral: 'skipped',
  skipped: 'skipped',
  failure: 'failed',
  timed_out: 'failed',
  action_required: 'failed',
  startup_failure: 'failed',
  cancelled: 'canceled',
  stale: 'canceled',
}
const STATE: Record<string, string> = { pending: 'running', success: 'success', failure: 'failed', error: 'failed' }

/**
 * Where the jobs of one commit stand together, first match wins: one that failed the checks, one
 * still moving, one waiting for approval, one passed (a cancelled one beside it was superseded),
 * else every one cancelled.
 */
export function aggregate(jobs: readonly Job[]): string {
  const has = (...statuses: string[]) => jobs.some(job => statuses.includes(job.status))
  if (jobs.some(isBlocking)) return 'failed'
  if (has('pending', 'running')) return 'running'
  if (has('manual')) return 'manual'
  if (has('success', 'skipped')) return 'success'

  return 'canceled'
}

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those.

/** What gh answers for `argv`, whatever its exit code; throws `Refused` when it does not run. */
async function run($: EngineInterface, argv: string[]): Promise<ProcessRunResult> {
  try {
    return await $.process.run(['gh', ...argv], { timeoutMs: TIMEOUT_MS })
  } catch (error) {
    throw new Refused(NOT_STARTED.test(String(error)) ? 'no-cli' : 'error')
  }
}

/** Why gh refused, by its message. */
function refusal(result: ProcessRunResult): Unavailable {
  return NO_AUTH.test(result.stderr) ? 'no-auth' : 'error'
}

/** The JSON gh answers for `argv`; throws `Refused` when there is none. */
async function json($: EngineInterface, argv: string[]): Promise<unknown> {
  const result = await run($, argv)
  if (result.exitCode !== 0) throw new Refused(refusal(result))
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Refused('error')
  }
}

/** The JSON gh answers for an API path; throws `Refused` when there is none. */
async function api($: EngineInterface, path: string): Promise<unknown> {
  return json($, ['api', path])
}

/** The branch's latest pull request; undefined when it has none. */
async function pullRequest($: EngineInterface): Promise<Raw | undefined> {
  const result = await run($, ['pr', 'view', '--json', 'number,title,url,baseRefName,isDraft,headRefOid,state'])
  if (result.exitCode !== 0) {
    if (NO_PR.test(result.stderr)) return undefined
    throw new Refused(refusal(result))
  }
  try {
    return record(JSON.parse(result.stdout))
  } catch {
    throw new Refused('error')
  }
}

// The repository's display name (`owner/repo`) and page for each working directory, fetched once.
const repos = new Map<string, { name: string; url: string }>()

/**
 * The repository's display name and page, fetched once per working directory. One that fails is
 * left empty, not the status, and asked again next time.
 */
async function repoOf($: EngineInterface): Promise<{ name: string; url: string }> {
  const cwd = await $.session.cwd().catch(() => '')
  const known = repos.get(cwd)
  if (known !== undefined) return known
  try {
    const found = record(await json($, ['repo', 'view', '--json', 'nameWithOwner,url']))
    const name = text(found?.nameWithOwner)
    const url = text(found?.url)
    if (name === undefined || url === undefined) return { name: '', url: '' }
    repos.set(cwd, { name, url })

    return { name, url }
  } catch {
    return { name: '', url: '' }
  }
}

// Each Actions check suite's workflow name, by the suite's id. A suite keeps its workflow, so once
// known it is never asked again.
const workflows = new Map<number, string>()

/**
 * Learns the workflow names of the suites among `runs` not known yet, in one call for the commit.
 * One that fails leaves them unknown, not the status, and asks again next time.
 */
async function learnWorkflows($: EngineInterface, sha: string, runs: readonly Raw[]): Promise<void> {
  const unknown = runs.some(one => text(record(one.app)?.slug) === ACTIONS && !workflows.has(Number(record(one.check_suite)?.id)))
  if (!unknown) return
  try {
    const found = record(await api($, `repos/{owner}/{repo}/actions/runs?head_sha=${sha}&per_page=100`))
    for (const one of list(found?.workflow_runs)) {
      const name = text(one.name)
      if (name !== undefined) workflows.set(Number(one.check_suite_id), name)
    }
  } catch {
    // Grouped by the app's name until the next fetch.
  }
}

const checkRun = (raw: Raw): Job => {
  const app = record(raw.app)
  const appName = text(app?.name) ?? text(app?.slug) ?? ''
  const isActions = text(app?.slug) === ACTIONS
  const conclusion = text(raw.conclusion) ?? ''
  const status = text(raw.status) === 'completed' ? (CONCLUSION[conclusion] ?? 'canceled') : (RUN_STATUS[text(raw.status) ?? ''] ?? 'pending')

  return {
    id: Number(raw.id),
    name: text(raw.name) ?? '',
    group: (isActions ? workflows.get(Number(record(raw.check_suite)?.id)) : undefined) ?? appName,
    status,
    allowFailure: status === 'skipped',
    hasLog: isActions,
  }
}

const commitStatus = (raw: Raw): Job => ({
  id: Number(raw.id),
  name: text(raw.context) ?? '',
  group: 'status',
  status: STATE[text(raw.state) ?? ''] ?? 'running',
  allowFailure: false,
  hasLog: false,
})

// An ISO time sorts as it reads, so the earliest and the latest are its first and last in order.
const times = (values: (string | undefined)[]): string[] => values.filter((one): one is string => one !== undefined && one !== '').sort()

/**
 * The checks of commit `sha`: its check runs, then its commit statuses; undefined when it has
 * neither. Their `webUrl` is left to the caller, which knows the page they show on.
 */
async function checksOf($: EngineInterface, sha: string): Promise<Omit<Checks, 'webUrl'> | undefined> {
  const [runsFound, statusesFound] = await Promise.all([
    api($, `repos/{owner}/{repo}/commits/${sha}/check-runs?per_page=100`),
    api($, `repos/{owner}/{repo}/commits/${sha}/status`),
  ])
  const runs = list(record(runsFound)?.check_runs)
  const statuses = list(record(statusesFound)?.statuses)
  if (runs.length === 0 && statuses.length === 0) return undefined
  await learnWorkflows($, sha, runs)
  const jobs = [...runs.map(checkRun), ...statuses.map(commitStatus)]
  const status = aggregate(jobs)
  const starts = times([...runs.map(one => text(one.started_at)), ...statuses.map(one => text(one.created_at))])
  const ends = times([
    ...runs.map(one => text(one.completed_at)),
    ...statuses.filter(one => text(one.state) !== 'pending').map(one => text(one.updated_at)),
  ])
  const startedAt = starts[0]
  const finishedAt = status === 'running' ? undefined : ends.at(-1)

  return {
    key: sha,
    status,
    createdAt: startedAt ?? '',
    ...(startedAt === undefined ? {} : { startedAt }),
    ...(finishedAt === undefined ? {} : { finishedAt }),
    jobs,
  }
}

/**
 * The open pull request whose head is the current branch, with its head commit's checks; else the
 * tip the branch pushed to its upstream, when that commit has any check. `estimates` keeps each
 * estimate by `Checks.key`, as on GitLab; GitHub's checks carry none yet.
 */
export async function fetchStatus($: EngineInterface, estimates: Map<string, number | undefined>): Promise<Status> {
  try {
    const pr = await pullRequest($)
    if (pr !== undefined && text(pr.state) === 'OPEN') {
      const sha = text(pr.headRefOid) ?? ''
      const number = Number(pr.number)
      const webUrl = text(pr.url) ?? ''
      const [repo, checks] = await Promise.all([repoOf($), sha === '' ? undefined : checksOf($, sha)])
      const change: Change = {
        ref: `#${number}`,
        number,
        title: text(pr.title) ?? '',
        webUrl,
        repo: repo.name,
        target: text(pr.baseRefName) ?? '',
        isDraft: pr.isDraft === true,
        ...(checks === undefined ? {} : { checks: { ...checks, webUrl: `${webUrl}/checks` } }),
      }

      return { kind: 'change', provider: 'github', change }
    }

    // No open pull request: the pushed tip, named by the branch. No upstream, no segment.
    const [branch, sha] = await Promise.all([out($, ['git', 'rev-parse', '--abbrev-ref', 'HEAD']), out($, ['git', 'rev-parse', '@{u}'])])
    if (branch === undefined || sha === undefined || sha === '') return { kind: 'none' }
    const [repo, checks] = await Promise.all([repoOf($), checksOf($, sha)])
    if (checks === undefined) return { kind: 'none' }
    const webUrl = repo.url === '' ? '' : `${repo.url}/commit/${sha}`

    return { kind: 'change', provider: 'github', change: { ref: branch, webUrl, repo: repo.name, isDraft: false, checks: { ...checks, webUrl } } }
  } catch (error) {
    return { kind: 'unavailable', provider: 'github', reason: error instanceof Refused ? error.reason : 'error' }
  }
}
