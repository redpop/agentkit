import { expect, mock, test } from 'claude-code/testing'
import type { EngineInterface, On, Register } from 'claude-code'
import type { Engine } from 'claude-code/testing'

// The pipeline started 10:00:00; the clock reads 3:12 later.
const NOW = Date.parse('2026-10-29T10:03:12Z')

const MRS = 'glab api projects/:id/merge_requests?source_branch=:branch&state=opened&order_by=updated_at&per_page=1'
const MR = 'glab api projects/:id/merge_requests/12'
const JOBS = 'glab api projects/:id/pipelines/4711/jobs?per_page=100'
const BRIDGES = 'glab api projects/:id/pipelines/4711/bridges?per_page=100'
const GREEN = 'glab api projects/:id/pipelines?status=success&per_page=5'
const TRACE = 'glab api projects/:id/jobs/2/trace'
const REPO = 'glab api projects/:id'
// The remote the repository has: a host gh is not logged in to, so GitLab.
const REMOTE: Record<string, Answer> = {
  'git rev-parse --abbrev-ref --symbolic-full-name @{u}': { exitCode: 128 },
  'git remote': { stdout: 'origin' },
  'git remote get-url origin': { stdout: 'https://gitlab.example.com/group/project.git' },
  'gh auth status --hostname gitlab.example.com': { exitCode: 1 },
}

type Answer = { exitCode?: number; stdout?: unknown; stderr?: string }

const jobs = (statuses: string[]) =>
  statuses.map((status, at) => ({ id: at + 1, name: at === 1 ? 'test:unit' : `job-${at + 1}`, stage: at === 0 ? 'build' : 'test', status, allow_failure: false }))

// GitLab with merge request !12 and its head pipeline 4711 in a status, finished at `finished`.
const gitlab = (status: string | undefined, statuses: string[] = [], finished?: string): Record<string, Answer> => ({
  [MRS]: { stdout: [{ iid: 12 }] },
  [REPO]: { stdout: { path_with_namespace: 'group/project' } },
  [MR]: {
    stdout: {
      iid: 12,
      title: 'Add the login form',
      web_url: 'https://gitlab.example.com/group/project/-/merge_requests/12',
      target_branch: 'main',
      draft: false,
      head_pipeline:
        status === undefined
          ? null
          : {
              id: 4711,
              status,
              web_url: 'https://gitlab.example.com/group/project/-/pipelines/4711',
              created_at: '2026-10-29T09:59:50Z',
              started_at: '2026-10-29T10:00:00Z',
              finished_at: finished ?? null,
            },
    },
  },
  [JOBS]: { stdout: jobs(statuses) },
  [BRIDGES]: { stdout: [] },
  [GREEN]: {
    stdout: [
      { id: 4700, created_at: '2026-10-28T10:00:00Z', updated_at: '2026-10-28T10:04:00Z' },
      { id: 4690, created_at: '2026-10-27T10:00:00Z', updated_at: '2026-10-27T10:06:00Z' },
    ],
  },
})

const RUNNING = gitlab('running', ['success', 'success', 'success', 'success', 'running', 'created', 'created'])
const FAILED = gitlab('failed', ['success', 'failed', 'skipped'], '2026-10-29T10:02:48Z')
const SUCCESS = gitlab('success', ['success', 'success'], '2026-10-29T10:04:51Z')

// GitHub with pull request #12 on owner/repo, or without one the tip of main, and the check runs
// of its head commit.
const SHA = '0a1b2c3d4e5f60718293a4b5c6d7e8f901234567'
const PR_VIEW = 'gh pr view --json number,title,url,baseRefName,isDraft,headRefOid,state'
const checkRun = (id: number, name: string, status: string, conclusion?: string, completed?: string) => ({
  id,
  name,
  status,
  conclusion: conclusion ?? null,
  started_at: '2026-10-29T10:00:00Z',
  completed_at: completed ?? null,
  app: { slug: 'github-actions', name: 'GitHub Actions' },
  check_suite: { id: 930 },
})
const github = (runs: object[], { isTip = false } = {}): Record<string, Answer> => ({
  'git remote get-url origin': { stdout: 'https://github.com/owner/repo.git' },
  [PR_VIEW]: isTip
    ? { exitCode: 1, stderr: 'no pull requests found for branch "main"' }
    : {
        stdout: { number: 12, title: 'Add the login form', url: 'https://github.com/owner/repo/pull/12', baseRefName: 'main', isDraft: false, headRefOid: SHA, state: 'OPEN' },
      },
  'git rev-parse --abbrev-ref --symbolic-full-name @{u}': { stdout: 'origin/main' },
  'git remote': { stdout: 'origin' },
  'git rev-parse @{u}': { stdout: SHA },
  'gh repo view --json nameWithOwner,url': { stdout: { nameWithOwner: 'owner/repo', url: 'https://github.com/owner/repo' } },
  [`gh api repos/{owner}/{repo}/commits/${SHA}/check-runs?per_page=100`]: { stdout: { check_runs: runs } },
  [`gh api repos/{owner}/{repo}/commits/${SHA}/status?per_page=100`]: { stdout: { statuses: [] } },
  [`gh api repos/{owner}/{repo}/actions/runs?head_sha=${SHA}&per_page=100`]: { stdout: { workflow_runs: [{ name: 'check', check_suite_id: 930 }] } },
  'gh run list --workflow check --status success --limit 5 --json databaseId,createdAt,updatedAt,headSha': { stdout: [] },
})
const GH_RUNNING = [checkRun(1, 'markdownlint', 'in_progress'), checkRun(2, 'tests', 'in_progress')]
const GH_SUCCESS = [
  checkRun(1, 'markdownlint', 'completed', 'success', '2026-10-29T10:02:00Z'),
  checkRun(2, 'tests', 'completed', 'success', '2026-10-29T10:04:51Z'),
]

// The engine beneath the plugin: the clock, glab as the test sets GitLab, the toasts, and the
// prompt box with a draft.
const engine = (on: On, { draft = '', isFilled = true, clipboard = true } = {}) => {
  const clock = mock.clock(on, { now: NOW })
  // The texts are German: the strings the spec fixes.
  mock.env(on, { LANG: 'de_DE.UTF-8' })
  const toasts: string[] = []
  const fills: { text: string; mode?: string }[] = []
  const runs: string[] = []
  const copied: string[] = []
  let answers: Record<string, Answer> = {}
  on('process.run', (_, e) => {
    const line = e.argv.join(' ')
    runs.push(line)
    const answer = answers[line] ?? REMOTE[line] ?? (line.startsWith('open ') ? {} : { exitCode: 1, stderr: 'unexpected call' })

    return {
      value: {
        exitCode: answer.exitCode ?? 0,
        stdout: typeof answer.stdout === 'string' ? answer.stdout : JSON.stringify(answer.stdout ?? ''),
        stderr: answer.stderr ?? '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.copy', (_, e) => {
    if (!clipboard) return { value: { isCopied: false, reason: 'no-clipboard' } }
    copied.push(e.text)

    return { value: { isCopied: true } }
  })
  on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }))
  on('prompt.fill', (_, e) => {
    fills.push({ text: e.text, mode: e.mode })

    return { isFilled }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('turn.complete', () => ({ text: 'hi' }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: 'ok' }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  return { clock, toasts, fills, runs, copied, set: (next: Record<string, Answer>) => (answers = next) }
}

type Segment = Parameters<EngineInterface['mods']['segment']>[0]

const SEGMENT = 'segment '

// ak-mods cannot be loaded here, so a plugin above the mod stands in for it, as in ak-usage's
// tests: declaring switches the mod on, and each published segment comes out as a toast.
const owner: Register = on => {
  on('engine.create', async ($, e, next) => {
    const built = await next(e)
    const set = async ({ name, on: isOn }: { name: string; on: boolean }) => {
      const held = await built.state.get({ plugin: 'ak-mods', key: 'on' })
      await built.state.set({ plugin: 'ak-mods', key: 'on' }, { ...held.value, [name]: isOn })
      if (!isOn) await built.ui.toast('segment null')
    }

    return {
      ...built,
      mods: {
        declare: async ({ name }: { name: string }) => {
          await set({ name, on: true })

          return true
        },
        isOn: async ({ name }: { name: string }) =>
          (await built.state.get({ plugin: 'ak-mods', key: 'on' })).value?.[name] === true,
        set,
        setStandard: async () => {},
        move: async () => {},
        resetOrder: async () => {},
        isOrderMoved: async () => false,
        list: async () => [],
        segment: async (segment: Segment) => {
          await built.ui.toast('segment ' + JSON.stringify(typeof segment?.text === 'string' ? segment : null))
        },
      },
    }
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'stand-in', description: 'Controls the ak-mods stand-in', immediate: true })

    return next(e)
  })
  on('command.run', { command: 'stand-in' }, async ($, e) => {
    await $.mods.set({ name: 'ak-ci', on: e.args === 'on' })

    return {}
  })
}

const OWNED = { plugins: [{ name: 'ak-mods', tier: 'prepend', register: owner }] } as const

const segments = (toasts: string[]): Segment[] =>
  toasts.filter(t => t.startsWith(SEGMENT)).map(t => JSON.parse(t.slice(SEGMENT.length)) ?? undefined)
const plain = (toasts: string[]) => toasts.filter(t => !t.startsWith(SEGMENT))

const start = ($: Engine) => $.session.start({ cwd: '/', surface: null, isInteractive: false })
const turn = ($: Engine, agentId?: string) =>
  $.turn.complete({ turnId: 'T1', reason: 'answer', answer: 'hi', durationMs: 1, isAborted: false, ...(agentId ? { agentId } : {}) })
const run = ($: Engine, command: string, args = '') =>
  $.command.run({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
const bash = ($: Engine, command: string) => $.tool.call({ tool: 'Bash', command })
const standIn = ($: Engine, args: 'on' | 'off') => run($, 'stand-in', args)
// The fetches made: the first call of each.
const fetches = (runs: string[], call = MRS) => runs.filter(line => line === call).length

test('no segment outside GitLab', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set({ [MRS]: { exitCode: 1, stderr: 'none of the git remotes configured for this repository point to a known GitLab host. Please use `glab auth login` to authenticate and configure a new host for glab.' } })
  await start($)
  await clock.settle()
  expect(segments(toasts).filter(one => one !== undefined)).toEqual([])
  expect(plain(toasts)).toEqual([])
})

test('a running pipeline shows in the band and is fetched every 15 seconds', OWNED, async ($, on) => {
  const { clock, toasts, runs, set } = engine(on)
  set(RUNNING)
  await start($)
  await clock.settle()
  expect(segments(toasts).at(-1)).toMatchObject({ text: '!12 4/7 3:12/~5m', tone: 'info' })
  expect(segments(toasts).at(-1)?.card?.[0]).toEqual({ label: 'Änderung', value: 'group/project !12 Add the login form' })

  // The elapsed time moves without a fetch.
  const before = fetches(runs)
  await clock.advance(5_000)
  expect(fetches(runs)).toBe(before)
  expect(segments(toasts).at(-1)?.text).toBe('!12 4/7 3:17/~5m')

  await clock.advance(10_000)
  expect(fetches(runs)).toBe(before + 1)
})

test('a settled pipeline is fetched again after 150 seconds, not every 15', OWNED, async ($, on) => {
  const { clock, runs, set } = engine(on)
  set(SUCCESS)
  await start($)
  await clock.settle()
  const before = fetches(runs)
  await clock.advance(15_000)
  expect(fetches(runs)).toBe(before)
  await clock.advance(135_000)
  expect(fetches(runs)).toBe(before + 1)
})

test('a moving branch tip polls fast, a settled one slow', OWNED, async ($, on) => {
  const { clock, toasts, runs, set } = engine(on)
  set(github(GH_RUNNING, { isTip: true }))
  await start($)
  await clock.settle()
  expect(segments(toasts).at(-1)?.text).toStartWith('main 0/2')
  const before = fetches(runs, PR_VIEW)
  await clock.advance(15_000)
  expect(fetches(runs, PR_VIEW)).toBe(before + 1)

  set(github(GH_SUCCESS, { isTip: true }))
  await clock.advance(15_000)
  expect(segments(toasts).at(-1)?.text).toBe('main ✓ 4:51')
  const settled = fetches(runs, PR_VIEW)
  await clock.advance(15_000)
  expect(fetches(runs, PR_VIEW)).toBe(settled)
  await clock.advance(135_000)
  expect(fetches(runs, PR_VIEW)).toBe(settled + 1)
})

test('without an open merge request there is no timer', OWNED, async ($, on) => {
  const { clock, runs, set } = engine(on)
  set({ [MRS]: { stdout: [] } })
  await start($)
  await clock.settle()
  const before = fetches(runs)
  await clock.advance(600_000)
  expect(fetches(runs)).toBe(before)
})

test('a failed fetch keeps the last segment', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set(SUCCESS)
  await start($)
  await clock.settle()
  const shown = segments(toasts).length
  set({ [MRS]: { exitCode: 1, stderr: 'glab: 500 Internal Server Error' } })
  await clock.advance(150_000)
  expect(segments(toasts).length).toBe(shown)
  expect(segments(toasts).at(-1)?.text).toBe('!12 ✓ 4:51')
})

test('not logged in clears the segment and says so once', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set(SUCCESS)
  await start($)
  await clock.settle()
  set({ [MRS]: { exitCode: 1, stderr: 'glab: 401 Unauthorized' } })
  await clock.advance(150_000)
  expect(segments(toasts).at(-1)).toBeUndefined()
  await turn($)
  await clock.advance(5_000)
  expect(plain(toasts).filter(t => t === 'glab nicht angemeldet')).toHaveLength(1)
})

test('no toast for a pipeline final at first sight', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set(SUCCESS)
  await start($)
  await clock.settle()
  expect(plain(toasts)).toEqual([])
})

test('a pipeline that turns green toasts once', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set(RUNNING)
  await start($)
  await clock.settle()
  set(SUCCESS)
  await clock.advance(15_000)
  await clock.advance(150_000)
  expect(plain(toasts)).toEqual(['Pipeline !12 grün (4:51)'])
})

test('retry toasts again', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set(RUNNING)
  await start($)
  await clock.settle()
  set(FAILED)
  await clock.advance(15_000)
  // The retry starts the same pipeline again; the next prompt's turn finds it running.
  set(RUNNING)
  await clock.advance(5_000)
  await turn($)
  await clock.settle()
  set(SUCCESS)
  await clock.advance(15_000)
  expect(plain(toasts)).toEqual(['Pipeline !12 fehlgeschlagen: test:unit', 'Pipeline !12 grün (4:51)'])
})

test('a GitLab pipeline held at the same manual job toasts once, though it ran between', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  const held = gitlab('manual', ['success', 'manual'])
  set(RUNNING)
  await start($)
  await clock.settle()
  set(held)
  await clock.advance(15_000)
  // The job runs, then the pipeline stops at the same manual job again.
  set(gitlab('running', ['success', 'running']))
  await clock.advance(5_000)
  await turn($)
  await clock.settle()
  set(held)
  await clock.advance(15_000)
  expect(plain(toasts)).toEqual(['Pipeline !12 wartet auf test:unit'])
})

test('GitHub checks held at the same manual check toast again after they ran', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  const held = github([checkRun(1, 'deploy', 'waiting')])
  set(github(GH_RUNNING))
  await start($)
  await clock.settle()
  set(held)
  await clock.advance(15_000)
  set(github([checkRun(1, 'deploy', 'in_progress')]))
  await clock.advance(5_000)
  await turn($)
  await clock.settle()
  set(held)
  await clock.advance(15_000)
  expect(plain(toasts)).toEqual(['Checks #12 warten auf deploy', 'Checks #12 warten auf deploy'])
})

test('failed checks on GitHub toast once while the other checks still finish', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set(github(GH_RUNNING))
  await start($)
  await clock.settle()
  set(github([checkRun(1, 'markdownlint', 'completed', 'failure', '2026-10-29T10:01:00Z'), checkRun(2, 'tests', 'in_progress')]))
  await clock.advance(15_000)
  set(github([checkRun(1, 'markdownlint', 'completed', 'failure', '2026-10-29T10:01:00Z'), checkRun(2, 'tests', 'completed', 'success', '2026-10-29T10:04:00Z')]))
  await clock.advance(150_000)
  await clock.advance(150_000)
  expect(plain(toasts)).toEqual(['Checks #12 fehlgeschlagen: markdownlint'])
})

test('failed checks on GitHub that run again and fail again toast again', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  const failed = github([checkRun(1, 'markdownlint', 'completed', 'failure', '2026-10-29T10:01:00Z'), checkRun(2, 'tests', 'completed', 'success', '2026-10-29T10:02:00Z')])
  set(github(GH_RUNNING))
  await start($)
  await clock.settle()
  set(failed)
  await clock.advance(15_000)
  // Re-run: the failed check runs again, and the next prompt's turn finds it moving.
  set(github([checkRun(3, 'markdownlint', 'in_progress'), checkRun(2, 'tests', 'completed', 'success', '2026-10-29T10:02:00Z')]))
  await clock.advance(5_000)
  await turn($)
  await clock.settle()
  set(failed)
  await clock.advance(15_000)
  expect(plain(toasts)).toEqual(['Checks #12 fehlgeschlagen: markdownlint', 'Checks #12 fehlgeschlagen: markdownlint'])
})

test('a push fetches at once, another command does not', OWNED, async ($, on) => {
  const { clock, runs, set } = engine(on)
  set({ [MRS]: { stdout: [] } })
  await start($)
  await clock.settle()
  await clock.advance(5_000)
  const before = fetches(runs)
  await bash($, 'ls -la')
  await clock.settle()
  expect(fetches(runs)).toBe(before)
  await bash($, 'git push origin feat/login')
  await clock.settle()
  expect(fetches(runs)).toBe(before + 1)
})

test('a new pull request fetches at once', OWNED, async ($, on) => {
  const { clock, runs, set } = engine(on)
  set({ [MRS]: { stdout: [] } })
  await start($)
  await clock.settle()
  await clock.advance(5_000)
  const before = fetches(runs)
  await bash($, 'gh pr create --fill')
  await clock.settle()
  expect(fetches(runs)).toBe(before + 1)
})

test('a push looks again once GitLab had time to start the pipeline', OWNED, async ($, on) => {
  const { clock, runs, set } = engine(on)
  set(SUCCESS)
  await start($)
  await clock.settle()
  await clock.advance(5_000)
  const before = fetches(runs)
  await bash($, 'git push origin feat/login')
  await clock.settle()
  expect(fetches(runs)).toBe(before + 1)
  // The new head pipeline shows up a few seconds after the push, long before the slow poll.
  set(RUNNING)
  await clock.advance(10_000)
  expect(fetches(runs)).toBe(before + 2)
})

test('a prompt and a main-loop turn fetch, a subagent turn does not', OWNED, async ($, on) => {
  const { clock, runs, set } = engine(on)
  set({ [MRS]: { stdout: [] } })
  await start($)
  await clock.settle()
  await clock.advance(5_000)
  const before = fetches(runs)
  await turn($, 'agent-1')
  await clock.settle()
  expect(fetches(runs)).toBe(before)
  await $.prompt.submit({ text: 'weiter', wait: false, origin: { kind: 'composer' } })
  await clock.settle()
  expect(fetches(runs)).toBe(before + 1)
  await clock.advance(5_000)
  await turn($)
  await clock.settle()
  expect(fetches(runs)).toBe(before + 2)
})

test('triggers in the same moment fetch once', OWNED, async ($, on) => {
  const { clock, runs, set } = engine(on)
  set({ [MRS]: { stdout: [] } })
  await start($)
  await clock.settle()
  await clock.advance(5_000)
  const before = fetches(runs)
  await $.prompt.submit({ text: 'weiter', wait: false, origin: { kind: 'composer' } })
  await turn($)
  await clock.settle()
  expect(fetches(runs)).toBe(before + 1)
})

test('a pipeline that starts and ends between two fetches still toasts', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set({ [MRS]: { stdout: [] } })
  await start($)
  await clock.settle()
  // Pushed from outside: created after the session started, already green when first seen.
  const late = gitlab('success', ['success', 'success'], '2026-10-29T10:09:51Z')
  const detail = late[MR]?.stdout as { head_pipeline: Record<string, string> }
  detail.head_pipeline.created_at = '2026-10-29T10:05:00Z'
  detail.head_pipeline.started_at = '2026-10-29T10:05:00Z'
  set(late)
  await clock.advance(5_000)
  await turn($)
  await clock.settle()
  expect(plain(toasts)).toEqual(['Pipeline !12 grün (4:51)'])
})

test('open runs the browser on the merge request', OWNED, async ($, on) => {
  const { clock, runs, set } = engine(on)
  set(RUNNING)
  await start($)
  await clock.settle()
  await run($, 'ci-open')
  expect(runs).toContain('open https://gitlab.example.com/group/project/-/merge_requests/12')
})

test('the segment carries open and copy link as actions', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on)
  set(SUCCESS)
  await start($)
  await clock.settle()
  expect(segments(toasts).at(-1)?.actions).toEqual([
    { label: 'öffnen', command: 'ci-open' },
    { label: 'Link kopieren', command: 'ci-link' },
  ])
})

test("/ci-link copies the change's URL and confirms", OWNED, async ($, on) => {
  const { clock, toasts, copied, set } = engine(on)
  set(RUNNING)
  await start($)
  await clock.settle()
  await run($, 'ci-link')
  expect(copied).toEqual(['https://gitlab.example.com/group/project/-/merge_requests/12'])
  expect(plain(toasts)).toEqual(['Link kopiert'])
})

test('/ci-link without a clipboard shows the URL in the toast', OWNED, async ($, on) => {
  const { clock, toasts, copied, set } = engine(on, { clipboard: false })
  set(github(GH_SUCCESS, { isTip: true }))
  await start($)
  await clock.settle()
  await run($, 'ci-link')
  expect(copied).toEqual([])
  expect(plain(toasts).at(-1)).toContain(`https://github.com/owner/repo/commit/${SHA}`)
})

test('open and copy link without an address say there is no change, and run and copy nothing', OWNED, async ($, on) => {
  const { clock, toasts, runs, copied, set } = engine(on)
  // The repository lookup failed: the tip is shown, but its address is not known.
  set({ ...github(GH_SUCCESS, { isTip: true }), 'gh repo view --json nameWithOwner,url': { exitCode: 1, stderr: 'HTTP 502' } })
  await start($)
  await clock.settle()
  const before = plain(toasts).length
  await run($, 'ci-open')
  await run($, 'ci-link')
  expect(runs.filter(line => line.startsWith('open'))).toEqual([])
  expect(copied).toEqual([])
  expect(plain(toasts).slice(before)).toEqual(Array(2).fill('Kein offener Pull Request und keine Checks für diesen Branch'))
})

test('/ci-link without a change says so', OWNED, async ($, on) => {
  const { clock, toasts, copied, set } = engine(on)
  set({ [MRS]: { stdout: [] } })
  await start($)
  await clock.settle()
  await run($, 'ci-link')
  expect(copied).toEqual([])
  expect(plain(toasts)).toEqual(['Kein offener Merge Request für diesen Branch'])
})

test('get errors appends the excerpt to the draft', OWNED, async ($, on) => {
  const { clock, fills, set } = engine(on, { draft: 'Bitte prüfen' })
  set({ ...FAILED, [TRACE]: { stdout: 'line 1\nERROR: boom\nline 3\n' } })
  await start($)
  await clock.settle()
  await run($, 'ci-errors')
  expect(fills).toHaveLength(1)
  expect(fills[0]?.mode).toBe('append')
  expect(fills[0]?.text).toStartWith('\n\nDie Pipeline von !12 ist im Job test:unit (Stage test) fehlgeschlagen.')
  expect(fills[0]?.text).toContain('ERROR: boom')
})

test('get errors on a check without log toasts its name and leaves the prompt box alone', OWNED, async ($, on) => {
  const { clock, toasts, fills, set } = engine(on, { draft: 'Bitte prüfen' })
  const sha = '0a1b2c3d4e5f60718293a4b5c6d7e8f901234567'
  set({
    'git remote get-url origin': { stdout: 'https://github.com/owner/repo.git' },
    'gh pr view --json number,title,url,baseRefName,isDraft,headRefOid,state': {
      stdout: { number: 12, title: 'Add the login form', url: 'https://github.com/owner/repo/pull/12', baseRefName: 'main', isDraft: false, headRefOid: sha, state: 'OPEN' },
    },
    'gh repo view --json nameWithOwner,url': { stdout: { nameWithOwner: 'owner/repo', url: 'https://github.com/owner/repo' } },
    [`gh api repos/{owner}/{repo}/commits/${sha}/check-runs?per_page=100`]: { stdout: { check_runs: [] } },
    [`gh api repos/{owner}/{repo}/commits/${sha}/status?per_page=100`]: {
      stdout: { statuses: [{ id: 55, context: 'CodeRabbit', state: 'failure', created_at: '2026-10-29T09:59:00Z', updated_at: '2026-10-29T10:01:00Z' }] },
    },
  })
  await start($)
  await clock.settle()
  await run($, 'ci-errors')
  expect(plain(toasts).some(one => one.includes('CodeRabbit'))).toBe(true)
  expect(fills).toEqual([])
})

test('get errors on a job with an empty log toasts its name and leaves the prompt box alone', OWNED, async ($, on) => {
  const { clock, toasts, fills, set } = engine(on, { draft: 'Bitte prüfen' })
  const sha = '0a1b2c3d4e5f60718293a4b5c6d7e8f901234567'
  set({
    'git remote get-url origin': { stdout: 'https://github.com/owner/repo.git' },
    'gh pr view --json number,title,url,baseRefName,isDraft,headRefOid,state': {
      stdout: { number: 12, title: 'Add the login form', url: 'https://github.com/owner/repo/pull/12', baseRefName: 'main', isDraft: false, headRefOid: sha, state: 'OPEN' },
    },
    'gh repo view --json nameWithOwner,url': { stdout: { nameWithOwner: 'owner/repo', url: 'https://github.com/owner/repo' } },
    [`gh api repos/{owner}/{repo}/commits/${sha}/check-runs?per_page=100`]: {
      stdout: { check_runs: [{ id: 77, name: 'build', status: 'completed', conclusion: 'failure', started_at: '2026-10-29T10:00:00Z', completed_at: '2026-10-29T10:01:00Z', app: { slug: 'github-actions', name: 'GitHub Actions' }, check_suite: { id: 930 } }] },
    },
    [`gh api repos/{owner}/{repo}/actions/runs?head_sha=${sha}&per_page=100`]: { stdout: { workflow_runs: [{ name: 'check', check_suite_id: 930 }] } },
    'gh run view --job 77 --log-failed': { stdout: '' },
    [`gh api repos/{owner}/{repo}/commits/${sha}/status?per_page=100`]: {
      stdout: { statuses: [] },
    },
  })
  await start($)
  await clock.settle()
  await run($, 'ci-errors')
  expect(plain(toasts).some(one => one.includes('build'))).toBe(true)
  expect(fills).toEqual([])
})

test('get errors under a dialog toasts and inserts nothing', OWNED, async ($, on) => {
  const { clock, toasts, set } = engine(on, { isFilled: false })
  set({ ...FAILED, [TRACE]: { stdout: 'ERROR: boom\n' } })
  await start($)
  await clock.settle()
  await run($, 'ci-errors')
  expect(plain(toasts)).toContain('Eingabefeld nicht verfügbar, Auszug nicht eingefügt')
})

test('switched off it stops fetching', OWNED, async ($, on) => {
  const { clock, runs, set } = engine(on)
  set(RUNNING)
  await start($)
  await clock.settle()
  await standIn($, 'off')
  await clock.settle()
  const before = runs.length
  await clock.advance(600_000)
  await turn($)
  await clock.settle()
  expect(runs.length).toBe(before)
})

test('without ak-mods the own band shows the segment', async ($, on) => {
  const { clock, set } = engine(on)
  set(SUCCESS)
  await start($)
  await clock.settle()
  const ui = await $.ui.mount({
    plugin: 'ak-ci',
    component: 'AbovePrompt',
    surface: 'terminal',
    props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 }, view: {} },
  })
  expect(await ui.find({ type: 'Text', text: '!12 ✓ 4:51' })).toBeDefined()
  await ui.unmount()
})
