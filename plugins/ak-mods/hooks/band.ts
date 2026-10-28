import type { ModsSegment, ModsTone } from '../types'

export type Tone = ModsTone

/** A mod's published segment with the name and title ak-mods knows it by. */
export type Segment = ModsSegment & { name: string; title: string }

/** Up to two rows of segments; `hidden` holds the mod names that did not fit. */
export type Layout = { rows: readonly (readonly Segment[])[]; hidden: readonly string[] }

const ROW_SEPARATOR = 3

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Display order: priority descending (default 5), ties by title, case-insensitive. */
const ordered = (segments: readonly Segment[]): Segment[] =>
  [...segments].sort(
    (a, b) =>
      (b.priority ?? 5) - (a.priority ?? 5) || compare(a.title.toLowerCase(), b.title.toLowerCase()),
  )

/** A segment's width; a button adds its label, its hotkey and the brackets around them. */
const widthOf = (segment: Segment): number =>
  segment.text.length +
  (segment.button === undefined
    ? 0
    : segment.button.hotkey === undefined
      ? segment.button.label.length + 1
      : segment.button.label.length + segment.button.hotkey.length + 3)

/** The label of the band's last button, which opens and closes the Mods pane: `mods`, or `mods +N` with N dropped. */
export const toggleLabel = (hidden: number): string => (hidden > 0 ? `mods +${hidden}` : 'mods')

/** The hotkey of that button; no mod's button takes it in the band. */
export const TOGGLE_HOTKEY = 'm'

/** That button with its separator, its hotkey and the `: ` after it. */
const toggleWidth = (hidden: number): number => ROW_SEPARATOR + TOGGLE_HOTKEY.length + 2 + toggleLabel(hidden).length

const cut = (text: string, columns: number): string =>
  text.length <= columns ? text : `${text.slice(0, Math.max(0, columns - 1))}…`

/** A row's width: its segments and the separators between them. */
const rowWidth = (segments: readonly Segment[]): number =>
  segments.reduce((sum, segment, at) => sum + (at > 0 ? ROW_SEPARATOR : 0) + widthOf(segment), 0)

/**
 * The segments in order in one row, else in two with the first as full as it
 * can be, `reserve` kept free on the last; undefined when they do not fit. Not
 * first-fit: a full first row could leave the second no room for the reserve.
 */
const pack = (segments: readonly Segment[], columns: number, reserve: number): Segment[][] | undefined => {
  if (segments.length === 0) return []
  if (rowWidth(segments) + reserve <= columns) return [[...segments]]

  for (let split = segments.length - 1; split > 0; split--) {
    const first = segments.slice(0, split)
    const last = segments.slice(split)

    if (rowWidth(first) <= columns && rowWidth(last) + reserve <= columns) return [first, last]
  }

  return undefined
}

/**
 * Lays segments out in one row, then two, then drops the lowest priority ones.
 * The last row always keeps room for the `mods` button, which counts the dropped.
 */
export const layout = (segments: readonly Segment[], columns: number): Layout => {
  const sorted = ordered(segments)
  const all = pack(sorted, columns, toggleWidth(0))

  if (all !== undefined) return { rows: all, hidden: [] }

  for (let keep = sorted.length - 1; keep > 0; keep--) {
    const rows = pack(sorted.slice(0, keep), columns, toggleWidth(sorted.length - keep))

    if (rows !== undefined) return { rows, hidden: sorted.slice(keep).map(one => one.name) }
  }

  // Not even the first fits beside the button: keep it alone, cut to the room left.
  const [first, ...rest] = sorted

  return {
    rows: first === undefined ? [] : [[{ ...first, text: cut(first.text, Math.max(1, columns - toggleWidth(rest.length))) }]],
    hidden: rest.map(one => one.name),
  }
}

// The cells at the band's right end that hold the engine's `[-]`.
const BAND_MARK_COLUMNS = 5

/**
 * The band's width in cells, the one meaning of ak-mods' `width` state: the
 * cells the band's tree is laid out in (`AbovePrompt`'s `bodyColumns`), the
 * terminal's width less the engine's `[-]`. Both writers go through here,
 * so they cannot drift: the `mods` button with the band's `bodyColumns` as is,
 * `/ak-mods` with the terminal's columns. The pane counts the band's cut
 * with it. Undefined for a width that is no finite number above 0: nothing
 * is recorded then.
 */
export const bandWidth = (from: { bodyColumns: number } | { terminalColumns: number }): number | undefined => {
  const columns = 'bodyColumns' in from ? from.bodyColumns : from.terminalColumns
  if (!Number.isFinite(columns) || columns <= 0) return undefined

  return 'bodyColumns' in from ? columns : Math.max(1, columns - BAND_MARK_COLUMNS)
}
