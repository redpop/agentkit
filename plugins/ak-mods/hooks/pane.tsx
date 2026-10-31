import { atom, update } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import { layout } from './band'
import { cardRows, drawable, segmentView } from './band-render'
import { languageFor, texts } from './i18n'

// The surfaces that draw a `Select`: the mobile app draws none yet, and an element a surface does
// not know renders as nothing, so the table `resolve` answers is no guide.
const PICKER_SURFACES = new Set(['terminal', 'desktop', 'vscode'])

const EXPANDED = atom({ plugin: 'ak-mods', key: 'expanded' } as const, {})

/** The warning for the mods the band dropped, titles in display order; undefined when all fit. */
const warning = (
  hidden: readonly string[],
  titles: ReadonlyMap<string, string>,
  t: ReturnType<typeof texts>,
): string | undefined =>
  hidden.length === 0 ? undefined : t.dropped(hidden.length, hidden.map(name => titles.get(name) ?? name).join(', '))

/**
 * Draws the Mods pane: one row per declared mod in the band's order, its head the title and its
 * triangle, the standard star and the switch; an open row can move up or down. Texts wrap.
 */
export async function renderPane($: EngineInterface, e: RenderInput<'Pane'>) {
  const draws = $.ui.resolve(e)
  const { Box, Button, Text } = draws
  // The reads subscribe the pane: a switch, a declare or a publish redraws it
  // (the list reads the switches and the declared mods).
  const [list, { value: expanded = {} }, { value: stored = {} }, { value: width = e.props.bodyColumns }, isMoved] =
    await Promise.all([
      $.mods.list(),
      $.state.get({ plugin: 'ak-mods', key: 'expanded' }),
      $.state.get({ plugin: 'ak-mods', key: 'segments' }),
      $.state.get({ plugin: 'ak-mods', key: 'width' }),
      $.mods.isOrderMoved(),
    ])

  // The cut the band makes, counted again here, on the surfaces that draw the
  // band. It counts with the band's width (see `bandWidth`) as `/ak-mods` or
  // the band's `mods` button last recorded it (a docked pane is narrower than the
  // band), the pane's own only before that is known: approximate after a
  // resize, until either records it again.
  const segments = drawable(list, stored)
  const isPictured = e.surface === 'desktop' && 'Svg' in draws
  const hidden =
    segments.length > 0 && (e.surface === 'terminal' || e.surface === 'desktop') ? layout(segments, width, isPictured).hidden : []
  const t = texts(await languageFor($))
  const dropped = warning(hidden, new Map(list.map(row => [row.name, row.title])), t)
  // Each row's current segment too, in its band colour: the pane draws on every
  // surface, the band only on the terminal and the desktop app.
  const current = new Map(segments.map(one => [one.name, one]))

  return (
    <Box flexDirection="column">
      {list.length === 0 && <Text dimColor>No AgentKit mods installed.</Text>}
      {list.map((row, at) => {
        const one = current.get(row.name)
        // A surface that draws pictures lists the card's rows under the segment, each value once, while
        // the row is open (a press on its triangle); closed, the segment alone. The terminal adds the detail after it.
        const isOpen = expanded[row.name] === true
        const rows = e.surface !== 'terminal' ? one?.card : undefined

        // A row reads top to bottom: its head, what the mod does, its live segment, then what opens
        // under the head. The head opens as the desktop app's own cards do: a triangle after the
        // title, dim. On the right the standard star, then the switch: a mod's two settings side
        // by side. The switch is the one framed button and never shrinks: in a narrow pane the title
        // wraps instead. The desktop app draws a Button's label and never its children, so the
        // triangle and the star are glyph labels, and the title is bold text beside the triangle.
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
          <Box key={`mod-${row.name}`} flexDirection="column" {...surface}>
            <Box flexDirection="row" alignItems="center" columnGap={2}>
              <Box flexDirection="row" alignItems="center" columnGap={1} flexGrow={1} flexShrink={1}>
                <Box flexShrink={1}>
                  <Text bold>{row.title}</Text>
                </Box>
                <Button
                  key={`more-${row.name}`}
                  // The full-size triangles: the small ones read too slight beside a bold title. The
                  // text presentation selector keeps ▶ from drawing as an emoji.
                  label={isOpen ? '▼' : '▶\uFE0E'}
                  plain
                  dimColor
                  // One row open at a time: opening this one closes any other, so the pane stays short.
                  onPress={() => update($, EXPANDED, map => (map[row.name] === true ? {} : { [row.name]: true }))}
                />
              </Box>
              <Box flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
                {/* Set once and rarely changed: plain, and dim until it is set. */}
                <Button
                  key={`std-${row.name}`}
                  label={row.isStandard ? '★' : '☆'}
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
            </Box>
            {/* One step under the title, one above the open card's note. */}
            <Text size="footnote" dimColor>
              {row.summary}
            </Text>
            {one !== undefined && (
              // The segment takes the room and wraps as a line; the button keeps its size at the end.
              <Box flexDirection="row" alignItems="center" justifyContent="space-between" columnGap={1} marginTop={1}>
                <Box flexGrow={1} flexShrink={1}>
                  {segmentView(draws, e.surface, one, `text-${row.name}`, undefined, undefined, false, true)}
                </Box>
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
            {/* The detail on a line of its own: beside the segment it would squeeze both into columns. */}
            {one !== undefined && rows === undefined && one.detail !== undefined && (
              <Text key={`detail-${row.name}`} size="footnote" dimColor>
                {one.detail}
              </Text>
            )}
            {isOpen && rows !== undefined && (
              <Box flexDirection="column" marginTop={1}>
                {cardRows(draws, rows, `rows-${row.name}`)}
              </Box>
            )}
            {isOpen && (
              <Box marginTop={1}>
                {/* A note under the card, not its body: small, so an open card stays short. */}
                <Text size="caption" dimColor>
                  {row.details}
                </Text>
              </Box>
            )}
            {/* Set seldom: only an open card shows the settings, after the note that explains the mod
                and beside the other controls. A pick runs the mod's own command, which stores it and
                publishes again; no handler crosses from one plugin to another. A surface without a
                picker shows the value. */}
            {isOpen && one?.settings !== undefined && (
              <Box flexDirection="column" marginTop={1}>
                {one.settings.rows.map(setting => {
                  const command = one.settings?.command ?? ''
                  const picked = setting.options.find(option => option.value === setting.value)
                  // The labels in one column, as wide as the longest, so the pickers line up as the
                  // card's values do. A desktop Box counts its width in text cells.
                  const column = Math.max(...(one.settings?.rows ?? []).map(other => other.label.length))

                  return (
                    <Box key={`set-${row.name}-${setting.key}`} flexDirection="row" alignItems="center" columnGap={1}>
                      <Box width={column} flexShrink={0}>
                        <Text dimColor>{setting.label}</Text>
                      </Box>
                      {PICKER_SURFACES.has(e.surface) && 'Select' in draws ? (
                        <draws.Select
                          key={`pick-${row.name}-${setting.key}`}
                          options={setting.options}
                          value={setting.value}
                          onSelect={value => {
                            // A command the host refuses changes nothing in the pane.
                            $.command.run({ command, args: `${setting.key} ${value}` }).catch(() => {})
                          }}
                        />
                      ) : (
                        <Text key={`value-${row.name}-${setting.key}`}>{picked?.label ?? setting.value}</Text>
                      )}
                    </Box>
                  )
                })}
              </Box>
            )}
            {/* Moved seldom: only an open card shows the way, and only the ways it can go. Arrows,
                not triangles: the open card's own ▼ closes it. */}
            {isOpen && list.length > 1 && (
              <Box flexDirection="row" columnGap={1} marginTop={1}>
                {at > 0 && (
                  <Button key={`up-${row.name}`} label={t.up} onPress={() => $.mods.move({ name: row.name, by: -1 })} />
                )}
                {at < list.length - 1 && (
                  <Button key={`down-${row.name}`} label={t.down} onPress={() => $.mods.move({ name: row.name, by: 1 })} />
                )}
              </Box>
            )}
          </Box>
        )
      })}
      {dropped !== undefined && <Text dimColor>{dropped}</Text>}
      {isMoved && (
        <Box marginTop={1}>
          <Button key="reset-order" label={t.reset} plain dimColor onPress={() => $.mods.resetOrder()} />
        </Box>
      )}
      {/* A footnote to the whole pane, not to the last mod: set apart by space alone, small and dim. */}
      <Box marginTop={1}>
        <Text size="caption" dimColor>
          {t.footer}
        </Text>
      </Box>
    </Box>
  )
}
