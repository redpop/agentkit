import { Footer, Group, Snippet, TONES, hasForms } from './kit'
import type { Kit } from './kit'

/** The band segment: what it carries, and its tone to change. */
export const bandSection = (k: Kit, isSwitched: boolean) => {
  const { Box, Text, Button } = k.el
  const t = k.t.band
  const picker =
    hasForms(k.surface) && 'Select' in k.el ? (
      <k.el.Select
        key="segment-tone"
        label={t.tone}
        options={TONES.map(value => ({ value }))}
        value={k.tone}
        onSelect={value => k.setTone(TONES.find(one => one === value) ?? 'ok')}
      />
    ) : (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {TONES.map(tone => (
          <Button
            key={`segment-tone-${tone}`}
            label={tone}
            {...(tone === k.tone ? { variant: 'primary' as const } : {})}
            onPress={() => k.setTone(tone)}
          />
        ))}
      </Box>
    )

  return (
    <Box flexDirection="column">
      {!isSwitched && <Text color="warning">{t.unswitched}</Text>}
      <Text wrap="wrap">{t.intro}</Text>
      <Box flexDirection="column" marginY="xs">
        {t.parts.map(part => (
          <Text wrap="wrap">• {part}</Text>
        ))}
      </Box>
      {Group(k, t.tone, [picker, Snippet(k, `$.mods.segment({ text, tone: '${k.tone}', … })`)])}
      {Footer(k, t.missing)}
    </Box>
  )
}
