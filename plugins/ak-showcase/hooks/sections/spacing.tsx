import type { Space } from 'claude-code'

import { Footer, Group, Snippet } from './kit'
import type { Kit } from './kit'

const STEPS: Space[] = [0, 'xs', 'sm', 'md', 'lg', 'xl', 4]

/** Spacing: each step as a gap between children and as padding inside a border. */
export const spacingSection = (k: Kit) => {
  const { Box, Text } = k.el
  const t = k.t.spacing
  const chip = (label: string) => (
    <Box borderStyle="round" borderColor="subtle" paddingX={1}>
      <Text>{label}</Text>
    </Box>
  )

  return (
    <Box flexDirection="column">
      {Group(k, t.gap, STEPS.map(step => (
        <Box flexDirection="column">
          {Snippet(k, `<Box flexDirection="row" gap=${JSON.stringify(step)}>`)}
          <Box flexDirection="row" gap={step}>
            {chip('A')}
            {chip('B')}
            {chip('C')}
          </Box>
        </Box>
      )))}
      {Group(k, t.padding, STEPS.map(step => (
        <Box flexDirection="column">
          {Snippet(k, `<Box borderStyle="single" padding=${JSON.stringify(step)}>`)}
          <Box flexDirection="row">
            <Box borderStyle="single" borderColor="subtle" padding={step}>
              <Text>padding</Text>
            </Box>
          </Box>
        </Box>
      )))}
      {Footer(k, t.missing, t.note)}
    </Box>
  )
}
