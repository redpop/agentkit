// Which host the repository's remote lives on. A name answers from the URL alone where it can
// (github.com); any other host is GitHub when gh is logged in to it, and GitLab otherwise.

import type { EngineInterface } from 'claude-code'

import { TIMEOUT_MS } from './cli'
import type { ProviderName } from './model'

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those.

/** What a command writes to stdout, trimmed; undefined when it exits non-zero or cannot start. */
async function out($: EngineInterface, argv: string[]): Promise<string | undefined> {
  try {
    const result = await $.process.run(argv, { timeoutMs: TIMEOUT_MS })

    return result.exitCode === 0 ? result.stdout.trim() : undefined
  } catch {
    return undefined
  }
}

/**
 * The remote the branch pushes to: its upstream's when that names a remote, else `origin`, else
 * the first one there is. An upstream that is a local branch names no remote.
 */
async function remoteName($: EngineInterface): Promise<string | undefined> {
  const remotes = ((await out($, ['git', 'remote'])) ?? '').split('\n').map(one => one.trim()).filter(Boolean)
  const upstream = await out($, ['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  // A remote's name may hold a slash: the longest one the upstream starts with.
  const tracked = remotes.filter(one => upstream?.startsWith(`${one}/`)).sort((x, y) => y.length - x.length)[0]
  if (tracked !== undefined) return tracked
  if ((await out($, ['git', 'remote', 'get-url', 'origin'])) !== undefined) return 'origin'

  return remotes[0]
}

// gh is not installed: the call could not start it. Any other rejection is a call still running
// at the timeout, which the next fetch may not meet.
const NOT_STARTED = /ENOENT|not found|no such file/i

/** Whether gh is logged in to `host`: github or gitlab; undefined when the call did not finish. */
async function askGh($: EngineInterface, host: string): Promise<ProviderName | undefined> {
  try {
    const result = await $.process.run(['gh', 'auth', 'status', '--hostname', host], { timeoutMs: TIMEOUT_MS })

    return result.exitCode === 0 ? 'github' : 'gitlab'
  } catch (error) {
    return NOT_STARTED.test(String(error)) ? 'gitlab' : undefined
  }
}

/** The host of a remote URL, https, ssh:// or scp-style (`git@host:path`); undefined for a path. */
export function hostOf(url: string): string | undefined {
  const match = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?([^:/]+)/i.exec(url) ?? /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)/.exec(url)

  return match?.[1]?.toLowerCase()
}

/**
 * The host the repository's remote is on, or undefined without a remote or with one that has no
 * host. `cache` keeps the answer by host, so gh is asked once for each.
 */
export async function providerFor($: EngineInterface, cache: Map<string, ProviderName>): Promise<ProviderName | undefined> {
  const name = await remoteName($)
  if (name === undefined) return undefined
  const url = await out($, ['git', 'remote', 'get-url', name])
  const host = url === undefined ? undefined : hostOf(url)
  if (host === undefined) return undefined
  if (host === 'github.com') return 'github'
  const known = cache.get(host)
  if (known !== undefined) return known
  // GitLab unless gh is logged in to the host. An answer that did not come stands for this fetch
  // only, so the next one asks again.
  const asked = await askGh($, host)
  if (asked === undefined) return 'gitlab'
  cache.set(host, asked)

  return asked
}
