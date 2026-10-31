import type { TextProps } from 'claude-code'

import { Footer, Group, Snippet } from './kit'
import type { Kit } from './kit'

const SIZES: NonNullable<TextProps['size']>[] = ['title', 'heading', 'body', 'footnote', 'caption']
const WEIGHTS: NonNullable<TextProps['weight']>[] = ['regular', 'medium', 'semibold', 'bold']
const STYLES = ['bold', 'italic', 'underline', 'strikethrough', 'inverse', 'dimColor', 'mono', 'tabular'] as const
const WRAPS: NonNullable<TextProps['wrap']>[] = ['wrap', 'truncate-end', 'truncate-middle', 'truncate-start']

/** Typography: sizes, weights, styles and what a long line does. */
export const textSection = (k: Kit) => {
  const { Box, Text } = k.el
  const t = k.t.text

  return (
    <Box flexDirection="column">
      {Group(k, t.sizes, SIZES.map(size => (
        <Box flexDirection="column">
          <Text size={size}>{t.sample}</Text>
          {Snippet(k, `<Text size="${size}">`)}
        </Box>
      )))}
      {Group(k, t.weights, WEIGHTS.map(weight => (
        <Box flexDirection="row" columnGap="md">
          <Text weight={weight}>{weight}</Text>
          {Snippet(k, `weight="${weight}"`)}
        </Box>
      )))}
      {Group(k, t.styles, STYLES.map(style => (
        <Box flexDirection="row" columnGap="md">
          <Text {...{ [style]: true }}>{style === 'tabular' ? '0123456789 1111' : style}</Text>
          {Snippet(k, `<Text ${style}>`)}
        </Box>
      )))}
      {Group(k, t.wrap, WRAPS.map(wrap => (
        <Box flexDirection="column">
          {Snippet(k, `wrap="${wrap}"`)}
          <Text wrap={wrap}>{t.long}</Text>
        </Box>
      )))}
      {Footer(k, t.missing)}
    </Box>
  )
}
