import type { EngineInterface, Next, RenderInput } from 'claude-code'

import type { ModsInfo, ModsRow, ModsSegment, ModsTone } from '../types'
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

/**
 * A stored segment as the band can draw it, or undefined. Segments are stored
 * unchecked: an unknown tone draws uncoloured, a priority that is no number
 * takes the default, a control character in a text, a label or a command
 * draws as a space, a hotkey that is not one printable character is left
 * out, a button without a label or command is left out, and a segment
 * without text is not drawn.
 */
const checked = (info: ModsInfo, stored: unknown): Segment | undefined => {
  const one = (stored ?? {}) as Partial<Record<keyof ModsSegment, unknown>>
  if (typeof one.text !== 'string' || one.text === '') return undefined
  const button = (one.button ?? {}) as Partial<Record<string, unknown>>

  return {
    name: info.name,
    title: info.title,
    text: spaced(one.text),
    tone: typeof one.tone === 'string' && TONES.includes(one.tone) ? (one.tone as ModsTone) : undefined,
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
  const { Box, Button, Text } = $.ui.resolve(e)
  const toned = (one: Segment) => {
    const key = `text-${one.name}`

    return one.tone === 'ok' ? (
      <Text key={key} color="green">
        {one.text}
      </Text>
    ) : one.tone === 'warn' ? (
      <Text key={key} color="yellow">
        {one.text}
      </Text>
    ) : one.tone === 'alert' ? (
      <Text key={key} color="red" bold>
        {one.text}
      </Text>
    ) : one.tone === 'info' ? (
      <Text key={key} color="cyan">
        {one.text}
      </Text>
    ) : one.tone === 'dim' ? (
      <Text key={key} dimColor>
        {one.text}
      </Text>
    ) : (
      <Text key={key}>{one.text}</Text>
    )
  }
  const separator = (key: string) => (
    <Text key={key} dimColor>
      {' │ '}
    </Text>
  )
  // Buttons draw plain (`1: label`, `m: mods +N`): the widths `layout` counts.

  const band = (
    <Box flexDirection="column">
      {rows.map((row, index) => (
        <Box key={`band-row-${index}`} flexDirection="row">
          {row.flatMap((one, at) => [
            ...(at > 0 ? [separator(`sep-${one.name}`)] : []),
            toned(one),
            ...(one.button === undefined
              ? []
              : [
                  <Text key={`gap-${one.name}`}> </Text>,
                  <Button
                    key={`seg-${one.name}`}
                    label={one.button.label}
                    hotkey={hotkeys.get(one.name)}
                    plain
                    onPress={() => {
                      // A command the host refuses changes nothing in the band.
                      $.command.run({ command: one.button?.command ?? '', args: one.button?.args ?? '' }).catch(() => {})
                    }}
                  />,
                ]),
          ])}
          {index === rows.length - 1 && [
            separator('sep-mods'),
            <Button
              key="mods-toggle"
              label={toggleLabel(hidden.length)}
              hotkey={TOGGLE_HOTKEY}
              plain
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
