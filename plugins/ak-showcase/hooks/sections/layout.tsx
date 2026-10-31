import type { BoxProps } from 'claude-code'

import { Footer, Group, Snippet } from './kit'
import type { Kit } from './kit'

const DIRECTIONS: NonNullable<BoxProps['flexDirection']>[] = ['row', 'column', 'row-reverse']
const JUSTIFY: NonNullable<BoxProps['justifyContent']>[] = [
  'flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly',
]
const ALIGN: NonNullable<BoxProps['alignItems']>[] = ['flex-start', 'center', 'flex-end']
// Ink's border styles; `borderStyle` is typed as any string, these are the ones it draws.
const BORDERS = ['single', 'double', 'round', 'bold', 'singleDouble', 'doubleSingle', 'classic']
const BORDER_COLORS = ['claude', 'success', 'warning', 'error']

/** Layout: direction, both axes, border styles and colours, a card. */
export const layoutSection = (k: Kit) => {
  const { Box, Text } = k.el
  const t = k.t.layout
  const chip = (label: string) => (
    <Box borderStyle="round" borderColor="subtle" paddingX={1}>
      <Text>{label}</Text>
    </Box>
  )

  return (
    <Box flexDirection="column">
      {Group(k, t.direction, DIRECTIONS.map(direction => (
        <Box flexDirection="column">
          {Snippet(k, `flexDirection="${direction}"`)}
          <Box flexDirection={direction} gap={1}>
            {chip('1')}
            {chip('2')}
            {chip('3')}
          </Box>
        </Box>
      )))}
      {Group(k, t.justify, JUSTIFY.map(justify => (
        <Box flexDirection="column">
          {Snippet(k, `justifyContent="${justify}"`)}
          <Box flexDirection="row" justifyContent={justify} borderStyle="single" borderColor="subtle">
            {chip('1')}
            {chip('2')}
          </Box>
        </Box>
      )))}
      {Group(k, t.align, [
        <Box flexDirection="row" columnGap={2}>
          {ALIGN.map(align => (
            <Box flexDirection="column" alignItems={align} borderStyle="single" borderColor="subtle" width={14}>
              <Text>{align}</Text>
              {chip('•')}
            </Box>
          ))}
        </Box>,
        Snippet(k, '<Box flexDirection="column" alignItems="center">'),
      ])}
      {Group(k, t.borders, [
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {BORDERS.map(style => (
            <Box borderStyle={style} paddingX={1}>
              <Text>{style}</Text>
            </Box>
          ))}
        </Box>,
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {BORDER_COLORS.map(color => (
            <Box borderStyle="round" borderColor={color} paddingX={1}>
              <Text>{color}</Text>
            </Box>
          ))}
        </Box>,
        Snippet(k, '<Box borderStyle="round" borderColor="claude">'),
      ])}
      {Group(k, t.card, [
        <Box flexDirection="column" borderStyle="round" borderColor="claude" backgroundColor="subtle" padding={1}>
          <Text weight="semibold">Card</Text>
          <Text>{t.cardText}</Text>
        </Box>,
        Snippet(k, '<Box borderStyle="round" backgroundColor="subtle" padding={1}>'),
      ])}
      {Footer(k, t.missing)}
    </Box>
  )
}
