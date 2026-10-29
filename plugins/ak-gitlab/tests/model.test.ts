import { expect, test } from 'claude-code/testing'

import { firstFailed, isSettled, meanMs, phaseOf, progressOf } from '../hooks/model'
import type { Job, Pipeline } from '../hooks/model'

const job = (status: string, extra: Partial<Job> = {}): Job => ({
  id: 1,
  name: `job-${status}`,
  stage: 'test',
  status,
  allowFailure: false,
  ...extra,
})

const pipeline = (status: string, jobs: Job[] = []): Pipeline => ({
  id: 4711,
  status,
  webUrl: 'https://gitlab.example.com/group/project/-/pipelines/4711',
  createdAt: '2026-10-29T10:00:00Z',
  jobs,
})

test('no pipeline is the phase none', () => {
  expect(phaseOf(undefined)).toBe('none')
})

test('every status before the end counts as running', () => {
  for (const status of ['created', 'pending', 'running', 'scheduled', 'waiting_for_resource', 'preparing']) {
    expect(phaseOf(pipeline(status))).toBe('running')
  }
})

test('the settled statuses map to their phase', () => {
  expect(phaseOf(pipeline('manual'))).toBe('manual')
  expect(phaseOf(pipeline('failed'))).toBe('failed')
  expect(phaseOf(pipeline('success'))).toBe('success')
  expect(phaseOf(pipeline('canceled'))).toBe('canceled')
  expect(phaseOf(pipeline('skipped'))).toBe('canceled')
})

test('progress counts finished jobs and a manual job that may be skipped', () => {
  const jobs = [
    job('success'),
    job('failed', { allowFailure: true }),
    job('skipped'),
    job('canceled'),
    job('manual', { allowFailure: true }),
    job('running'),
    job('pending'),
  ]
  expect(progressOf(pipeline('running', jobs))).toEqual({ done: 5, total: 7 })
})

test('the first failed job is the first that may not fail', () => {
  const allowed = job('failed', { id: 1, name: 'lint', allowFailure: true })
  const blocking = job('failed', { id: 2, name: 'test:unit' })
  expect(firstFailed(pipeline('failed', [allowed, blocking]))?.name).toBe('test:unit')
  expect(firstFailed(pipeline('failed', [allowed]))).toBeUndefined()
})

test('settled phases stop the fast poll', () => {
  for (const phase of ['manual', 'failed', 'success', 'canceled'] as const) expect(isSettled(phase)).toBe(true)
  for (const phase of ['none', 'running'] as const) expect(isSettled(phase)).toBe(false)
})

test('the mean of the durations, none without any', () => {
  expect(meanMs([])).toBeUndefined()
  expect(meanMs([240000, 300000, 360000])).toBe(300000)
})
