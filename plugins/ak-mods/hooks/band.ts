export type Tone = 'ok' | 'warn' | 'alert' | 'info' | 'dim'

export type Segment = {
  name: string
  title: string
  text: string
  tone?: Tone
  priority?: number
  button?: { label: string; hotkey?: string; command: string; args?: string }
}

/** Up to two rows of segments; `hidden` holds the mod names that did not fit. */
export type Layout = { rows: readonly (readonly Segment[])[]; hidden: readonly string[] }

const ROW_SEPARATOR = 3
const MAX_ROWS = 2

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

/** The `+N` chip with its separator. */
const chipWidth = (count: number): number => ROW_SEPARATOR + 2 + String(count).length

const cut = (text: string, columns: number): string =>
  text.length <= columns ? text : `${text.slice(0, Math.max(0, columns - 1))}…`

/** The segments packed first-fit into at most two rows, with `reserve` kept free on the last; undefined when they do not fit. */
const pack = (segments: readonly Segment[], columns: number, reserve: number): Segment[][] | undefined => {
  const rows: Segment[][] = []
  let used = 0

  for (const segment of segments) {
    const width = widthOf(segment)
    const row = rows[rows.length - 1]
    const next = used + ROW_SEPARATOR + width

    if (row !== undefined && next <= columns) {
      row.push(segment)
      used = next
    } else if (rows.length < MAX_ROWS && width <= columns) {
      rows.push([segment])
      used = width
    } else {
      return undefined
    }
  }

  return used + (rows.length > 0 ? reserve : 0) <= columns ? rows : undefined
}

/** Lays segments out in one row, then two, then drops the lowest priority ones and leaves room for a `+N` chip. */
export const layout = (segments: readonly Segment[], columns: number): Layout => {
  const sorted = ordered(segments)
  const all = pack(sorted, columns, 0)

  if (all !== undefined) return { rows: all, hidden: [] }

  for (let keep = sorted.length - 1; keep > 0; keep--) {
    const rows = pack(sorted.slice(0, keep), columns, chipWidth(sorted.length - keep))

    if (rows !== undefined) return { rows, hidden: sorted.slice(keep).map(one => one.name) }
  }

  // Not even the first fits with a chip: keep it alone, cut to the width.
  const [first, ...rest] = sorted

  return {
    rows: first === undefined ? [] : [[{ ...first, text: cut(first.text, columns) }]],
    hidden: rest.map(one => one.name),
  }
}

const FOOTER_SEPARATOR = ' · '

const footerText = (segment: Segment): string =>
  segment.button === undefined ? segment.text : `${segment.text} /${segment.button.command}`

/** One line for the desktop footer: texts joined by dots, the lowest priority dropped, ending with `+N`. */
export const footerLabel = (
  segments: readonly Segment[],
  columns: number,
): { text: string; hidden: readonly string[] } => {
  const sorted = ordered(segments)
  const texts = sorted.map(footerText)
  const all = texts.join(FOOTER_SEPARATOR)

  if (all.length <= columns) return { text: all, hidden: [] }

  for (let keep = sorted.length - 1; keep > 0; keep--) {
    const text = `${texts.slice(0, keep).join(FOOTER_SEPARATOR)}${FOOTER_SEPARATOR}+${sorted.length - keep}`

    if (text.length <= columns) return { text, hidden: sorted.slice(keep).map(one => one.name) }
  }

  return { text: cut(texts[0] ?? '', columns), hidden: sorted.slice(1).map(one => one.name) }
}
