import { Footer, Group, Snippet } from './kit'
import type { Kit } from './kit'

/** Hover: what a Box and a Text can change under the pointer, alone and as a row. */
export const hoverSection = (k: Kit) => {
  const { Box, Text } = k.el
  const t = k.t.hover

  return (
    <Box flexDirection="column">
      {Group(k, t.box, [
        <Box flexDirection="row">
          <Box
            key="hover-box"
            borderStyle="round"
            borderColor="subtle"
            paddingX={1}
            hover={{ borderColor: 'claude', backgroundColor: 'subtle' }}
          >
            <Text>{t.hoverMe}</Text>
          </Box>
        </Box>,
        Snippet(k, `<Box key="…" hover={{ borderColor: 'claude', backgroundColor: 'subtle' }}>`),
      ])}
      {Group(k, t.text, [
        <Box key="hover-text" flexDirection="row">
          <Text hover={{ color: 'claude', bold: true, underline: true }}>{t.hoverMe}</Text>
        </Box>,
        Snippet(k, `<Text hover={{ color: 'claude', bold: true, underline: true }}>`),
      ])}
      {Group(k, t.row, [
        <Box key="hover-row" flexDirection="row" columnGap={2} hover={{ backgroundColor: 'subtle' }}>
          <Text hover={{ bold: true }}>{t.hoverMe}</Text>
          <Text dimColor hover={{ dimColor: false, color: 'suggestion' }}>
            2m
          </Text>
        </Box>,
        Snippet(k, `<Box key="row" hover={…}><Text hover={{ bold: true }}>`),
      ])}
      {Footer(k, t.missing, t.note)}
    </Box>
  )
}
