import { expect, test } from 'claude-code/testing'

import type { Change, Checks, Job, Status } from '../hooks/model'
import { cardFor, elapsed, segmentFor, toastFor } from '../hooks/view'

// The pipeline started 10:00:00; the clock reads 192 s later.
const START = Date.parse('2026-10-29T10:00:00Z')
const NOW = START + 192_000

const job = (name: string, group: string, status: string, extra: Partial<Job> = {}): Job => ({
  id: name.length,
  name,
  group,
  status,
  allowFailure: false,
  hasLog: true,
  ...extra,
})

const pipeline = (status: string, jobs: Job[], finishedAfterMs?: number): Checks => ({
  key: '4711',
  status,
  webUrl: 'https://gitlab.example.com/group/project/-/pipelines/4711',
  createdAt: '2026-10-29T09:59:50Z',
  startedAt: '2026-10-29T10:00:00Z',
  ...(finishedAfterMs === undefined ? {} : { finishedAt: new Date(START + finishedAfterMs).toISOString() }),
  jobs,
})

const mr = (head?: Checks): Change => ({
  ref: '!12',
  number: 12,
  title: 'Add the login form',
  webUrl: 'https://gitlab.example.com/group/project/-/merge_requests/12',
  repo: 'group/project',
  target: 'main',
  isDraft: false,
  ...(head === undefined ? {} : { checks: head }),
})

const of = (one: Change, estimateMs?: number): Status => ({
  kind: 'change',
  provider: 'gitlab',
  change: one,
  ...(estimateMs === undefined ? {} : { estimateMs }),
})

const RUNNING = [
  job('build', 'build', 'success'),
  job('lint', 'test', 'success'),
  job('test:unit', 'test', 'success'),
  job('test:e2e', 'test', 'success'),
  job('test:api', 'test', 'running'),
  job('deploy', 'deploy', 'created'),
  job('notify', 'deploy', 'created'),
]
const FAILED = [job('build', 'build', 'success'), job('test:unit', 'test', 'failed'), job('deploy', 'deploy', 'skipped')]
const GREEN = [job('build', 'build', 'success'), job('test:unit', 'test', 'success')]
const OPEN = { label: 'öffnen', command: 'ci-open' }

test('elapsed time reads minutes and seconds', () => {
  expect(elapsed(192_000)).toBe('3:12')
  expect(elapsed(3_725_000)).toBe('62:05')
  expect(elapsed(4_000)).toBe('0:04')
})

test('nothing to show without an open merge request or without glab', () => {
  expect(segmentFor({ kind: 'none' }, NOW, 'de')).toBeUndefined()
  for (const reason of ['no-cli', 'no-auth', 'no-host', 'error'] as const) {
    expect(segmentFor({ kind: 'unavailable', provider: 'gitlab', reason }, NOW, 'de')).toBeUndefined()
  }
})

test('a merge request without a pipeline says so, dim', () => {
  expect(segmentFor(of(mr()), NOW, 'de')).toMatchObject({
    text: '!12 keine Pipeline',
    rich: [
      { text: '!12', tone: 'dim' },
      { text: ' keine Pipeline', tone: 'dim' },
    ],
    tone: 'dim',
    button: OPEN,
  })
})

test('a running pipeline shows a ring of its jobs, the time and the estimate', () => {
  const now = segmentFor(of(mr(pipeline('running', RUNNING)), 300_000), NOW, 'de')
  expect(now).toMatchObject({
    text: '!12 4/7 3:12/~5m',
    rich: [
      { text: '!12 ', tone: 'dim' },
      { text: '4/7', tone: 'info', ring: 57 },
      { text: ' 4/7', tone: 'info' },
      { text: ' 3:12 von ~5 min', tone: 'dim' },
    ],
    compact: { text: '!12 4/7' },
    tone: 'info',
    button: OPEN,
  })
})

test('a running pipeline without history leaves the estimate out', () => {
  const now = segmentFor(of(mr(pipeline('running', RUNNING))), NOW, 'de')
  expect(now?.text).toBe('!12 4/7 3:12')
  expect(now?.rich?.[3]).toEqual({ text: ' 3:12', tone: 'dim' })
})

test('a failed pipeline names its first failed job and offers its errors', () => {
  expect(segmentFor(of(mr(pipeline('failed', FAILED, 168_000))), NOW, 'de')).toMatchObject({
    text: '!12 ✗ test:unit 2:48',
    rich: [
      { text: '!12', tone: 'dim' },
      { text: ' ✗ test:unit', tone: 'alert' },
      { text: ' 2:48', tone: 'dim' },
    ],
    compact: { text: '!12 ✗' },
    tone: 'alert',
    button: { label: 'Fehler holen', command: 'ci-errors' },
  })
})

test('a green pipeline shows its duration', () => {
  expect(segmentFor(of(mr(pipeline('success', GREEN, 291_000))), NOW, 'de')).toMatchObject({
    text: '!12 ✓ 4:51',
    rich: [
      { text: '!12', tone: 'dim' },
      { text: ' ✓ Pipeline', tone: 'ok' },
      { text: ' 4:51', tone: 'dim' },
    ],
    compact: { text: '!12 ✓' },
    tone: 'ok',
    button: OPEN,
  })
})

test('a pipeline held at a manual job names the job, in the warning tone', () => {
  const held = [job('build', 'build', 'success'), job('deploy', 'deploy', 'manual')]
  expect(segmentFor(of(mr(pipeline('manual', held))), NOW, 'de')).toMatchObject({
    text: '!12 ⏸ deploy',
    tone: 'warn',
    button: OPEN,
  })
})

test('a canceled pipeline reads as canceled, dim', () => {
  expect(segmentFor(of(mr(pipeline('canceled', GREEN, 60_000))), NOW, 'de')).toMatchObject({
    text: '!12 abgebrochen',
    tone: 'dim',
  })
})

test('English texts', () => {
  expect(segmentFor(of(mr()), NOW, 'en')?.text).toBe('!12 no pipeline')
  expect(segmentFor(of(mr()), NOW, 'en')?.button?.label).toBe('open')
  expect(segmentFor(of(mr(pipeline('failed', FAILED, 168_000))), NOW, 'en')?.button?.label).toBe('Get errors')
})

test('the card lists the merge request with its project and the stages in order', () => {
  const rows = cardFor(of(mr(pipeline('running', RUNNING))), NOW, 'de')
  expect(rows.map(row => row.label)).toEqual(['Änderung', 'Ziel', 'Draft', 'Pipeline', 'Stages', 'Gestartet', 'Dauer'])
  expect(rows[0]).toEqual({ label: 'Änderung', value: 'group/project !12 Add the login form' })
  expect(rows.find(row => row.label === 'Pipeline')?.value).toBe('#4711 running')
  expect(rows.find(row => row.label === 'Stages')?.value).toBe('build ✓ · test ◐ · deploy ○')
  expect(rows.find(row => row.label === 'Dauer')?.value).toBe('3:12')
})

test('the card names the failed jobs only when there are some', () => {
  const rows = cardFor(of(mr(pipeline('failed', FAILED, 168_000))), NOW, 'de')
  expect(rows.find(row => row.label === 'Fehlgeschlagen')?.value).toBe('test:unit')
  expect(rows.find(row => row.label === 'Stages')?.value).toBe('build ✓ · test ✗ · deploy ○')
})

test('a toast for each final state a pipeline reaches', () => {
  const green = mr(pipeline('success', GREEN, 291_000))
  expect(toastFor(of(green), 'de')).toEqual({ key: `4711:${green.checks?.finishedAt}`, text: 'Pipeline !12 grün (4:51)' })
  expect(toastFor(of(mr(pipeline('failed', FAILED, 168_000))), 'de')?.text).toBe('Pipeline !12 fehlgeschlagen: test:unit')
  expect(toastFor(of(mr(pipeline('manual', [job('deploy', 'deploy', 'manual')]))), 'de')).toEqual({
    key: '4711:manual:deploy',
    text: 'Pipeline !12 wartet auf deploy',
  })
  // A second manual gate in the same pipeline is a state of its own.
  expect(toastFor(of(mr(pipeline('manual', [job('deploy', 'deploy', 'success'), job('release', 'release', 'manual')]))), 'de')?.key).toBe(
    '4711:manual:release',
  )
  expect(toastFor(of(mr(pipeline('running', RUNNING))), 'de')).toBeUndefined()
  expect(toastFor(of(mr(pipeline('canceled', GREEN, 60_000))), 'de')).toBeUndefined()
  expect(toastFor(of(mr()), 'de')).toBeUndefined()
  // A retry finishes the same pipeline again, later: a new key.
  expect(toastFor(of(mr(pipeline('success', GREEN, 400_000))), 'de')?.key).not.toBe(toastFor(of(green), 'de')?.key)
})

// GitHub: pull request #12 on owner/repo, or the tip of main without one; the checks of commit SHA.
const SHA = '0a1b2c3d4e5f60718293a4b5c6d7e8f901234567'
const checksOn = (status: string, jobs: Job[], finishedAfterMs?: number): Checks => ({
  ...pipeline(status, jobs, finishedAfterMs),
  key: SHA,
  webUrl: 'https://github.com/owner/repo/pull/12/checks',
})
const pr = (head?: Checks): Change => ({
  ref: '#12',
  number: 12,
  title: 'Add the login form',
  webUrl: 'https://github.com/owner/repo/pull/12',
  repo: 'owner/repo',
  target: 'main',
  isDraft: false,
  ...(head === undefined ? {} : { checks: head }),
})
const tip = (head: Checks): Change => ({
  ref: 'main',
  webUrl: `https://github.com/owner/repo/commit/${SHA}`,
  repo: 'owner/repo',
  isDraft: false,
  checks: head,
})
const onGithub = (one: Change, estimateMs?: number): Status => ({ ...of(one, estimateMs), provider: 'github' } as Status)

const LINTED = [job('markdownlint', 'check', 'failed'), job('tests', 'check', 'running')]

test('GitHub names the pull request by its number, a branch tip by its branch', () => {
  expect(segmentFor(onGithub(pr(checksOn('running', RUNNING))), NOW, 'en')?.text).toStartWith('#12')
  expect(segmentFor(onGithub(tip(checksOn('success', GREEN, 291_000))), NOW, 'en')).toMatchObject({
    text: 'main ✓ 4:51',
    rich: [
      { text: 'main', tone: 'dim' },
      { text: ' ✓ Checks', tone: 'ok' },
      { text: ' 4:51', tone: 'dim' },
    ],
  })
  expect(segmentFor(of(mr(pipeline('success', GREEN, 291_000))), NOW, 'en')?.text).toBe('!12 ✓ 4:51')
})

test('the segment carries open and copy link as actions', () => {
  const actions = [
    { label: 'open', command: 'ci-open' },
    { label: 'Copy link', command: 'ci-link' },
  ]
  expect(segmentFor(of(mr()), NOW, 'en')?.actions).toEqual(actions)
  expect(segmentFor(of(mr(pipeline('running', RUNNING))), NOW, 'en')?.actions).toEqual(actions)
  // After a failure the button gets the errors; the menu still opens and copies.
  expect(segmentFor(onGithub(pr(checksOn('failed', FAILED, 168_000))), NOW, 'en')?.actions).toEqual(actions)
  expect(segmentFor(of(mr()), NOW, 'de')?.actions).toEqual([OPEN, { label: 'Link kopieren', command: 'ci-link' }])
})

test('the card names the change with its repository, on each host', () => {
  expect(cardFor(onGithub(pr(checksOn('running', RUNNING))), NOW, 'en')[0]).toEqual({ label: 'Change', value: 'owner/repo #12 Add the login form' })
  expect(cardFor(onGithub(tip(checksOn('running', RUNNING))), NOW, 'en')[0]).toEqual({ label: 'Change', value: 'owner/repo main' })
  expect(cardFor(of(mr(pipeline('running', RUNNING))), NOW, 'en')[0]).toEqual({ label: 'Change', value: 'group/project !12 Add the login form' })
  // A repository name that could not be read leaves no gap.
  expect(cardFor(of({ ...mr(), repo: '' }), NOW, 'en')[0]?.value).toBe('!12 Add the login form')
})

test('on GitHub the card shows the commit short and the workflows', () => {
  const rows = cardFor(onGithub(pr(checksOn('running', RUNNING))), NOW, 'en')
  expect(rows.map(row => row.label)).toEqual(['Change', 'Target', 'Draft', 'Checks', 'Workflows', 'Started', 'Duration'])
  expect(rows.find(row => row.label === 'Checks')?.value).toBe('0a1b2c3 running')
  expect(cardFor(onGithub(pr(checksOn('running', RUNNING))), NOW, 'de').map(row => row.label)).toContain('Workflows')
  expect(cardFor(of(mr(pipeline('running', RUNNING))), NOW, 'en').map(row => row.label)).toContain('Stages')
})

test('a branch tip has no draft row, a pull request has', () => {
  expect(cardFor(onGithub(tip(checksOn('running', RUNNING))), NOW, 'en').map(row => row.label)).not.toContain('Draft')
  expect(cardFor(onGithub(pr(checksOn('running', RUNNING))), NOW, 'en').map(row => row.label)).toContain('Draft')
})

test('toasts use the host’s word for the checks', () => {
  expect(toastFor(onGithub(pr(checksOn('success', GREEN, 291_000))), 'en')?.text).toBe('Checks #12 green (4:51)')
  expect(toastFor(onGithub(tip(checksOn('failed', LINTED))), 'en')?.text).toBe('Checks on main failed: markdownlint')
  expect(toastFor(of(mr(pipeline('success', GREEN, 291_000))), 'en')?.text).toBe('Pipeline !12 green (4:51)')
  expect(toastFor(onGithub(tip(checksOn('failed', LINTED))), 'de')?.text).toBe('Checks auf main fehlgeschlagen: markdownlint')
  expect(toastFor(onGithub(pr(checksOn('manual', [job('deploy', 'deploy', 'manual')]))), 'de')?.text).toBe('Checks #12 warten auf deploy')
  expect(toastFor(onGithub(pr(checksOn('manual', [job('deploy', 'deploy', 'manual')]))), 'en')?.text).toBe('Checks #12 wait for deploy')
})

test('failed checks on GitHub keep one toast key while other checks still finish', () => {
  const first = toastFor(onGithub(pr(checksOn('failed', LINTED, 60_000))), 'en')
  const later = toastFor(onGithub(pr(checksOn('failed', [job('markdownlint', 'check', 'failed'), job('tests', 'check', 'success')], 200_000))), 'en')
  expect(first?.key).toBe(`${SHA}:failed`)
  expect(later?.key).toBe(first?.key)
  // On GitLab a failed pipeline has ended: a retry that fails again is a new state.
  expect(toastFor(of(mr(pipeline('failed', FAILED, 400_000))), 'en')?.key).not.toBe(toastFor(of(mr(pipeline('failed', FAILED, 168_000))), 'en')?.key)
})

test('a pull request without checks says so in GitHub’s word', () => {
  expect(segmentFor(onGithub(pr()), NOW, 'en')?.text).toBe('#12 no checks')
  expect(segmentFor(onGithub(pr()), NOW, 'de')?.text).toBe('#12 keine Checks')
})
