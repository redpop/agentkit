import type { ThemeKey } from 'claude-code'

import { Footer, Group, Snippet } from './kit'
import type { Kit } from './kit'

const THEME: ThemeKey[] = [
  'text', 'inverseText', 'inactive', 'subtle', 'suggestion', 'remember', 'success', 'error', 'warning',
  'merged', 'claude', 'permission', 'planMode', 'autoAccept', 'promptBorder', 'bashBorder', 'ide',
  'diffAdded', 'diffRemoved', 'diffAddedDimmed', 'diffRemovedDimmed', 'diffAddedWord', 'diffRemovedWord',
]
const BACKGROUNDS: ThemeKey[] = ['success', 'error', 'warning', 'claude', 'diffAdded', 'diffRemoved']
// Between the light and the dark theme's value, so each reads on either appearance.
const RAW = ['#4889cd', '#cd8f2d', '#db4c46', '#3fa66b', 'magenta']

/** Colours: every theme key, as text and as background, and fixed colours beside them. */
export const colorsSection = (k: Kit) => {
  const { Box, Text } = k.el
  const t = k.t.colors

  return (
    <Box flexDirection="column">
      {Group(k, t.theme, THEME.map(key => (
        <Box flexDirection="row" columnGap="md">
          {/* A fixed column, so a long key does not push its snippet onto a second row. */}
          <Box width={20} flexShrink={0}>
            {key === 'inverseText' ? (
              <Text color={key} backgroundColor="text" wrap="truncate-end">
                ■ {key}
              </Text>
            ) : (
              <Text color={key} wrap="truncate-end">
                ■ {key}
              </Text>
            )}
          </Box>
          {Snippet(k, `color="${key}"`)}
        </Box>
      )))}
      {Group(k, t.background, [
        <Box flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs">
          {BACKGROUNDS.map(key => (
            <Box backgroundColor={key} paddingX={1}>
              <Text color="inverseText">{key}</Text>
            </Box>
          ))}
        </Box>,
        Snippet(k, '<Box backgroundColor="success"><Text color="inverseText">'),
      ])}
      {Group(k, t.raw, RAW.map(color => (
        <Box flexDirection="row" columnGap="md">
          <Text color={color}>■ {color}</Text>
          {Snippet(k, `color="${color}"`)}
        </Box>
      )))}
      {Footer(k, t.missing, k.surface === 'desktop' ? t.desktopNote : undefined)}
    </Box>
  )
}
