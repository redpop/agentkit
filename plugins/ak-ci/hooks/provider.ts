// What the mod asks of a host, whichever it is: the status of the current branch's change, and the
// job that failed its checks with the log. Each host answers in `providers/` through its own CLI.

import type { EngineInterface } from 'claude-code'

import type { Checks, Job, ProviderName, Status } from './model'
import { fetchFailure as gitlabFailure, fetchStatus as gitlabStatus } from './providers/gitlab'

const TIMEOUT_MS = 10_000

/**
 * A failed job and its raw log, and whether the log was cut at the read limit; or a failed job
 * that has no log to read.
 */
export type Failure = { job: Job; trace: string; isCut: boolean } | { job: Job; noLog: true }

/**
 * A host, read through its CLI. `fetchStatus` keeps each estimate in `estimates` by `Checks.key`
 * across calls, so it is fetched once; `fetchFailure` is undefined when the CLI hands no job over.
 * The hooks loader passes `$` into no method: the mod calls a host through `fetchStatus` and
 * `fetchFailure` below, by its name.
 */
export type Provider = {
  name: ProviderName
  fetchStatus($: EngineInterface, estimates: Map<string, number | undefined>): Promise<Status>
  fetchFailure($: EngineInterface, checks: Checks): Promise<Failure | undefined>
}

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those.

/** The status from the host `provider` names; nothing from one the mod does not read yet. */
export async function fetchStatus(
  $: EngineInterface,
  provider: ProviderName,
  estimates: Map<string, number | undefined>,
): Promise<Status> {
  switch (provider) {
    case 'gitlab':
      return gitlabStatus($, estimates)
    case 'github':
      return { kind: 'none' }
  }
}

/** The failed job with its log from the host `provider` names; none from one the mod does not read yet. */
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
