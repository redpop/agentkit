// What the mod asks of a host, whichever it is: the status of the current branch's change, and the
// job that failed its checks with the log. Each host answers in `providers/` through its own CLI.

import type { EngineInterface } from 'claude-code'

import type { Checks, Job, ProviderName, Status } from './model'
import { fetchFailure as gitlabFailure, fetchStatus as gitlabStatus } from './providers/gitlab'

/** How long a call to a host's CLI, or to `open`, may run. */
export const TIMEOUT_MS = 10_000

/**
 * A failed job and its raw log, and whether the log was cut at the read limit; or a failed job
 * that has no log to read.
 */
export type Failure = { job: Job; trace: string; isCut: boolean } | { job: Job; noLog: true }

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those,
// and never into an object's method. So a host is reached by its name here, each one a module in
// `providers/` that exports its own `fetchStatus` and `fetchFailure`.

/**
 * The status from the host `provider` names. `estimates` keeps each estimate by `Checks.key` across
 * calls, so it is fetched once. A host the mod does not read yet answers as a failure.
 */
export async function fetchStatus(
  $: EngineInterface,
  provider: ProviderName,
  estimates: Map<string, number | undefined>,
): Promise<Status> {
  switch (provider) {
    case 'gitlab':
      return gitlabStatus($, estimates)
    case 'github':
      return { kind: 'unavailable', provider: 'github', reason: 'error' }
  }
}

/**
 * The failed job with its log from the host `provider` names; undefined when its CLI hands none over,
 * and from a host the mod does not read yet.
 */
export async function fetchFailure($: EngineInterface, provider: ProviderName, checks: Checks): Promise<Failure | undefined> {
  switch (provider) {
    case 'gitlab':
      return gitlabFailure($, checks)
    case 'github':
      return undefined
  }
}

/** Opens a page in the default browser (macOS `open`). */
export async function openUrl($: EngineInterface, url: string): Promise<void> {
  await $.process.run(['open', url], { timeoutMs: TIMEOUT_MS })
}
