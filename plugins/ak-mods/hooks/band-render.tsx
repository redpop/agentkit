import type { BoxProps, ButtonProps, ElementConstructor, EngineInterface, Next, RenderInput, SvgProps, TextProps } from 'claude-code'

import type { ModsCardRow, ModsIcon, ModsInfo, ModsPart, ModsRow, ModsSegment, ModsSetting, ModsTone } from '../types'
import { bandWidth, layout, TOGGLE_HOTKEY, toggleLabel } from './band'
import type { Segment } from './band'
import { languageFor, texts } from './i18n'
import { toggleMod, togglePane } from './toggle'

const TONES: readonly string[] = ['ok', 'warn', 'alert', 'info', 'dim'] satisfies ModsTone[]

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

// The line icons, on a 24-unit grid in one stroke: drawn, not glyphs, so they look alike everywhere.
// Lucide's `hash`, `copy`, `check`, `clock` and `flame` (ISC, see LICENSE-lucide), drawn thinner.
const ICONS: Record<ModsIcon, string> = {
  id: '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  flame: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
}

const iconOf = (icon: unknown): ModsIcon | undefined =>
  typeof icon === 'string' && Object.hasOwn(ICONS, icon) ? (icon as ModsIcon) : undefined

const ringOf = (ring: unknown): number | undefined =>
  typeof ring === 'number' && Number.isFinite(ring) ? Math.min(100, Math.max(0, ring)) : undefined

/** The rich runs of a segment, or undefined when they are no list of texts or say nothing. */
const richOf = (rich: unknown): ModsPart[] | undefined => {
  if (!Array.isArray(rich)) return undefined
  const runs = (rich as Partial<Record<keyof ModsPart, unknown>>[]).map(part =>
    typeof part?.text === 'string'
      ? { text: spaced(part.text), tone: toneOf(part.tone), ring: ringOf(part.ring), icon: iconOf(part.icon) }
      : undefined,
  )
  if (runs.some(run => run === undefined)) return undefined
  const kept = (runs as ModsPart[]).filter(run => run.text !== '' || run.ring !== undefined || run.icon !== undefined)

  return kept.length > 0 ? kept : undefined
}

/** A segment's compact form, or undefined when it has no text; its parts and rich runs checked as the segment's. */
const compactOf = (compact: unknown): ModsSegment['compact'] => {
  const one = (compact ?? {}) as Partial<Record<'text' | 'parts' | 'rich', unknown>>
  if (typeof one.text !== 'string' || one.text === '') return undefined
  const text = spaced(one.text)

  return { text, parts: partsOf(one.parts, text), rich: richOf(one.rich) }
}

/** The rows of a segment's card, or undefined when they are no list of label and value texts or none. */
const cardOf = (card: unknown): ModsCardRow[] | undefined => {
  if (!Array.isArray(card) || card.length === 0) return undefined
  const rows = (card as Partial<Record<keyof ModsCardRow, unknown>>[]).map(row =>
    typeof row?.label === 'string' && typeof row.value === 'string' ? { label: spaced(row.label), value: spaced(row.value) } : undefined,
  )

  return rows.some(row => row === undefined) ? undefined : (rows as ModsCardRow[])
}

// A setting's key goes to the mod's command as the first word of its args.
const SETTING_KEY = /^[\w-]+$/

/** One stored setting, or undefined: a key that is one word, texts, options of unique values, one of them the value. */
const settingOf = (setting: unknown): ModsSetting | undefined => {
  const one = (setting ?? {}) as Partial<Record<keyof ModsSetting, unknown>>
  if (typeof one.key !== 'string' || !SETTING_KEY.test(one.key)) return undefined
  if (typeof one.label !== 'string' || typeof one.value !== 'string' || !Array.isArray(one.options)) return undefined
  const options = (one.options as Partial<Record<'value' | 'label', unknown>>[]).map(option =>
    typeof option?.value === 'string' && SETTING_KEY.test(option.value)
      ? { value: option.value, label: typeof option.label === 'string' ? spaced(option.label) : undefined }
      : undefined,
  )
  const values = options.map(option => option?.value)
  if (options.length === 0 || options.some(option => option === undefined) || new Set(values).size !== values.length) {
    return undefined
  }
  if (!values.includes(one.value)) return undefined

  return { key: one.key, label: spaced(one.label), value: one.value, options: options as ModsSetting['options'] }
}

/** The actions of a segment's card menu, or undefined when they are no list of label and command texts or none. */
const actionsOf = (actions: unknown): ModsSegment['actions'] => {
  if (!Array.isArray(actions) || actions.length === 0) return undefined
  const list = (actions as Partial<Record<'label' | 'command' | 'args', unknown>>[]).map(action =>
    typeof action?.label === 'string' && typeof action.command === 'string'
      ? { label: spaced(action.label), command: spaced(action.command), args: typeof action.args === 'string' ? action.args : undefined }
      : undefined,
  )

  return list.some(action => action === undefined) ? undefined : (list as NonNullable<ModsSegment['actions']>)
}

/** The stored settings, or undefined: a command, and every row a setting `settingOf` keeps. */
const settingsOf = (settings: unknown): ModsSegment['settings'] => {
  const one = (settings ?? {}) as Partial<Record<'command' | 'rows', unknown>>
  if (typeof one.command !== 'string' || one.command === '' || !Array.isArray(one.rows) || one.rows.length === 0) {
    return undefined
  }
  const rows = one.rows.map(settingOf)

  return rows.some(row => row === undefined) ? undefined : { command: spaced(one.command), rows: rows as ModsSetting[] }
}

/**
 * A stored segment as the band can draw it, or undefined. Segments are stored
 * unchecked: an unknown tone draws uncoloured, a priority that is no number
 * takes the default, a control character in a text, a part, a label or a
 * command draws as a space, a hotkey that is not one printable character is
 * left out, a button without a label or command is left out, a detail that
 * is no text is left out, parts that do not join to the text are left out,
 * rich runs that are no list of texts are left out, a ring is held to 0 to
 * 100, an icon ak-mods does not draw is left out, card rows that are no list of label and value texts are left out, a
 * compact form without text is left out, its parts and rich runs checked as the segment's, settings that are
 * not all well formed (see `settingsOf`) are left out, actions that are no list of label and command texts are left out, and a segment without text
 * is not drawn.
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
    compact: compactOf(one.compact),
    detail: typeof one.detail === 'string' && one.detail !== '' ? spaced(one.detail) : undefined,
    card: cardOf(one.card),
    settings: settingsOf(one.settings),
    actions: actionsOf(one.actions),
    tone: toneOf(one.tone),
    priority: typeof one.priority === 'number' && Number.isFinite(one.priority) ? one.priority : undefined,
    button:
      typeof button.label === 'string' && typeof button.command === 'string'
        ? {
            label: spaced(button.label),
            command: spaced(button.command),
            hotkey: hotkeyOf(button.hotkey),
            args: typeof button.args === 'string' ? button.args : undefined,
            isPaneOnly: button.isPaneOnly === true ? true : undefined,
            isOnText: button.isOnText === true ? true : undefined,
          }
        : undefined,
  }
}

// The desktop app paints no theme key on text: there a tone takes a fixed colour, between the
// ring's light and dark ones, so it reads on either appearance.
const DESKTOP_TONES = { warn: '#cd8f2d', alert: '#db4c46', info: '#4889cd' }

/**
 * How a tone draws, the same in the band and the Mods pane. Colour marks what
 * needs attention: `ok` draws in the text colour, so a band at rest stays
 * quiet and a warning or an error stands out. On the terminal the colours are
 * theme keys: they follow the person's theme, light or dark.
 */
export const toneProps = (tone: ModsTone | undefined, surface?: string): { color?: string; bold?: true; dimColor?: true } => {
  const isDesktop = surface === 'desktop'

  return tone === 'warn'
    ? { color: isDesktop ? DESKTOP_TONES.warn : 'warning' }
    : tone === 'alert'
      ? { color: isDesktop ? DESKTOP_TONES.alert : 'error', bold: true }
      : tone === 'info'
        ? { color: isDesktop ? DESKTOP_TONES.info : 'suggestion' }
        : tone === 'dim'
          ? { dimColor: true }
          : {}
}

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
    // 4 px of air right of the ring, so the text beside it does not touch it.
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="16" viewBox="0 0 20 16">' +
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

/** A line icon in a tone's colour, which follows the app's light or dark appearance as a ring's does. */
export const iconSvg = (icon: ModsIcon, tone: ModsTone | undefined): string => {
  const { light, dark } = RING_TONES[tone ?? 'ok']

  return (
    // 6 units of air right of the icon, as beside a ring.
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="16" viewBox="0 0 30 24" fill="none" ' +
    'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
    `<style>g{stroke:${light}}@media (prefers-color-scheme: dark){g{stroke:${dark}}}</style>` +
    `<g>${ICONS[icon]}</g></svg>`
  )
}

type Draws = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Svg?: ElementConstructor<SvgProps>
  Button?: ElementConstructor<ButtonProps>
}

/**
 * A segment as a surface that draws pictures shows it: its rich runs, a ring
 * as a picture in the line, the rest as text in its tone. The terminal draws
 * no pictures; there, and for a segment without rich runs, its text. Given
 * `press`, the text is a plain button that runs it, each stretch of text
 * between pictures one: a Button holds text alone, so the pictures stay
 * beside it. The desktop app draws a Button's text uncoloured: with
 * `keepsColor`, for a press that only opens the Mods pane, a run in a colour
 * stays text in its own stretch, and the press is on the rest: the plain runs,
 * or where there are none, the dim ones. With `flows`,
 * where nothing is pressed, each stretch of text is one Text that wraps as a
 * line does: runs side by side as flex children would each wrap in a column
 * of their own once the row runs short.
 */
export const segmentView = (
  { Box, Text, Svg, Button }: Draws,
  surface: string,
  one: Segment,
  key: string,
  press?: () => void,
  hotkey?: string,
  keepsColor = false,
  flows = false,
) => {
  // A run's look as a Button can carry it: coloured, dim or plain. A Button draws its text in one
  // look, so a pressable line is cut where the look changes.
  const lookOf = (part: ModsPart | undefined) => {
    const props = toneProps(part?.tone ?? one.tone, surface)

    return props.color !== undefined ? 'color' : props.dimColor === true ? 'dim' : 'plain'
  }
  // Where the press only opens the pane and no run is plain, a dim run is the press: drawn dim on the
  // Button itself it keeps its look, and a segment in a colour still opens its card.
  const isDimPressed =
    keepsColor &&
    !(one.rich ?? []).some(part => !isGlyph(part) && part.text.trim() !== '' && lookOf(part) === 'plain')
  // The hotkey arms the first stretch alone: one key, one press.
  let isArmed = false
  const pressable = (at: number, children: ReturnType<ElementConstructor<TextProps>>[], parts: ModsPart[] = []) => {
    const look = lookOf(parts[0])
    if (press === undefined || Button === undefined) return children
    // Space alone presses nothing. Where the press only opens the pane, the value is the button and
    // what frames it stays text: a dim label in its dimness, a coloured run in its colour. With no
    // plain value, the dim label is the press.
    if (parts.length > 0 && parts.every(part => part.text.trim() === '')) return children
    if (keepsColor && look === 'color') return children
    if (keepsColor && look === 'dim' && !isDimPressed) return children
    const armed = isArmed ? undefined : hotkey
    isArmed = true
    // Drawn uncoloured, a stretch of dim runs keeps its dimness on the Button itself.
    const isDim = parts.length > 0 && look === 'dim'

    return (
      <Button
        key={`${key}-press-${at}`}
        plain
        onPress={press}
        {...(isDim ? { dimColor: true } : {})}
        {...(armed === undefined ? {} : { hotkey: armed })}
      >
        {children}
      </Button>
    )
  }
  if (surface === 'terminal' || Svg === undefined || one.rich === undefined) {
    return pressable(0, [segmentText(Text, one, key, surface)])
  }

  // The runs in stretches: each picture alone, the text between them together, cut where the look
  // changes when the text is pressed.
  const stretches: { at: number; parts: ModsPart[] }[] = []
  one.rich.forEach((part, at) => {
    const last = stretches[stretches.length - 1]
    const isPicture = part.ring !== undefined || part.icon !== undefined
    const isSameLook = press === undefined || lookOf(part) === lookOf(last?.parts[0])
    if (!isPicture && last !== undefined && !isGlyph(last.parts[0]) && isSameLook) last.parts.push(part)
    else stretches.push({ at, parts: [part] })
  })

  return (
    <Box key={key} flexDirection="row" alignItems="center">
      {stretches.map(({ at, parts: [first, ...rest] }) =>
        first?.ring !== undefined ? (
          <Svg key={`${key}-${at}`} source={ringSvg(first.ring, first.tone ?? one.tone)} alt={first.text} width={20} height={16} />
        ) : first?.icon !== undefined ? (
          <Svg key={`${key}-${at}`} source={iconSvg(first.icon, first.tone ?? one.tone)} alt={first.text} width={20} height={16} />
        ) : flows && press === undefined ? (
          <Text key={`${key}-${at}`} tabular>
            {[first, ...rest].map((part, offset) => (
              <Text key={`${key}-${at + offset}`} {...toneProps(part?.tone ?? one.tone, surface)}>
                {part?.text}
              </Text>
            ))}
          </Text>
        ) : (
          pressable(
            at,
            [first, ...rest].map((part, offset) => (
              <Text key={`${key}-${at + offset}`} tabular {...toneProps(part?.tone ?? one.tone, surface)}>
                {part?.text}
              </Text>
            )),
            first === undefined ? [] : [first, ...rest],
          )
        ),
      )}
    </Box>
  )
}

const isGlyph = (part: ModsPart | undefined): boolean => part?.ring !== undefined || part?.icon !== undefined

// A value this long wraps in a docked pane, as an id does: then a line of air parts the rows, so
// where one value ends and the next begins shows.
const LONG_VALUE = 24

/**
 * Card rows as a table in small type, as notes under the segment: the dim labels in one column, as
 * wide as the longest, the values beside them. Rows of long values stand a line apart.
 */
export const cardRows = ({ Box, Text }: Draws, rows: readonly ModsCardRow[], key: string) => {
  // A desktop Box counts its width in text cells.
  const column = Math.max(0, ...rows.map(row => row.label.length))
  const isLoose = rows.some(row => row.value.length > LONG_VALUE)

  return rows.map((row, at) => (
    <Box key={`${key}-${at}`} flexDirection="row" columnGap={2} {...(isLoose && at > 0 ? { marginTop: 1 } : {})}>
      {column > 0 && (
        <Box width={column} flexShrink={0}>
          <Text size="footnote" dimColor>
            {row.label}
          </Text>
        </Box>
      )}
      <Text size="footnote" tabular>
        {row.value}
      </Text>
    </Box>
  ))
}

/** The rows a segment's card lists: its card rows, else its detail, a line a part; undefined for none. */
export const cardRowsOf = (one: Segment): readonly ModsCardRow[] | undefined =>
  one.card ?? one.detail?.split(' · ').map(line => ({ label: '', value: line }))

/**
 * A segment's text as the band and the Mods pane draw it: in one run in its
 * tone, or in its parts, each in its own tone or else the segment's. Its
 * digits are of one width, so a figure that counts down does not shift.
 */
export const segmentText = (Text: ElementConstructor<TextProps>, one: Segment, key: string, surface?: string) =>
  one.parts === undefined ? (
    <Text key={key} tabular {...toneProps(one.tone, surface)}>
      {one.text}
    </Text>
  ) : (
    <Text key={key} tabular>
      {one.parts.map((part, at) => (
        <Text key={`${key}-${at}`} {...toneProps(part.tone ?? one.tone, surface)}>
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
 * app: the segments of the switched-on mods in up to two rows, compact when short of room, a `mods`
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

  // A pane-only button is the Mods pane's: the band neither draws it nor counts its room.
  const segments = drawable(list, stored).map(one => (one.button?.isPaneOnly === true ? { ...one, button: undefined } : one))
  if (segments.length === 0) return next(e)

  // The desktop app draws a segment's rich runs, pictures among them, and a button on its text as
  // the text: the band counts them so, not by the terminal's `text`.
  const draws = $.ui.resolve(e)
  const isPictured = e.surface === 'desktop' && 'Svg' in draws
  const { rows, hidden } = layout(segments, e.props.bodyColumns, isPictured)

  // Two shown mods on one hotkey: the first shown keeps it, the later goes
  // without. A mod behind the `mods` button takes none, a compact one takes
  // none, and none takes the button's own.
  const hotkeys = new Map<string, string>()
  for (const one of rows.flat().filter(one => one.isCompact !== true)) {
    const hotkey = one.button?.hotkey
    if (hotkey !== undefined && hotkey !== TOGGLE_HOTKEY && ![...hotkeys.values()].includes(hotkey)) hotkeys.set(one.name, hotkey)
  }

  const below = await next(e)
  const t = texts(await languageFor($))
  const { Box, Button, Text } = draws
  // A cell of space between two segments, three with its two gaps: no rule
  // draws there, the space alone parts them, wider than any gap inside a
  // segment, so what belongs together reads as one.
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
            // A segment keeps its width: where the band's count of a row is short by a little, the
            // row runs over its end rather than wrap a segment's text onto a second line.
            <Box key={`segment-${one.name}`} flexDirection="row" columnGap={1} flexShrink={0}>
              {/* On the desktop app a segment with a card is a way to it: its text, a plain button
                  marked under the pointer as buttons are, opens the Mods pane at its mod, where the
                  card's rows show, and pressed again closes it. Nothing covers the chat or moves it:
                  the band cuts off what it draws outside itself, and a card drawn inside it would
                  push the chat up. A segment whose button is on its text runs that instead. */}
              {/* A compact segment's button is its text on the desktop app, with no hotkey: the band
                  is short of room, and a key that shows nowhere would run unseen. The terminal,
                  which cannot press text, leaves it out. */}
              {e.surface === 'desktop' && (one.button?.isOnText === true || (one.isCompact === true && one.button !== undefined))
                ? // The text is the segment's own button: a press runs its command, its hotkey with it.
                  segmentView(draws, e.surface, one, `text-${one.name}`, () => {
                    $.command.run({ command: one.button?.command ?? '', args: one.button?.args ?? '' }).catch(() => {})
                  }, hotkeys.get(one.name))
                : e.surface === 'desktop' && cardRowsOf(one) !== undefined
                  ? // Only the pane opens here, as `m` opens it too: a coloured run keeps its colour.
                    segmentView(
                      draws,
                      e.surface,
                      one,
                      `text-${one.name}`,
                      () => {
                        toggleMod($, bandWidth({ bodyColumns: e.props.bodyColumns }), one.name).catch(() => {})
                      },
                      undefined,
                      true,
                    )
                  : segmentView(draws, e.surface, one, `text-${one.name}`)}
              {one.button !== undefined && one.isCompact !== true && !(e.surface === 'desktop' && one.button.isOnText === true) && (
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
              label={toggleLabel(hidden.length, t.toggle)}
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

  // No `overflow` here: the engine refuses it on a Box above its own drawing.
  return <Box flexDirection="column">{below ? [band, below] : [band]}</Box>
}
