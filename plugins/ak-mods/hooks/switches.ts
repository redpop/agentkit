import type { ModsInfo, ModsRow } from '../types'

/** The declared list with `info` in place of the entry of the same name, else appended. */
export const upsert = (list: readonly ModsInfo[], info: ModsInfo): ModsInfo[] =>
  list.some(one => one.name === info.name)
    ? list.map(one => (one.name === info.name ? info : one))
    : [...list, info]

/** The switcher's rows: every declared mod with its switches, sorted by title, case-insensitive. */
export const rows = (
  declared: readonly ModsInfo[],
  on: Readonly<Record<string, boolean>>,
  standard: readonly string[],
): ModsRow[] =>
  declared
    .map(info => ({ ...info, isOn: on[info.name] === true, isStandard: standard.includes(info.name) }))
    .sort((a, b) => compare(a.title.toLowerCase(), b.title.toLowerCase()))

/**
 * Whether a plugin may declare itself: one installed from ak-marketplace, or an
 * inline (`--plugin-dir`) one; with no provenance known, one named `ak-…`.
 *
 * `claude plugin test` loads a test's inline plugins as `<name>@claude-plugin-test`,
 * which says nothing about who wrote them, so they are judged by name too.
 */
export const isAgentKit = (name: string, provenance: string | undefined): boolean =>
  provenance === undefined || provenance.endsWith('@claude-plugin-test')
    ? name.startsWith('ak-')
    : provenance.endsWith('@ak-marketplace') || provenance.endsWith('@inline')

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** The switches a session starts with: its saved ones when it has them, else every standard mod on. */
export const initialOn = (
  standard: readonly string[],
  saved: Readonly<Record<string, boolean>> | undefined,
): Record<string, boolean> =>
  saved !== undefined ? { ...saved } : Object.fromEntries(standard.map(name => [name, true]))

/** The `session:` keys to delete, oldest first, so that the newest `keep` of them stay (insertion order). */
export const pruneKeys = (keys: readonly string[], keep: number): string[] => {
  const sessions = keys.filter(key => key.startsWith('session:'))

  return sessions.slice(0, Math.max(0, sessions.length - keep))
}

/** The standard names a stored value holds; anything else is none. */
export const namesOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : []

/** The switches a stored value holds, its booleans alone; undefined when it holds no record. */
export const savedOf = (value: unknown): Record<string, boolean> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
      )
    : undefined
