import type { ModsSegment, ModsTone } from '../types'

export type Tone = ModsTone

/**
 * A mod's published segment with the name and title ak-mods knows it by. `isCompact` marks one
 * `layout` switched to its compact form.
 */
export type Segment = ModsSegment & { name: string; title: string; isCompact?: true }

/** Up to two rows of segments; `hidden` holds the mod names that did not fit. */
export type Layout = { rows: readonly (readonly Segment[])[]; hidden: readonly string[] }

const ROW_SEPARATOR = 3

// Where the band draws pictures, a cell is wider than a space of the text beside it: two part the
// segments there, still wider than the gaps inside one.
const PICTURED_SEPARATOR = 2

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Display order: priority descending (default 5), ties by title, case-insensitive. */
const ordered = (segments: readonly Segment[]): Segment[] =>
  [...segments].sort(
    (a, b) =>
      (b.priority ?? 5) - (a.priority ?? 5) || compare(a.title.toLowerCase(), b.title.toLowerCase()),
  )

// The cells a ring or an icon takes where the band draws pictures: 20 px, its air included.
const PICTURE_COLUMNS = 3

// A cell of the desktop app is an advance of its code font, the band's text a proportional face,
// narrower on average: a character counts this much of a cell there. Too low, and the band's
// right end, its `mods` button with it, is cut off; set from what the band showed.
const PROPORTIONAL_TEXT = 0.85

/** A segment's text as it draws: its rich runs where the band draws pictures, else its text. */
const textWidth = (segment: Segment, isPictured: boolean): number => {
  if (!isPictured) return segment.text.length
  const text = (characters: number) => Math.ceil(characters * PROPORTIONAL_TEXT)
  if (segment.rich === undefined) return text(segment.text.length)

  let pictures = 0
  let characters = 0
  for (const part of segment.rich) {
    if (part.ring !== undefined || part.icon !== undefined) pictures += 1
    else characters += part.text.length
  }

  return pictures * PICTURE_COLUMNS + text(characters)
}

/**
 * A segment's width; a button adds its label, its hotkey and the brackets around them. Where the
 * band draws pictures, a segment with rich runs counts those as drawn (a picture its cells, not its
 * text), and a button on the text adds nothing: the text is the button there.
 */
const widthOf = (segment: Segment, isPictured: boolean): number => {
  const text = textWidth(segment, isPictured)
  // A compact segment's button is on its text or left out: it takes no room of its own.
  const button = segment.isCompact === true || (isPictured && segment.button?.isOnText === true) ? undefined : segment.button

  return (
    text +
    (button === undefined
      ? 0
      : button.hotkey === undefined
        ? button.label.length + 1
        : button.label.length + button.hotkey.length + 3)
  )
}

/** The label of the band's last button, which opens and closes the Mods pane: `mods`, or `mods +N` with N dropped. */
export const toggleLabel = (hidden: number, word = 'mods'): string => (hidden > 0 ? `${word} +${hidden}` : word)

/** The hotkey of that button; no mod's button takes it in the band. */
export const TOGGLE_HOTKEY = 'm'

/** That button with its least space before it (as wide as a separator), its hotkey and the `: ` after it. */
const toggleWidth = (hidden: number): number => ROW_SEPARATOR + TOGGLE_HOTKEY.length + 2 + toggleLabel(hidden).length

const cut = (text: string, columns: number): string =>
  text.length <= columns ? text : `${text.slice(0, Math.max(0, columns - 1))}…`

/** A row's width: its segments and the separators between them. */
const rowWidth = (segments: readonly Segment[], isPictured: boolean): number =>
  segments.reduce(
    (sum, segment, at) => sum + (at > 0 ? (isPictured ? PICTURED_SEPARATOR : ROW_SEPARATOR) : 0) + widthOf(segment, isPictured),
    0,
  )

/**
 * The segments in order in one row, else in two with the first as full as it
 * can be, `reserve` kept free on the last; undefined when they do not fit. Not
 * first-fit: a full first row could leave the second no room for the reserve.
 */
const pack = (segments: readonly Segment[], columns: number, reserve: number, isPictured: boolean): Segment[][] | undefined => {
  if (segments.length === 0) return []
  if (rowWidth(segments, isPictured) + reserve <= columns) return [[...segments]]

  for (let split = segments.length - 1; split > 0; split--) {
    const first = segments.slice(0, split)
    const last = segments.slice(split)

    if (rowWidth(first, isPictured) <= columns && rowWidth(last, isPictured) + reserve <= columns) return [first, last]
  }

  return undefined
}

/** A segment in its compact form, marked so; one without a compact form as it is. */
export const compacted = (one: Segment): Segment => {
  const { compact, ...rest } = one

  return compact === undefined ? one : { ...rest, text: compact.text, parts: compact.parts, rich: compact.rich, isCompact: true }
}

/**
 * Lays segments out in one row; short of room, switches every segment with a
 * compact form to it, then takes two rows, then drops the lowest priority ones.
 * The last row always keeps room for the `mods` button, which counts the dropped.
 * `isPictured` for a band that draws pictures (the desktop app): segments count
 * as they draw there, see `widthOf`.
 */
export const layout = (segments: readonly Segment[], columns: number, isPictured = false): Layout => {
  const full = ordered(segments)
  const single = pack(full, columns, toggleWidth(0), isPictured)

  if (single !== undefined && single.length <= 1) return { rows: single, hidden: [] }

  const sorted = full.map(compacted)
  const all = pack(sorted, columns, toggleWidth(0), isPictured)

  if (all !== undefined) return { rows: all, hidden: [] }

  for (let keep = sorted.length - 1; keep > 0; keep--) {
    const rows = pack(sorted.slice(0, keep), columns, toggleWidth(sorted.length - keep), isPictured)

    if (rows !== undefined) return { rows, hidden: sorted.slice(keep).map(one => one.name) }
  }

  // Not even the first fits beside the button: keep it alone, cut to the room left. Its parts no
  // longer join to a cut text, so it draws in one run, its rich runs left out with them. Rich runs
  // wider than the room are left out too, where the text whole fits.
  const [first, ...rest] = sorted
  const room = Math.max(1, columns - toggleWidth(rest.length))
  const text = first === undefined ? '' : cut(first.text, room)

  return {
    rows:
      first === undefined
        ? []
        : [
            [
              text !== first.text
                ? { ...first, text, parts: undefined, rich: undefined }
                : textWidth(first, isPictured) > room
                  ? { ...first, rich: undefined }
                  : first,
            ],
          ],
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
