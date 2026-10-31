import { expect, test } from 'claude-code/testing'
import type { EngineInterface, ProcessRunResult } from 'claude-code'

import { fetchFailure, fetchStatus, openUrl } from '../hooks/glab'
import type { Pipeline } from '../hooks/model'

const MRS = 'glab api projects/:id/merge_requests?source_branch=:branch&state=opened&order_by=updated_at&per_page=1'
const MR = 'glab api projects/:id/merge_requests/12'
const JOBS = 'glab api projects/:id/pipelines/4711/jobs?per_page=100'
const BRIDGES = 'glab api projects/:id/pipelines/4711/bridges?per_page=100'
const GREEN = 'glab api projects/:id/pipelines?status=success&per_page=5'

type Answer = { exitCode?: number; stdout?: unknown; stderr?: string; isCut?: boolean } | 'missing' | 'hanging'

// The host beneath: each command line answers as the test sets it; an unset one exits 1. Every
// command line is recorded, with its options. A test's own `$` has no `process`: the module gets a
// `$` of its own carrying the one noun it uses.
const host = (answers: Record<string, Answer> | (() => Answer)) => {
  const calls: { line: string; timeoutMs?: number }[] = []
  const run = async (argv: readonly string[], init?: { timeoutMs?: number }): Promise<ProcessRunResult> => {
    const line = argv.join(' ')
    calls.push({ line, timeoutMs: init?.timeoutMs })
    const answer = typeof answers === 'function' ? answers() : (answers[line] ?? { exitCode: 1, stderr: 'unexpected call' })
    if (answer === 'missing') throw new Error('spawn glab ENOENT')
    if (answer === 'hanging') throw new Error('process.run: glab still running after 10000 ms')

    return {
      exitCode: answer.exitCode ?? 0,
      stdout: typeof answer.stdout === 'string' ? answer.stdout : JSON.stringify(answer.stdout ?? ''),
      stderr: answer.stderr ?? '',
      isStdoutTruncated: answer.isCut === true,
      isStderrTruncated: false,
    }
  }

  return { $: { process: { run } } as unknown as EngineInterface, calls }
}

const HEAD = {
  id: 4711,
  status: 'running',
  web_url: 'https://gitlab.example.com/group/project/-/pipelines/4711',
  created_at: '2026-10-29T09:59:50Z',
  started_at: '2026-10-29T10:00:00Z',
  finished_at: null,
}
const DETAIL = {
  iid: 12,
  title: 'Add the login form',
  web_url: 'https://gitlab.example.com/group/project/-/merge_requests/12',
  target_branch: 'main',
  draft: false,
  head_pipeline: HEAD,
}
const RUNNING = {
  [MRS]: { stdout: [{ iid: 12 }] },
  [MR]: { stdout: DETAIL },
  [JOBS]: {
    stdout: [
      { id: 1, name: 'build', stage: 'build', status: 'success', allow_failure: false },
      { id: 2, name: 'test:unit', stage: 'test', status: 'running', allow_failure: false },
    ],
  },
  [BRIDGES]: { stdout: [{ id: 3, name: 'deploy', stage: 'deploy', status: 'created', allow_failure: true }] },
  [GREEN]: {
    stdout: [
      { id: 4711, created_at: '2026-10-29T09:59:50Z', updated_at: '2026-10-29T10:01:00Z' },
      { id: 4700, created_at: '2026-10-28T10:00:00Z', updated_at: '2026-10-28T10:04:00Z' },
      { id: 4690, created_at: '2026-10-27T10:00:00Z', updated_at: '2026-10-27T10:06:00Z' },
    ],
  },
}

test('no open merge request for the branch', async () => {
  const { $ } = host({ [MRS]: { stdout: [] } })
  expect(await fetchStatus($, new Map())).toEqual({ kind: 'none' })
})

test('a merge request without a pipeline', async () => {
  const { $ } = host({ [MRS]: { stdout: [{ iid: 12 }] }, [MR]: { stdout: { ...DETAIL, head_pipeline: null } } })
  expect(await fetchStatus($, new Map())).toEqual({
    kind: 'mr',
    mr: {
      iid: 12,
      title: 'Add the login form',
      webUrl: 'https://gitlab.example.com/group/project/-/merge_requests/12',
      target: 'main',
      isDraft: false,
    },
  })
})

test('a running pipeline with its jobs, a bridge among them, and the estimate', async () => {
  const { $, calls } = host(RUNNING)
  const status = await fetchStatus($, new Map())
  expect(status.kind).toBe('mr')
  if (status.kind !== 'mr') return
  expect(status.mr.pipeline).toEqual({
    id: 4711,
    status: 'running',
    webUrl: 'https://gitlab.example.com/group/project/-/pipelines/4711',
    createdAt: '2026-10-29T09:59:50Z',
    startedAt: '2026-10-29T10:00:00Z',
    jobs: [
      { id: 1, name: 'build', stage: 'build', status: 'success', allowFailure: false },
      { id: 2, name: 'test:unit', stage: 'test', status: 'running', allowFailure: false },
      { id: 3, name: 'deploy', stage: 'deploy', status: 'created', allowFailure: true },
    ],
  })
  // The head pipeline itself does not count: (4 + 6) / 2 minutes.
  expect(status.estimateMs).toBe(300_000)
  expect(calls.every(call => call.timeoutMs === 10_000)).toBe(true)
})

test('the estimate is fetched once per pipeline', async () => {
  const { $, calls } = host(RUNNING)
  const estimates = new Map<number, number | undefined>()
  await fetchStatus($, estimates)
  const second = await fetchStatus($, estimates)
  expect(calls.filter(call => call.line === GREEN)).toHaveLength(1)
  expect(second.kind === 'mr' ? second.estimateMs : undefined).toBe(300_000)
})

test('glab missing, not logged in, not a GitLab project, or another failure', async () => {
  const cases: [Answer, string][] = [
    ['missing', 'no-glab'],
    // A slow network passes: the last state stays.
    ['hanging', 'error'],
    [{ exitCode: 1, stderr: 'glab: 401 Unauthorized' }, 'no-auth'],
    [{ exitCode: 1, stderr: 'You are not logged in to any GitLab hosts' }, 'no-auth'],
    [{ exitCode: 1, stderr: 'none of the git remotes configured for this repository point to a known GitLab host. Please use `glab auth login` to authenticate and configure a new host for glab.' }, 'not-gitlab'],
    [{ exitCode: 128, stderr: 'fatal: not a git repository (or any of the parent directories): .git' }, 'not-gitlab'],
    [{ exitCode: 1, stderr: 'glab: 500 Internal Server Error' }, 'error'],
    [{ stdout: 'not json' }, 'error'],
  ]
  let answer: Answer = 'missing'
  const { $ } = host(() => answer)
  for (const [next, reason] of cases) {
    answer = next
    expect(await fetchStatus($, new Map())).toEqual({ kind: 'unavailable', reason })
  }
})

test('a failed estimate leaves the estimate out, not the pipeline', async () => {
  const { $ } = host({ ...RUNNING, [GREEN]: { exitCode: 1, stderr: 'glab: 500 Internal Server Error' } })
  const status = await fetchStatus($, new Map())
  expect(status.kind).toBe('mr')
  expect(status.kind === 'mr' ? status.mr.pipeline?.jobs.length : 0).toBe(3)
  expect(status.kind === 'mr' ? status.estimateMs : 0).toBeUndefined()
})

const failing = (jobs: Pipeline['jobs']): Pipeline => ({
  id: 4711,
  status: 'failed',
  webUrl: 'https://gitlab.example.com/group/project/-/pipelines/4711',
  createdAt: '2026-10-29T09:59:50Z',
  jobs,
})
const UNIT = { id: 2, name: 'test:unit', stage: 'test', status: 'failed', allowFailure: false }
const BRIDGE = { id: 3, name: 'deploy', stage: 'deploy', status: 'failed', allowFailure: false, downstream: { project: 77, pipeline: 900 } }

test("a failed job's log, none when glab refuses it", async () => {
  const { $ } = host({
    'glab api projects/:id/jobs/2/trace': { stdout: 'ERROR: boom\n' },
  })
  expect(await fetchFailure($, failing([UNIT]))).toEqual({ job: UNIT, trace: 'ERROR: boom\n', isCut: false })
  expect(await fetchFailure(host({}).$, failing([UNIT]))).toBeUndefined()
})

test('a job of its own goes before a failed bridge', async () => {
  const { $ } = host({ 'glab api projects/:id/jobs/2/trace': { stdout: 'ERROR: boom\n' } })
  expect((await fetchFailure($, failing([BRIDGE, UNIT])))?.job.name).toBe('test:unit')
})

test('a failed bridge leads to the first failed job of its downstream pipeline', async () => {
  const { $ } = host({
    'glab api projects/77/pipelines/900/jobs?per_page=100': {
      stdout: [
        { id: 51, name: 'smoke', stage: 'verify', status: 'success', allow_failure: false },
        { id: 52, name: 'e2e', stage: 'verify', status: 'failed', allow_failure: false },
      ],
    },
    'glab api projects/77/jobs/52/trace': { stdout: 'FAILED e2e\n', isCut: true },
  })
  expect(await fetchFailure($, failing([BRIDGE]))).toEqual({
    job: { id: 52, name: 'e2e', stage: 'verify', status: 'failed', allowFailure: false },
    trace: 'FAILED e2e\n',
    isCut: true,
  })
})

test("a bridge's downstream pipeline comes from GitLab's answer", async () => {
  const { $ } = host({
    ...RUNNING,
    [BRIDGES]: {
      stdout: [
        { id: 3, name: 'deploy', stage: 'deploy', status: 'failed', allow_failure: false, downstream_pipeline: { id: 900, project_id: 77 } },
      ],
    },
  })
  const status = await fetchStatus($, new Map())
  expect(status.kind === 'mr' ? status.mr.pipeline?.jobs.at(-1)?.downstream : undefined).toEqual({ project: 77, pipeline: 900 })
})

test('a merge request opens in the browser', async () => {
  const { $, calls } = host({ 'open https://gitlab.example.com/group/project/-/merge_requests/12': {} })
  await openUrl($, 'https://gitlab.example.com/group/project/-/merge_requests/12')
  expect(calls.map(call => call.line)).toEqual(['open https://gitlab.example.com/group/project/-/merge_requests/12'])
})
