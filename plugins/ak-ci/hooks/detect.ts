// Which host the repository's remote lives on. A name answers from the URL alone where it can
// (github.com); any other host is GitHub when gh is logged in to it, and GitLab otherwise.

import type { EngineInterface } from 'claude-code'

import { NOT_STARTED, out, TIMEOUT_MS } from './cli'
import type { ProviderName } from './model'

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those.

/**
 * The remote the branch tracks and its upstream's name as `git branch -vv` shows it; both
 * undefined without an upstream. A remote's name may hold a slash: the longest one the upstream
 * starts with. An upstream that is a local branch names no remote.
 */
async function tracking($: EngineInterface): Promise<{ remotes: string[]; remote?: string; upstream?: string }> {
  const remotes = ((await out($, ['git', 'remote'])) ?? '').split('\n').map(one => one.trim()).filter(Boolean)
  const upstream = await out($, ['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  const remote = remotes.filter(one => upstream?.startsWith(`${one}/`)).sort((x, y) => y.length - x.length)[0]

  return { remotes, ...(remote === undefined ? {} : { remote }), ...(upstream === undefined ? {} : { upstream }) }
}

/**
 * The remote the branch pushes to: its upstream's when that names a remote, else `origin`, else
 * the first one there is.
 */
async function remoteName($: EngineInterface): Promise<string | undefined> {
  const { remotes, remote } = await tracking($)
  if (remote !== undefined) return remote
  if ((await out($, ['git', 'remote', 'get-url', 'origin'])) !== undefined) return 'origin'

  return remotes[0]
}

/**
 * The branch the local one tracks, as the remote names it (`main` for `origin/main`); undefined
 * without an upstream.
 */
export async function trackedBranch($: EngineInterface): Promise<string | undefined> {
  const { remote, upstream } = await tracking($)

  return remote === undefined ? upstream : upstream?.slice(remote.length + 1)
}

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
