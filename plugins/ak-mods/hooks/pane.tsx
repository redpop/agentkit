import { atom, update } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import { layout } from './band'
import { cardRows, drawable, segmentView } from './band-render'
import { languageFor, texts } from './i18n'

const EXPANDED = atom({ plugin: 'ak-mods', key: 'expanded' } as const, {})

/** The warning for the mods the band dropped, titles in display order; undefined when all fit. */
const warning = (
  hidden: readonly string[],
  titles: ReadonlyMap<string, string>,
  t: ReturnType<typeof texts>,
): string | undefined =>
  hidden.length === 0 ? undefined : t.dropped(hidden.length, hidden.map(name => titles.get(name) ?? name).join(', '))

/** Draws the Mods pane: one row per declared mod, with its three buttons. Texts wrap. */
export async function renderPane($: EngineInterface, e: RenderInput<'Pane'>) {
  const draws = $.ui.resolve(e)
  const { Box, Button, Text } = draws
  // The reads subscribe the pane: a switch, a declare or a publish redraws it
  // (the list reads the switches and the declared mods).
  const [list, { value: expanded = {} }, { value: stored = {} }, { value: width = e.props.bodyColumns }] =
    await Promise.all([
      $.mods.list(),
      $.state.get({ plugin: 'ak-mods', key: 'expanded' }),
      $.state.get({ plugin: 'ak-mods', key: 'segments' }),
      $.state.get({ plugin: 'ak-mods', key: 'width' }),
    ])

  // The cut the band makes, counted again here, on the surfaces that draw the
  // band. It counts with the band's width (see `bandWidth`) as `/ak-mods` or
  // the band's `mods` button last recorded it (a docked pane is narrower than the
  // band), the pane's own only before that is known: approximate after a
  // resize, until either records it again.
  const segments = drawable(list, stored)
  const hidden =
    segments.length > 0 && (e.surface === 'terminal' || e.surface === 'desktop') ? layout(segments, width).hidden : []
  const t = texts(await languageFor($))
  const dropped = warning(hidden, new Map(list.map(row => [row.name, row.title])), t)
  // Each row's current segment too, in its band colour: the pane draws on every
  // surface, the band only on the terminal and the desktop app.
  const current = new Map(segments.map(one => [one.name, one]))

  return (
    <Box flexDirection="column">
      {list.length === 0 && <Text dimColor>No AgentKit mods installed.</Text>}
      {list.map(row => {
        const one = current.get(row.name)
        // A surface that draws pictures lists the card's rows under the segment, each value once, while
        // the row is open (the details link); closed, the segment alone. The terminal adds the detail after it.
        const isOpen = expanded[row.name] === true
        const rows = e.surface !== 'terminal' ? one?.card : undefined

        // A row reads top to bottom: the title with its two switches on the right, what the mod does,
        // its live segment, then what opens under the details link. The switch is the one framed button; the
        // standard mark and the details link stay plain, so the live state leads.
        // On a surface that draws pictures each mod sits on a faint surface of its own, rounded and
        // edged by a hairline, as grouped settings do: where a mod begins and ends shows without a
        // rule between them. A translucent grey reads on a light and a dark theme alike. The terminal
        // parts the mods by space.
        const surface =
          e.surface === 'terminal'
            ? { marginBottom: 2 }
            : {
                marginBottom: 1,
                paddingX: 1,
                paddingY: 1,
                borderStyle: 'round',
                borderColor: 'rgba(127,127,127,0.22)',
                backgroundColor: 'rgba(127,127,127,0.06)',
              }

        return (
          <Box flexDirection="column" {...surface}>
            <Box flexDirection="row" alignItems="center" columnGap={2}>
              <Box flexGrow={1}>
                <Text bold>{row.title}</Text>
              </Box>
              <Button
                key={`std-${row.name}`}
                label={row.isStandard ? t.standard : t.notStandard}
                plain
                dimColor={!row.isStandard}
                onPress={() => $.mods.setStandard({ name: row.name, standard: !row.isStandard })}
              />
              <Button
                key={`on-${row.name}`}
                label={row.isOn ? t.on : t.off}
                onPress={() => $.mods.set({ name: row.name, on: !row.isOn })}
              />
            </Box>
            <Text dimColor>{row.summary}</Text>
            {one !== undefined && (
              <Box flexDirection="row" alignItems="center" columnGap={1} marginTop={1}>
                {segmentView(draws, e.surface, one, `text-${row.name}`)}
                {rows === undefined && one.detail !== undefined && (
                  <Text key={`detail-${row.name}`} dimColor>{`· ${one.detail}`}</Text>
                )}
                {one.button !== undefined && (
                  <Button
                    key={`seg-${row.name}`}
                    label={one.button.label}
                    onPress={() => {
                      const button = one.button
                      // A command the host refuses changes nothing in the pane.
                      $.command.run({ command: button?.command ?? '', args: button?.args ?? '' }).catch(() => {})
                    }}
                  />
                )}
              </Box>
            )}
            {isOpen && rows !== undefined && (
              <Box flexDirection="column" marginTop={1}>
                {cardRows(draws, rows, `rows-${row.name}`)}
              </Box>
            )}
            {isOpen && (
              <Box marginTop={1}>
                <Text dimColor>{row.details}</Text>
              </Box>
            )}
            <Box marginTop={1}>
              {/* A disclosure, not an action: plain and dim, framed by nothing, below the mod's own buttons. */}
              <Button
                key={`more-${row.name}`}
                label={isOpen ? t.less : t.more}
                plain
                dimColor
                onPress={() => update($, EXPANDED, map => ({ ...map, [row.name]: map[row.name] !== true }))}
              />
            </Box>
          </Box>
        )
      })}
      {dropped !== undefined && <Text dimColor>{dropped}</Text>}
      {/* A footnote to the whole pane, not to the last mod: set apart by space alone, small and dim. */}
      <Box marginTop={1}>
        <Text size="footnote" dimColor>
          {t.footer}
        </Text>
      </Box>
    </Box>
  )
}
