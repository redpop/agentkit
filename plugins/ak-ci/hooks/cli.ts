// What every call to a CLI shares. A leaf: it imports nothing at run time, so the provider and the
// modules beneath it can all reach it without importing each other.

/** How long a call to a host's CLI, to `git`, or to `open`, may run. */
export const TIMEOUT_MS = 10_000
