import { Footer, Group, Snippet } from './kit'
import type { Kit } from './kit'

// Fixed colours between the light and the dark theme's value: an Svg keeps its own colours.
const BARS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
  <g fill="#4889cd">
    <rect x="4" y="30" width="20" height="26" rx="2"/>
    <rect x="34" y="14" width="20" height="42" rx="2"/>
    <rect x="64" y="22" width="20" height="34" rx="2"/>
    <rect x="94" y="6" width="20" height="50" rx="2"/>
  </g>
  <rect x="124" y="38" width="20" height="18" rx="2" fill="#cd8f2d"/>
</svg>`

const LIVE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
  <style>
    .dot { fill: #4889cd; transition: fill .2s }
    .dot:hover { fill: #db4c46 }
  </style>
  <circle class="dot" cx="30" cy="30" r="18"><title>TOOLTIP</title></circle>
  <circle cx="90" cy="30" r="10" fill="#3fa66b">
    <animate attributeName="r" values="6;16;6" dur="2s" repeatCount="indefinite"/>
  </circle>
  <rect x="120" y="20" width="20" height="20" fill="#cd8f2d">
    <animateTransform attributeName="transform" type="rotate" from="0 130 30" to="360 130 30" dur="4s" repeatCount="indefinite"/>
  </rect>
</svg>`

/** Graphics: an Svg as an image and an interactive one; on the terminal, what it has instead. */
export const graphicsSection = (k: Kit) => {
  const { Box, Text } = k.el
  const t = k.t.graphics
  if (!('Svg' in k.el)) {
    return (
      <Box flexDirection="column">
        <Text>{t.terminal}</Text>
        {Footer(k, t.missing)}
      </Box>
    )
  }
  const { Svg } = k.el

  return (
    <Box flexDirection="column">
      {Group(k, t.still, [
        <Svg source={BARS} alt="Five bars, the last one orange" width={160} height={60} />,
        Snippet(k, '<Svg source="<svg …>" alt="…" width={160}>'),
      ])}
      {Group(k, t.live, [
        <Svg source={LIVE.replace('TOOLTIP', t.tip)} alt="A dot, a pulsing circle and a turning square" isInteractive width={160} height={60} />,
        Snippet(k, '<Svg isInteractive source="<svg><style>:hover</style><title>…">'),
      ])}
      {Footer(k, t.missing)}
    </Box>
  )
}
