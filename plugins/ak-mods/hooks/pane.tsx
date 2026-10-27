import { atom, update } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import { FOOTER_COLUMNS, footerLabel, layout } from './band'
import { drawable } from './band-render'

const EXPANDED = atom({ plugin: 'ak-mods', key: 'expanded' } as const, {})

export const FOOTER = 'Switches reset in a new chat or after /clear. Standard mods start on.'

/** The warning for the mods the band dropped, titles in display order; undefined when all fit. */
const warning = (hidden: readonly string[], titles: ReadonlyMap<string, string>): string | undefined =>
  hidden.length === 0
    ? undefined
    : `${hidden.length} ${hidden.length === 1 ? 'mod does' : 'mods do'} not fit the band: ${hidden
        .map(name => titles.get(name) ?? name)
        .join(', ')}`

/** Draws the Mods pane: one row per declared mod, with its three buttons. Texts wrap. */
export async function renderPane($: EngineInterface, e: RenderInput<'Pane'>) {
  const { Box, Button, Text } = $.ui.resolve(e)
  const list = await $.mods.list()
  // The reads subscribe the pane: a switch, a declare or a publish redraws it.
  const [{ value: expanded = {} }, { value: on = {} }, { value: declared = [] }, { value: stored = {} }] =
    await Promise.all([
      $.state.get({ plugin: 'ak-mods', key: 'expanded' }),
      $.state.get({ plugin: 'ak-mods', key: 'on' }),
      $.state.get({ plugin: 'ak-mods', key: 'declared' }),
      $.state.get({ plugin: 'ak-mods', key: 'segments' }),
    ])

  // The cut the band makes, counted again here. No hook outside a drawing sees
  // the band's width (`command.run` has the terminal's, only as a command
  // runs), and a drawing may not record it. So the terminal counts with the
  // pane's own width, which can differ from the band's: the warning is
  // approximate there, counted afresh at each redraw. The desktop counts with
  // the footer's width, as the footer does.
  const segments = drawable(on, declared, stored)
  const hidden =
    segments.length === 0
      ? []
      : e.surface === 'terminal'
        ? layout(segments, e.props.bodyColumns).hidden
        : e.surface === 'desktop'
          ? footerLabel(segments, FOOTER_COLUMNS).hidden
          : []
  const dropped = warning(hidden, new Map(declared.map(info => [info.name, info.title])))

  return (
    <Box flexDirection="column">
      {list.length === 0 && <Text dimColor>No AgentKit mods installed.</Text>}
      {list.map(row => (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>{row.title}</Text>
          <Text dimColor>{row.summary}</Text>
          {expanded[row.name] === true && <Text dimColor>{row.details}</Text>}
          <Box>
            <Button
              key={`on-${row.name}`}
              label={row.isOn ? '● On' : '○ Off'}
              onPress={() => $.mods.set({ name: row.name, on: !row.isOn })}
            />
            <Text> </Text>
            <Button
              key={`std-${row.name}`}
              label={row.isStandard ? '★ Standard' : '☆ Standard'}
              onPress={() => $.mods.setStandard({ name: row.name, standard: !row.isStandard })}
            />
            <Text> </Text>
            <Button
              key={`more-${row.name}`}
              label={expanded[row.name] === true ? 'Less' : 'More'}
              onPress={() => update($, EXPANDED, map => ({ ...map, [row.name]: map[row.name] !== true }))}
            />
          </Box>
        </Box>
      ))}
      {dropped !== undefined && <Text dimColor>{dropped}</Text>}
      <Text dimColor>{FOOTER}</Text>
    </Box>
  )
}
