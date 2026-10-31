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

/** The remote the branch pushes to: its upstream's, else `origin`, else the first one there is. */
async function remoteName($: EngineInterface): Promise<string | undefined> {
  const upstream = await out($, ['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  const name = upstream?.split('/')[0]
  if (name) return name
  if ((await out($, ['git', 'remote', 'get-url', 'origin'])) !== undefined) return 'origin'

  return (await out($, ['git', 'remote']))?.split('\n')[0]?.trim() || undefined
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
  // A gh that is not installed, or not logged in to this host, leaves GitLab.
  const isGithub = (await out($, ['gh', 'auth', 'status', '--hostname', host])) !== undefined
  const found: ProviderName = isGithub ? 'github' : 'gitlab'
  cache.set(host, found)

  return found
}
