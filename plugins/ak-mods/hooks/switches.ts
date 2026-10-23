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
