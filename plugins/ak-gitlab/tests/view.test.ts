import { expect, test } from 'claude-code/testing'

import type { Job, Mr, Pipeline, Status } from '../hooks/model'
import { cardFor, elapsed, segmentFor, toastFor } from '../hooks/view'

// The pipeline started 10:00:00; the clock reads 192 s later.
const START = Date.parse('2026-10-29T10:00:00Z')
const NOW = START + 192_000

const job = (name: string, stage: string, status: string, extra: Partial<Job> = {}): Job => ({
  id: name.length,
  name,
  stage,
  status,
  allowFailure: false,
  ...extra,
})

const pipeline = (status: string, jobs: Job[], finishedAfterMs?: number): Pipeline => ({
  id: 4711,
  status,
  webUrl: 'https://gitlab.example.com/group/project/-/pipelines/4711',
  createdAt: '2026-10-29T09:59:50Z',
  startedAt: '2026-10-29T10:00:00Z',
  ...(finishedAfterMs === undefined ? {} : { finishedAt: new Date(START + finishedAfterMs).toISOString() }),
  jobs,
})

const mr = (head?: Pipeline): Mr => ({
  iid: 12,
  title: 'Add the login form',
  webUrl: 'https://gitlab.example.com/group/project/-/merge_requests/12',
  target: 'main',
  isDraft: false,
  ...(head === undefined ? {} : { pipeline: head }),
})

const of = (one: Mr, estimateMs?: number): Status => ({ kind: 'mr', mr: one, ...(estimateMs === undefined ? {} : { estimateMs }) })

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
const OPEN = { label: 'öffnen', command: 'gitlab-open' }

test('elapsed time reads minutes and seconds', () => {
  expect(elapsed(192_000)).toBe('3:12')
  expect(elapsed(3_725_000)).toBe('62:05')
  expect(elapsed(4_000)).toBe('0:04')
})

test('nothing to show without an open merge request or without glab', () => {
  expect(segmentFor({ kind: 'none' }, NOW, 'de')).toBeUndefined()
  for (const reason of ['no-glab', 'no-auth', 'not-gitlab', 'error'] as const) {
    expect(segmentFor({ kind: 'unavailable', reason }, NOW, 'de')).toBeUndefined()
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
      { text: ' · 3:12 von ~5 min', tone: 'dim' },
    ],
    compact: { text: '!12 4/7' },
    tone: 'info',
    button: OPEN,
  })
})

test('a running pipeline without history leaves the estimate out', () => {
  const now = segmentFor(of(mr(pipeline('running', RUNNING))), NOW, 'de')
  expect(now?.text).toBe('!12 4/7 3:12')
  expect(now?.rich?.[3]).toEqual({ text: ' · 3:12', tone: 'dim' })
})

test('a failed pipeline names its first failed job and offers its errors', () => {
  expect(segmentFor(of(mr(pipeline('failed', FAILED, 168_000))), NOW, 'de')).toMatchObject({
    text: '!12 ✗ test:unit 2:48',
    rich: [
      { text: '!12', tone: 'dim' },
      { text: ' ✗ test:unit', tone: 'alert' },
      { text: ' · 2:48', tone: 'dim' },
    ],
    compact: { text: '!12 ✗' },
    tone: 'alert',
    button: { label: 'Fehler holen', command: 'gitlab-errors' },
  })
})

test('a green pipeline shows its duration', () => {
  expect(segmentFor(of(mr(pipeline('success', GREEN, 291_000))), NOW, 'de')).toMatchObject({
    text: '!12 ✓ 4:51',
    rich: [
      { text: '!12', tone: 'dim' },
      { text: ' ✓ Pipeline', tone: 'ok' },
      { text: ' · 4:51', tone: 'dim' },
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

test('the card lists the merge request and the stages in order', () => {
  const rows = cardFor(mr(pipeline('running', RUNNING)), NOW, 'de')
  expect(rows.map(row => row.label)).toEqual(['MR', 'Ziel', 'Draft', 'Pipeline', 'Stages', 'Gestartet', 'Dauer'])
  expect(rows.find(row => row.label === 'MR')?.value).toBe('!12 Add the login form')
  expect(rows.find(row => row.label === 'Stages')?.value).toBe('build ✓ · test ◐ · deploy ○')
  expect(rows.find(row => row.label === 'Dauer')?.value).toBe('3:12')
})

test('the card names the failed jobs only when there are some', () => {
  const rows = cardFor(mr(pipeline('failed', FAILED, 168_000)), NOW, 'de')
  expect(rows.find(row => row.label === 'Fehlgeschlagen')?.value).toBe('test:unit')
  expect(rows.find(row => row.label === 'Stages')?.value).toBe('build ✓ · test ✗ · deploy ○')
})

test('a toast for each final state a pipeline reaches', () => {
  const green = mr(pipeline('success', GREEN, 291_000))
  expect(toastFor(green, 'de')).toEqual({ key: `4711:${green.pipeline?.finishedAt}`, text: 'Pipeline !12 grün (4:51)' })
  expect(toastFor(mr(pipeline('failed', FAILED, 168_000)), 'de')?.text).toBe('Pipeline !12 fehlgeschlagen: test:unit')
  expect(toastFor(mr(pipeline('manual', [job('deploy', 'deploy', 'manual')])), 'de')).toEqual({
    key: '4711:manual',
    text: 'Pipeline !12 wartet auf deploy',
  })
  expect(toastFor(mr(pipeline('running', RUNNING)), 'de')).toBeUndefined()
  expect(toastFor(mr(pipeline('canceled', GREEN, 60_000)), 'de')).toBeUndefined()
  expect(toastFor(mr(), 'de')).toBeUndefined()
  // A retry finishes the same pipeline again, later: a new key.
  expect(toastFor(mr(pipeline('success', GREEN, 400_000)), 'de')?.key).not.toBe(toastFor(green, 'de')?.key)
})
