import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

const EXPANDED = atom({ plugin: 'ak-mods', key: 'expanded' } as const, {})

export const FOOTER = 'Switches reset in a new chat or after /clear. Standard mods start on.'

const fit = (text: string, columns: number): string =>
  text.length <= columns ? text : `${text.slice(0, Math.max(0, columns - 1))}…`

/** Draws the Mods pane: one row per declared mod, with its three buttons. */
export async function renderPane($: EngineInterface, e: Parameters<EngineInterface['ui']['resolve']>[0] & { props: { bodyColumns: number } }) {
  const { Box, Button, Text } = $.ui.resolve(e)
  const columns = Math.max(1, e.props.bodyColumns)
  const list = await $.mods.list()
  const { value: expanded = {} } = await $.state.get({ plugin: 'ak-mods', key: 'expanded' })

  return (
    <Box flexDirection="column">
      {list.length === 0 && <Text dimColor>No AgentKit mods installed.</Text>}
      {list.map(row => (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>{fit(row.title, columns)}</Text>
          <Text dimColor>{fit(row.summary, columns)}</Text>
          {expanded[row.name] === true && <Text dimColor>{fit(row.details, columns)}</Text>}
          <Box>
            <Button
              key={`on-${row.name}`}
              label={row.isOn ? 'On' : 'Off'}
              onPress={() => $.mods.set({ name: row.name, on: !row.isOn })}
            />
            <Text> </Text>
            <Button
              key={`std-${row.name}`}
              label={row.isStandard ? 'Standard ✓' : 'Standard'}
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
      <Text dimColor>{fit(FOOTER, columns)}</Text>
    </Box>
  )
}
