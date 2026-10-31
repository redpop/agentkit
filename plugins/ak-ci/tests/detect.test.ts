import { expect, test } from 'claude-code/testing'
import type { EngineInterface, ProcessRunResult } from 'claude-code'

import type { ProviderName } from '../hooks/model'
import { providerFor } from '../hooks/detect'

const UPSTREAM = 'git rev-parse --abbrev-ref --symbolic-full-name @{u}'

type Answer = { exitCode?: number; stdout?: string } | 'missing'

// The host beneath: each command line answers as the test sets it; an unset one exits 1. Every
// command line is recorded, with its options.
const host = (answers: Record<string, Answer>) => {
  const calls: { line: string; timeoutMs?: number }[] = []
  const run = async (argv: readonly string[], init?: { timeoutMs?: number }): Promise<ProcessRunResult> => {
    const line = argv.join(' ')
    calls.push({ line, timeoutMs: init?.timeoutMs })
    const answer = answers[line] ?? { exitCode: 1 }
    if (answer === 'missing') throw new Error('spawn gh ENOENT')

    return { exitCode: answer.exitCode ?? 0, stdout: answer.stdout ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
  }

  return { $: { process: { run } } as unknown as EngineInterface, calls }
}

const originAt = (url: string): Record<string, Answer> => ({
  [UPSTREAM]: { exitCode: 128 },
  'git remote get-url origin': { stdout: `${url}\n` },
})

const AUTH = (host: string) => `gh auth status --hostname ${host}`
const isAuthCall = (calls: { line: string }[]) => calls.some(call => call.line.startsWith('gh '))

test('github.com is GitHub without asking gh', async () => {
  const { $, calls } = host(originAt('git@github.com:owner/repo.git'))
  expect(await providerFor($, new Map())).toBe('github')
  expect(isAuthCall(calls)).toBe(false)
})

test('a host gh is not logged in to is GitLab', async () => {
  const { $ } = host({ ...originAt('https://gitlab.example.com/group/project.git'), [AUTH('gitlab.example.com')]: { exitCode: 1 } })
  expect(await providerFor($, new Map())).toBe('gitlab')
})

test('a host gh is logged in to is GitHub', async () => {
  const { $ } = host({ ...originAt('https://github.example.com/owner/repo.git'), [AUTH('github.example.com')]: { exitCode: 0 } })
  expect(await providerFor($, new Map())).toBe('github')
})

test('gh missing on an unknown host is GitLab', async () => {
  const { $ } = host({ ...originAt('https://git.example.com/group/project.git'), [AUTH('git.example.com')]: 'missing' })
  expect(await providerFor($, new Map())).toBe('gitlab')
})

test('an ssh:// URL with a port gives its host', async () => {
  const { $, calls } = host({ ...originAt('ssh://git@github.example.com:2222/owner/repo.git'), [AUTH('github.example.com')]: { exitCode: 0 } })
  expect(await providerFor($, new Map())).toBe('github')
  expect(calls.map(call => call.line)).toContain(AUTH('github.example.com'))
})

test('the upstream branch names the remote', async () => {
  const { $ } = host({
    [UPSTREAM]: { stdout: 'upstream/main\n' },
    'git remote get-url upstream': { stdout: 'git@github.com:owner/repo.git\n' },
    'git remote get-url origin': { stdout: 'https://gitlab.example.com/group/project.git\n' },
  })
  expect(await providerFor($, new Map())).toBe('github')
})

test('without an upstream or an origin the first remote is used', async () => {
  const { $ } = host({
    [UPSTREAM]: { exitCode: 128 },
    'git remote get-url origin': { exitCode: 2 },
    'git remote': { stdout: 'upstream\nfork\n' },
    'git remote get-url upstream': { stdout: 'git@github.com:owner/repo.git\n' },
  })
  expect(await providerFor($, new Map())).toBe('github')
})

test('no remote at all gives undefined', async () => {
  const { $ } = host({ [UPSTREAM]: { exitCode: 128 }, 'git remote get-url origin': { exitCode: 2 }, 'git remote': { stdout: '' } })
  expect(await providerFor($, new Map())).toBeUndefined()
})

test('a URL without a host gives undefined', async () => {
  const { $ } = host(originAt('/srv/git/repo.git'))
  expect(await providerFor($, new Map())).toBeUndefined()
})

test('the second call for a host does not ask gh again', async () => {
  const { $, calls } = host({ ...originAt('https://github.example.com/owner/repo.git'), [AUTH('github.example.com')]: { exitCode: 0 } })
  const cache = new Map<string, ProviderName>()
  expect(await providerFor($, cache)).toBe('github')
  expect(await providerFor($, cache)).toBe('github')
  expect(calls.filter(call => call.line.startsWith('gh '))).toHaveLength(1)
})

test('every call carries the timeout', async () => {
  const { $, calls } = host(originAt('https://git.example.com/group/project.git'))
  await providerFor($, new Map())
  expect(calls.every(call => call.timeoutMs === 10_000)).toBe(true)
})
