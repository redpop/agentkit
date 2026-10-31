import { expect, test } from 'claude-code/testing'
import type { EngineInterface, ProcessRunResult } from 'claude-code'

import type { Job } from '../hooks/model'
import { fetchStatus } from '../hooks/provider'
import { aggregate } from '../hooks/providers/github'

const SHA = '0a1b2c3d4e5f60718293a4b5c6d7e8f901234567'
const PR = 'gh pr view --json number,title,url,baseRefName,isDraft,headRefOid,state'
const REPO = 'gh repo view --json nameWithOwner,url'
const BRANCH = 'git rev-parse --abbrev-ref HEAD'
const UPSTREAM = 'git rev-parse @{u}'
const RUNS = `gh api repos/{owner}/{repo}/commits/${SHA}/check-runs?per_page=100`
const STATUSES = `gh api repos/{owner}/{repo}/commits/${SHA}/status`
const WORKFLOWS = `gh api repos/{owner}/{repo}/actions/runs?head_sha=${SHA}&per_page=100`

type Answer = { exitCode?: number; stdout?: unknown; stderr?: string } | 'missing' | 'hanging'

// The host beneath: each command line answers as the test sets it; an unset one exits 1. Every
// command line is recorded, with its options. A test's own `$` has no `process`: the module gets a
// `$` of its own carrying the nouns it uses, in the working directory `cwd`.
const host = (answers: Record<string, Answer> | ((line: string) => Answer), cwd = '/repo') => {
  const calls: { line: string; timeoutMs?: number }[] = []
  const run = async (argv: readonly string[], init?: { timeoutMs?: number }): Promise<ProcessRunResult> => {
    const line = argv.join(' ')
    calls.push({ line, timeoutMs: init?.timeoutMs })
    const answer = typeof answers === 'function' ? answers(line) : (answers[line] ?? { exitCode: 1, stderr: 'unexpected call' })
    if (answer === 'missing') throw new Error(`spawn ${argv[0]} ENOENT`)
    if (answer === 'hanging') throw new Error(`process.run: ${argv[0]} still running after 10000 ms`)

    return {
      exitCode: answer.exitCode ?? 0,
      stdout: typeof answer.stdout === 'string' ? answer.stdout : JSON.stringify(answer.stdout ?? ''),
      stderr: answer.stderr ?? '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    }
  }

  return { $: { process: { run }, session: { cwd: async () => cwd } } as unknown as EngineInterface, calls }
}

const one = (status: string, allowFailure = false): Job => ({ id: 1, name: 'job', group: 'g', status, allowFailure, hasLog: true })

test('aggregate: failed, then running, then manual, then success, then canceled', () => {
  const cases: [Job[], string][] = [
    [[one('failed'), one('running')], 'failed'],
    [[one('running'), one('manual')], 'running'],
    [[one('manual'), one('success')], 'manual'],
    [[one('canceled'), one('success')], 'success'],
    [[one('canceled')], 'canceled'],
    [[one('skipped', true)], 'success'],
  ]
  for (const [jobs, status] of cases) expect(aggregate(jobs)).toBe(status)
})

const OPEN = {
  number: 12,
  title: 'Add the login form',
  url: 'https://github.example.com/owner/repo/pull/12',
  baseRefName: 'main',
  isDraft: false,
  headRefOid: SHA,
  state: 'OPEN',
}
const REPOSITORY = { nameWithOwner: 'owner/repo', url: 'https://github.example.com/owner/repo' }
const ACTIONS = { slug: 'github-actions', name: 'GitHub Actions' }
const CHECK_RUNS = {
  total_count: 2,
  check_runs: [
    {
      id: 101,
      name: 'lint',
      status: 'completed',
      conclusion: 'success',
      started_at: '2026-10-29T10:00:00Z',
      completed_at: '2026-10-29T10:01:00Z',
      app: ACTIONS,
      check_suite: { id: 900 },
    },
    {
      id: 102,
      name: 'test',
      status: 'in_progress',
      conclusion: null,
      started_at: '2026-10-29T10:00:05Z',
      completed_at: null,
      app: ACTIONS,
      check_suite: { id: 900 },
    },
  ],
}
const NO_STATUSES = { state: 'pending', total_count: 0, statuses: [] }
const RAN = { total_count: 1, workflow_runs: [{ id: 7001, name: 'check', check_suite_id: 900 }] }
const RUNNING = {
  [PR]: { stdout: OPEN },
  [REPO]: { stdout: REPOSITORY },
  [RUNS]: { stdout: CHECK_RUNS },
  [STATUSES]: { stdout: NO_STATUSES },
  [WORKFLOWS]: { stdout: RAN },
}

test('an open PR with running Actions checks', async () => {
  const { $, calls } = host(RUNNING)
  expect(await fetchStatus($, 'github', new Map())).toEqual({
    kind: 'change',
    provider: 'github',
    change: {
      ref: '#12',
      number: 12,
      title: 'Add the login form',
      webUrl: 'https://github.example.com/owner/repo/pull/12',
      repo: 'owner/repo',
      target: 'main',
      isDraft: false,
      checks: {
        key: SHA,
        status: 'running',
        webUrl: 'https://github.example.com/owner/repo/pull/12/checks',
        createdAt: '2026-10-29T10:00:00Z',
        startedAt: '2026-10-29T10:00:00Z',
        jobs: [
          { id: 101, name: 'lint', group: 'check', status: 'success', allowFailure: false, hasLog: true },
          { id: 102, name: 'test', group: 'check', status: 'running', allowFailure: false, hasLog: true },
        ],
      },
    },
  })
  expect(calls.every(call => call.timeoutMs === 10_000)).toBe(true)
  // A pull request names its own commit: the branch and its upstream are not asked.
  expect(calls.some(call => call.line.startsWith('git '))).toBe(false)
})

test("a workflow's name is fetched once per check suite", async () => {
  // A suite of its own: the names are kept across tests.
  const { $, calls } = host({
    ...RUNNING,
    [RUNS]: { stdout: { check_runs: CHECK_RUNS.check_runs.map(one => ({ ...one, check_suite: { id: 902 } })) } },
    [WORKFLOWS]: { stdout: { workflow_runs: [{ id: 7002, name: 'release', check_suite_id: 902 }] } },
  })
  await fetchStatus($, 'github', new Map())
  const second = await fetchStatus($, 'github', new Map())
  expect(calls.filter(call => call.line === WORKFLOWS)).toHaveLength(1)
  expect(second.kind === 'change' ? second.change.checks?.jobs.map(job => job.group) : undefined).toEqual(['release', 'release'])
})

test('a failed workflow lookup leaves the app name as the group, not the status', async () => {
  const { $ } = host({ ...RUNNING, [RUNS]: { stdout: { check_runs: [{ ...CHECK_RUNS.check_runs[0], check_suite: { id: 901 } }] } }, [WORKFLOWS]: { exitCode: 1, stderr: 'HTTP 502' } })
  const status = await fetchStatus($, 'github', new Map())
  expect(status.kind === 'change' ? status.change.checks?.jobs.map(job => job.group) : undefined).toEqual(['GitHub Actions'])
})

test('a pull request without any check', async () => {
  const { $ } = host({ ...RUNNING, [RUNS]: { stdout: { total_count: 0, check_runs: [] } } })
  const status = await fetchStatus($, 'github', new Map())
  expect(status.kind).toBe('change')
  expect(status.kind === 'change' ? status.change.checks : null).toBeUndefined()
})

const TIP = {
  [PR]: { exitCode: 1, stderr: 'no pull requests found for branch "main"' },
  [BRANCH]: { stdout: 'main\n' },
  [UPSTREAM]: { stdout: `${SHA}\n` },
  [REPO]: { stdout: REPOSITORY },
  [RUNS]: { stdout: CHECK_RUNS },
  [STATUSES]: { stdout: NO_STATUSES },
  [WORKFLOWS]: { stdout: RAN },
}

test('a merged PR falls back to the branch tip', async () => {
  const { $ } = host({ ...TIP, [PR]: { stdout: { ...OPEN, state: 'MERGED' } } })
  const status = await fetchStatus($, 'github', new Map())
  expect(status.kind === 'change' ? status.change.ref : undefined).toBe('main')
})

test('no PR, pushed branch with checks', async () => {
  const { $ } = host(TIP)
  const status = await fetchStatus($, 'github', new Map())
  expect(status.kind).toBe('change')
  if (status.kind !== 'change') return
  expect(status.provider).toBe('github')
  expect(status.change).toEqual({
    ref: 'main',
    webUrl: `https://github.example.com/owner/repo/commit/${SHA}`,
    repo: 'owner/repo',
    isDraft: false,
    checks: { ...status.change.checks, webUrl: `https://github.example.com/owner/repo/commit/${SHA}` },
  })
  expect(status.change.webUrl.endsWith(`/commit/${SHA}`)).toBe(true)
  expect(status.change.checks?.jobs).toHaveLength(2)
})

test('no PR, tip without any check', async () => {
  const { $ } = host({ ...TIP, [RUNS]: { stdout: { total_count: 0, check_runs: [] } } })
  expect(await fetchStatus($, 'github', new Map())).toEqual({ kind: 'none' })
})

test('no upstream and no PR', async () => {
  const { $, calls } = host({
    ...TIP,
    [UPSTREAM]: { exitCode: 128, stderr: "fatal: no upstream configured for branch 'main'" },
  })
  expect(await fetchStatus($, 'github', new Map())).toEqual({ kind: 'none' })
  expect(calls.some(call => call.line.startsWith('gh api '))).toBe(false)
})

test('gh missing, not logged in, or another failure', async () => {
  const cases: [Answer, string][] = [
    ['missing', 'no-cli'],
    // A slow network passes: the last state stays.
    ['hanging', 'error'],
    [{ exitCode: 1, stderr: 'HTTP 401: Bad credentials (https://api.github.com/graphql)' }, 'no-auth'],
    [{ exitCode: 4, stderr: 'To get started with GitHub CLI, please run:  gh auth login' }, 'no-auth'],
    [{ exitCode: 1, stderr: 'You are not logged into any GitHub hosts. To log in, run: gh auth login' }, 'no-auth'],
    [{ exitCode: 1, stderr: 'HTTP 502: Bad Gateway' }, 'error'],
    [{ stdout: 'not json' }, 'error'],
  ]
  let answer: Answer = 'missing'
  const { $ } = host(() => answer)
  for (const [next, reason] of cases) {
    answer = next
    expect(await fetchStatus($, 'github', new Map())).toEqual({ kind: 'unavailable', provider: 'github', reason })
  }
})

test('a CodeRabbit-style commit status counts as a job with hasLog false, group status', async () => {
  const { $ } = host({
    ...RUNNING,
    [STATUSES]: {
      stdout: {
        state: 'pending',
        total_count: 1,
        statuses: [
          {
            id: 55,
            context: 'CodeRabbit',
            state: 'pending',
            created_at: '2026-10-29T09:59:00Z',
            updated_at: '2026-10-29T09:59:30Z',
          },
        ],
      },
    },
  })
  const status = await fetchStatus($, 'github', new Map())
  const checks = status.kind === 'change' ? status.change.checks : undefined
  expect(checks?.jobs).toHaveLength(3)
  expect(checks?.jobs.at(-1)).toEqual({ id: 55, name: 'CodeRabbit', group: 'status', status: 'running', allowFailure: false, hasLog: false })
  // The earliest start among check runs and statuses alike.
  expect(checks?.createdAt).toBe('2026-10-29T09:59:00Z')
})

const run = (id: number, status: string, conclusion: string | null, app = ACTIONS) => ({
  id,
  name: `run-${id}`,
  status,
  conclusion,
  started_at: '2026-10-29T10:00:00Z',
  completed_at: status === 'completed' ? `2026-10-29T10:0${id % 10}:00Z` : null,
  app,
  check_suite: { id: 900 },
})

test("each check run's and status's state becomes a job status", async () => {
  const runs = [
    run(1, 'queued', null),
    run(2, 'requested', null),
    run(3, 'pending', null),
    run(4, 'in_progress', null),
    run(5, 'waiting', null),
    run(6, 'completed', 'success'),
    run(7, 'completed', 'neutral'),
    run(8, 'completed', 'skipped'),
    run(9, 'completed', 'failure'),
    run(10, 'completed', 'timed_out'),
    run(11, 'completed', 'action_required'),
    run(12, 'completed', 'startup_failure'),
    run(13, 'completed', 'cancelled'),
    run(14, 'completed', 'stale'),
    run(15, 'completed', 'success', { slug: 'some-app', name: 'Some App' }),
  ]
  const statuses = ['pending', 'success', 'failure', 'error'].map((state, index) => ({
    id: 60 + index,
    context: `ctx-${state}`,
    state,
    created_at: '2026-10-29T10:00:00Z',
    updated_at: '2026-10-29T10:00:00Z',
  }))
  const { $ } = host({ ...RUNNING, [RUNS]: { stdout: { check_runs: runs } }, [STATUSES]: { stdout: { statuses } } })
  const status = await fetchStatus($, 'github', new Map())
  const jobs = status.kind === 'change' ? (status.change.checks?.jobs ?? []) : []
  expect(jobs.map(job => job.status)).toEqual([
    'pending', 'pending', 'pending', 'running', 'manual', 'success', 'skipped', 'skipped',
    'failed', 'failed', 'failed', 'failed', 'canceled', 'canceled', 'success',
    'running', 'success', 'failed', 'failed',
  ])
  expect(jobs.filter(job => job.allowFailure).map(job => job.id)).toEqual([7, 8])
  // A check run from outside Actions is grouped by its app and has no log to read.
  expect(jobs[14]).toEqual({ id: 15, name: 'run-15', group: 'Some App', status: 'success', allowFailure: false, hasLog: false })
})

test('settled checks finish at the latest completion', async () => {
  const runs = [run(1, 'completed', 'success'), run(4, 'completed', 'failure'), run(2, 'completed', 'cancelled')]
  const { $ } = host({ ...RUNNING, [RUNS]: { stdout: { check_runs: runs } } })
  const status = await fetchStatus($, 'github', new Map())
  const checks = status.kind === 'change' ? status.change.checks : undefined
  expect(checks?.status).toBe('failed')
  expect(checks?.finishedAt).toBe('2026-10-29T10:04:00Z')
})
