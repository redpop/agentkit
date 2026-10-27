import type { EngineInterface, Next, RenderInput } from 'claude-code'

import type { ModsInfo, ModsSegment, ModsTone } from '../types'
import { layout } from './band'
import type { Segment } from './band'

const TONES: readonly string[] = ['ok', 'warn', 'alert', 'info', 'dim'] satisfies ModsTone[]

const compareTitles = (a: Segment, b: Segment): number => {
  const [x, y] = [a.title.toLowerCase(), b.title.toLowerCase()]

  return x < y ? -1 : x > y ? 1 : 0
}

/**
 * A stored segment as the band can draw it, or undefined. Segments are stored
 * unchecked: an unknown tone draws uncoloured, a priority that is no number
 * takes the default, a button without a label or command is left out, and a
 * segment without text is not drawn.
 */
const checked = (info: ModsInfo, stored: unknown): Segment | undefined => {
  const one = (stored ?? {}) as Partial<Record<keyof ModsSegment, unknown>>
  if (typeof one.text !== 'string' || one.text === '') return undefined
  const button = (one.button ?? {}) as Partial<Record<string, unknown>>

  return {
    name: info.name,
    title: info.title,
    text: one.text,
    tone: typeof one.tone === 'string' && TONES.includes(one.tone) ? (one.tone as ModsTone) : undefined,
    priority: typeof one.priority === 'number' && Number.isFinite(one.priority) ? one.priority : undefined,
    button:
      typeof button.label === 'string' && typeof button.command === 'string'
        ? {
            label: button.label,
            command: button.command,
            hotkey: typeof button.hotkey === 'string' ? button.hotkey : undefined,
            args: typeof button.args === 'string' ? button.args : undefined,
          }
        : undefined,
  }
}

/**
 * Draws the shared band above the prompt on the terminal: the segments of the
 * switched-on mods in up to two rows, a `+N` chip for those that did not fit,
 * then whatever lies beneath.
 */
export async function renderBand(
  $: EngineInterface,
  e: RenderInput<'AbovePrompt'>,
  next: Next<'ui.render', RenderInput<'AbovePrompt'>>,
) {
  // The reads subscribe the drawing: a switch, a declare or a publish redraws it.
  const [{ value: on = {} }, { value: declared = [] }, { value: stored = {} }] = await Promise.all([
    $.state.get({ plugin: 'ak-mods', key: 'on' }),
    $.state.get({ plugin: 'ak-mods', key: 'declared' }),
    $.state.get({ plugin: 'ak-mods', key: 'segments' }),
  ])
  if (e.surface !== 'terminal' || e.props.hasSurvey) return next(e)

  // A publish can land after its mod's switch-off cleared it: the switch decides.
  const segments = declared
    .filter(info => on[info.name] === true)
    .map(info => checked(info, stored[info.name]))
    .filter(one => one !== undefined)
  if (segments.length === 0) return next(e)

  // Two mods on one hotkey: the first by title keeps it, the later goes without.
  const hotkeys = new Map<string, string>()
  for (const one of [...segments].sort(compareTitles)) {
    const hotkey = one.button?.hotkey
    if (hotkey !== undefined && ![...hotkeys.values()].includes(hotkey)) hotkeys.set(one.name, hotkey)
  }

  const { rows, hidden } = layout(segments, e.props.bodyColumns)
  const below = await next(e)
  const { Box, Button, Text } = $.ui.resolve(e)
  const toned = (one: Segment) =>
    one.tone === 'ok' ? (
      <Text color="green">{one.text}</Text>
    ) : one.tone === 'warn' ? (
      <Text color="yellow">{one.text}</Text>
    ) : one.tone === 'alert' ? (
      <Text color="red" bold>
        {one.text}
      </Text>
    ) : one.tone === 'info' ? (
      <Text color="cyan">{one.text}</Text>
    ) : one.tone === 'dim' ? (
      <Text dimColor>{one.text}</Text>
    ) : (
      <Text>{one.text}</Text>
    )
  const separator = () => <Text dimColor> │ </Text>
  // Buttons draw plain (`1: label`, `+N`): the widths `layout` counts.

  const band = (
    <Box flexDirection="column">
      {rows.map((row, index) => (
        <Box key={`band-row-${index}`} flexDirection="row">
          {row.flatMap((one, at) => [
            ...(at > 0 ? [separator()] : []),
            toned(one),
            ...(one.button === undefined
              ? []
              : [
                  <Text> </Text>,
                  <Button
                    key={`seg-${one.name}`}
                    label={one.button.label}
                    hotkey={hotkeys.get(one.name)}
                    plain
                    onPress={() => $.command.run({ command: one.button?.command ?? '', args: one.button?.args ?? '' })}
                  />,
                ]),
          ])}
          {index === rows.length - 1 && hidden.length > 0 && [
            separator(),
            <Button
              key="more-segments"
              label={`+${hidden.length}`}
              plain
              onPress={() => $.ui.open({ id: 'ak-mods', title: 'Mods' })}
            />,
          ]}
        </Box>
      ))}
    </Box>
  )

  return <Box flexDirection="column">{below ? [band, below] : [band]}</Box>
}
