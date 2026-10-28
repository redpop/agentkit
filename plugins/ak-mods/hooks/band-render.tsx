import type { BoxProps, ElementConstructor, EngineInterface, Next, RenderInput, SvgProps, TextProps } from 'claude-code'

import type { ModsCardRow, ModsInfo, ModsPart, ModsRow, ModsSegment, ModsTone } from '../types'
import { bandWidth, layout, TOGGLE_HOTKEY, toggleLabel } from './band'
import type { Segment } from './band'
import { togglePane } from './toggle'

const TONES: readonly string[] = ['ok', 'warn', 'alert', 'info', 'dim'] satisfies ModsTone[]

const compareTitles = (a: Segment, b: Segment): number => {
  const [x, y] = [a.title.toLowerCase(), b.title.toLowerCase()]

  return x < y ? -1 : x > y ? 1 : 0
}

// A control character (a newline, ESC) would break the band's two rows, or
// reach the terminal raw.
const CONTROL = /[\u0000-\u001f\u007f]/g

const spaced = (text: string): string => text.replace(CONTROL, ' ')

/** A hotkey the band can arm: exactly one printable character, else none. */
const hotkeyOf = (hotkey: unknown): string | undefined =>
  typeof hotkey === 'string' && hotkey.length === 1 && spaced(hotkey) === hotkey ? hotkey : undefined

const toneOf = (tone: unknown): ModsTone | undefined =>
  typeof tone === 'string' && TONES.includes(tone) ? (tone as ModsTone) : undefined

/** The runs of a segment's text, or undefined when they are no list of texts or do not join to it. */
const partsOf = (parts: unknown, text: string): ModsPart[] | undefined => {
  if (!Array.isArray(parts)) return undefined
  const runs = (parts as Partial<Record<keyof ModsPart, unknown>>[]).map(part =>
    typeof part?.text === 'string' ? { text: spaced(part.text), tone: toneOf(part.tone) } : undefined,
  )
  if (runs.some(run => run === undefined)) return undefined
  const joined = runs as ModsPart[]

  return joined.map(run => run.text).join('') === text ? joined.filter(run => run.text !== '') : undefined
}

const ringOf = (ring: unknown): number | undefined =>
  typeof ring === 'number' && Number.isFinite(ring) ? Math.min(100, Math.max(0, ring)) : undefined

/** The rich runs of a segment, or undefined when they are no list of texts or say nothing. */
const richOf = (rich: unknown): ModsPart[] | undefined => {
  if (!Array.isArray(rich)) return undefined
  const runs = (rich as Partial<Record<keyof ModsPart, unknown>>[]).map(part =>
    typeof part?.text === 'string' ? { text: spaced(part.text), tone: toneOf(part.tone), ring: ringOf(part.ring) } : undefined,
  )
  if (runs.some(run => run === undefined)) return undefined
  const kept = (runs as ModsPart[]).filter(run => run.text !== '' || run.ring !== undefined)

  return kept.length > 0 ? kept : undefined
}

/** The rows of a segment's card, or undefined when they are no list of label and value texts or none. */
const cardOf = (card: unknown): ModsCardRow[] | undefined => {
  if (!Array.isArray(card) || card.length === 0) return undefined
  const rows = (card as Partial<Record<keyof ModsCardRow, unknown>>[]).map(row =>
    typeof row?.label === 'string' && typeof row.value === 'string' ? { label: spaced(row.label), value: spaced(row.value) } : undefined,
  )

  return rows.some(row => row === undefined) ? undefined : (rows as ModsCardRow[])
}

/**
 * A stored segment as the band can draw it, or undefined. Segments are stored
 * unchecked: an unknown tone draws uncoloured, a priority that is no number
 * takes the default, a control character in a text, a part, a label or a
 * command draws as a space, a hotkey that is not one printable character is
 * left out, a button without a label or command is left out, a detail that
 * is no text is left out, parts that do not join to the text are left out,
 * rich runs that are no list of texts are left out, a ring is held to 0 to
 * 100, card rows that are no list of label and value texts are left out, and
 * a segment without text is not drawn.
 */
const checked = (info: ModsInfo, stored: unknown): Segment | undefined => {
  const one = (stored ?? {}) as Partial<Record<keyof ModsSegment, unknown>>
  if (typeof one.text !== 'string' || one.text === '') return undefined
  const button = (one.button ?? {}) as Partial<Record<string, unknown>>

  const text = spaced(one.text)

  return {
    name: info.name,
    title: info.title,
    text,
    parts: partsOf(one.parts, text),
    rich: richOf(one.rich),
    detail: typeof one.detail === 'string' && one.detail !== '' ? spaced(one.detail) : undefined,
    card: cardOf(one.card),
    tone: toneOf(one.tone),
    priority: typeof one.priority === 'number' && Number.isFinite(one.priority) ? one.priority : undefined,
    button:
      typeof button.label === 'string' && typeof button.command === 'string'
        ? {
            label: spaced(button.label),
            command: spaced(button.command),
            hotkey: hotkeyOf(button.hotkey),
            args: typeof button.args === 'string' ? button.args : undefined,
          }
        : undefined,
  }
}

/**
 * How a tone draws, the same in the band and the Mods pane. Colour marks what
 * needs attention: `ok` draws in the text colour, so a band at rest stays
 * quiet and a warning or an error stands out. The colours are theme keys:
 * they follow the person's theme, light or dark.
 */
export const toneProps = (
  tone: ModsTone | undefined,
): { color?: 'warning' | 'error' | 'suggestion'; bold?: true; dimColor?: true } =>
  tone === 'warn'
    ? { color: 'warning' }
    : tone === 'alert'
      ? { color: 'error', bold: true }
      : tone === 'info'
        ? { color: 'suggestion' }
        : tone === 'dim'
          ? { dimColor: true }
          : {}

// A ring's colours: the light theme's in the markup, the dark theme's through the colour-scheme
// query of the picture itself, as the desktop gives the band no light or dark signal. A ring at
// rest draws in the text colour, as a tone does.
const INK = { light: '#2b2a27', dark: '#ecebe6' }
const TRACK = { light: '#d9d6cf', dark: '#4a4945' }
const RING_TONES: Record<ModsTone, { light: string; dark: string }> = {
  ok: INK,
  warn: { light: '#b7791f', dark: '#e3a53b' },
  alert: { light: '#c53030', dark: '#f0675c' },
  info: { light: '#2b6cb0', dark: '#64a7ea' },
  dim: { light: '#9a968d', dark: '#8a877f' },
}

/** A ring filled `percent` of the way round from the top, clockwise, in a tone's colour. */
export const ringSvg = (percent: number, tone: ModsTone | undefined): string => {
  const { light, dark } = RING_TONES[tone ?? 'ok']
  const round = 2 * Math.PI * 6
  const arc = (round * percent) / 100

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
    `<style>.t{stroke:${TRACK.light}}.f{stroke:${light}}` +
    `@media (prefers-color-scheme: dark){.t{stroke:${TRACK.dark}}.f{stroke:${dark}}}</style>` +
    '<circle class="t" cx="8" cy="8" r="6" fill="none" stroke-width="2.6"/>' +
    (arc > 0
      ? `<circle class="f" cx="8" cy="8" r="6" fill="none" stroke-width="2.6" stroke-linecap="round" ` +
        `stroke-dasharray="${arc.toFixed(2)} ${round.toFixed(2)}" transform="rotate(-90 8 8)"/>`
      : '') +
    '</svg>'
  )
}

type Draws = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Svg?: ElementConstructor<SvgProps>
}

/**
 * A segment as a surface that draws pictures shows it: its rich runs, a ring
 * as a picture in the line, the rest as text in its tone. The terminal draws
 * no pictures; there, and for a segment without rich runs, its text.
 */
export const segmentView = ({ Box, Text, Svg }: Draws, surface: string, one: Segment, key: string) =>
  surface === 'terminal' || Svg === undefined || one.rich === undefined ? (
    segmentText(Text, one, key)
  ) : (
    <Box key={key} flexDirection="row" alignItems="center">
      {one.rich.map((part, at) =>
        part.ring === undefined ? (
          <Text key={`${key}-${at}`} tabular {...toneProps(part.tone ?? one.tone)}>
            {part.text}
          </Text>
        ) : (
          <Svg key={`${key}-${at}`} source={ringSvg(part.ring, part.tone ?? one.tone)} alt={part.text} width={16} height={16} />
        ),
      )}
    </Box>
  )

/**
 * A segment's card, which the desktop app shows while the pointer is over the
 * segment: its mod's title, then its rows, the dim labels in one column and
 * the values beside them; a segment without rows shows its detail, a line a
 * part. Placed above the segment, against its left edge, or its right edge for
 * a segment in the right half of the row, so it stays in the window.
 */
export const detailCard = ({ Box, Text }: Draws, one: Segment, key: string, isRight: boolean) => {
  const rows = one.card ?? one.detail?.split(' · ').map(line => ({ label: '', value: line }))
  if (rows === undefined) return null
  // The label column is as wide as its longest label; a desktop Box counts its width in text cells.
  const column = Math.max(0, ...rows.map(row => row.label.length))

  // No key on the card itself: a keyed Box would scope its own hover, which a hidden Box never gets.
  return (
    <Box
      position="absolute"
      bottom={1}
      {...(isRight ? { right: 0 } : { left: 0 })}
      display="none"
      hover={{ display: 'flex' }}
      flexDirection="column"
      rowGap={0}
      paddingX={1}
      borderStyle="round"
      borderColor="subtle"
      backgroundColor="Canvas"
    >
      <Box marginBottom={1}>
        <Text bold>{one.title}</Text>
      </Box>
      {rows.map((row, at) => (
        <Box key={`${key}-${at}`} flexDirection="row" columnGap={2}>
          {column > 0 && (
            <Box width={column} flexShrink={0}>
              <Text dimColor>{row.label}</Text>
            </Box>
          )}
          <Text tabular>{row.value}</Text>
        </Box>
      ))}
    </Box>
  )
}

/**
 * A segment's text as the band and the Mods pane draw it: in one run in its
 * tone, or in its parts, each in its own tone or else the segment's. Its
 * digits are of one width, so a figure that counts down does not shift.
 */
export const segmentText = (Text: ElementConstructor<TextProps>, one: Segment, key: string) =>
  one.parts === undefined ? (
    <Text key={key} tabular {...toneProps(one.tone)}>
      {one.text}
    </Text>
  ) : (
    <Text key={key} tabular>
      {one.parts.map((part, at) => (
        <Text key={`${key}-${at}`} {...toneProps(part.tone ?? one.tone)}>
          {part.text}
        </Text>
      ))}
    </Text>
  )

/**
 * The segments of the switched-on declared mods, each checked. A publish can
 * land after its mod's switch-off cleared it: the switch decides. The rows
 * are `$.mods.list()`'s, whose switches are the chat's even while a resume
 * has emptied the state until the next turn.
 */
export const drawable = (rows: readonly ModsRow[], stored: Record<string, unknown>): Segment[] =>
  rows
    .filter(row => row.isOn)
    .map(row => checked(row, stored[row.name]))
    .filter(one => one !== undefined)

/**
 * Draws the shared band above the prompt on the terminal and the desktop
 * app: the segments of the switched-on mods in up to two rows, a `mods`
 * button that opens and closes the Mods pane and counts those that did not
 * fit, then whatever lies beneath.
 */
export async function renderBand(
  $: EngineInterface,
  e: RenderInput<'AbovePrompt'>,
  next: Next<'ui.render', RenderInput<'AbovePrompt'>>,
) {
  // The reads subscribe the drawing: a switch, a declare or a publish redraws
  // it (the list reads the switches and the declared mods).
  const [list, { value: stored = {} }] = await Promise.all([
    $.mods.list(),
    $.state.get({ plugin: 'ak-mods', key: 'segments' }),
  ])
  if ((e.surface !== 'terminal' && e.surface !== 'desktop') || e.props.hasSurvey) return next(e)

  const segments = drawable(list, stored)
  if (segments.length === 0) return next(e)

  const { rows, hidden } = layout(segments, e.props.bodyColumns)

  // Two shown mods on one hotkey: the first by title keeps it, the later goes
  // without. A mod behind the `mods` button takes none, and none takes the
  // button's own.
  const hotkeys = new Map<string, string>()
  for (const one of rows.flat().sort(compareTitles)) {
    const hotkey = one.button?.hotkey
    if (hotkey !== undefined && hotkey !== TOGGLE_HOTKEY && ![...hotkeys.values()].includes(hotkey)) hotkeys.set(one.name, hotkey)
  }

  const below = await next(e)
  const draws = $.ui.resolve(e)
  const { Box, Button, Text } = draws
  // A cell of space between two segments, three with its two gaps: no rule
  // draws there, the space alone parts them.
  const separator = (key: string) => <Box key={key} minWidth={1} />
  // Every space is a gap of the Box, one cell wide: a surface that draws its
  // buttons with chrome spaces them alike. Buttons draw plain (`1: label`,
  // `m: mods +N`): the widths `layout` counts, with the separator and its two
  // gaps as three, a segment's text and button one apart. The `mods` button
  // sits at the right edge of the last row, at least three from the last
  // segment.

  const band = (
    <Box flexDirection="column">
      {rows.map((row, index) => (
        <Box key={`band-row-${index}`} flexDirection="row" columnGap={1}>
          {row.flatMap((one, at) => [
            ...(at > 0 ? [separator(`sep-${one.name}`)] : []),
            <Box key={`segment-${one.name}`} flexDirection="row" columnGap={1}>
              {segmentView(draws, e.surface, one, `text-${one.name}`)}
              {/* The keyed segment Box is the hover scope: the pointer anywhere on it shows the card. */}
              {e.surface === 'desktop' && detailCard(draws, one, `card-${one.name}`, row.length > 1 && at >= row.length / 2)}
              {one.button !== undefined && (
                <Button
                  key={`seg-${one.name}`}
                  label={one.button.label}
                  hotkey={hotkeys.get(one.name)}
                  plain
                  onPress={() => {
                    // A command the host refuses changes nothing in the band.
                    $.command.run({ command: one.button?.command ?? '', args: one.button?.args ?? '' }).catch(() => {})
                  }}
                />
              )}
            </Box>,
          ])}
          {index === rows.length - 1 && [
            <Box key="mods-space" flexGrow={1} minWidth={1} />,
            <Button
              key="mods-toggle"
              label={toggleLabel(hidden.length)}
              hotkey={TOGGLE_HOTKEY}
              plain
              dimColor
              onPress={() => {
                // A failed close or open leaves the band as it is.
                togglePane($, bandWidth({ bodyColumns: e.props.bodyColumns })).catch(() => {})
              }}
            />,
          ]}
        </Box>
      ))}
    </Box>
  )

  return <Box flexDirection="column">{below ? [band, below] : [band]}</Box>
}
