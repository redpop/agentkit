---
title: How the desktop app draws a hooks module's UI, and what the tests do not show
date: 2026-10-29
category: best-practices
module: ak-mods
problem_type: best_practice
component: plugin
severity: medium
applies_when:
  - A hooks module draws a band (AbovePrompt) or a Pane that must look right on the desktop app
  - Text in a drawing needs a colour, a dim look, or must be pressable
  - A layout decides from a cell count whether its content fits one row
tags: [desktop, hooks-module, button, theme-colour, layout, cells, ak-mods]
---

# How the desktop app draws a hooks module's UI, and what the tests do not show

## Context

The shared band and the Mods pane of `ak-mods` draw on the terminal and on the desktop app from one
tree. `claude plugin test` mounts that tree and reports props and text, and it passed at every
step. On the desktop app the same tree drew differently, and each difference surfaced only from a
screenshot: a card head showed its label texts in place of its glyphs, warnings drew in the text
colour, a dim label drew at full strength, and a row the layout counted as fitting wrapped a
segment onto a second line. These rules held on the desktop app. None of them is visible in a
test render, so a test cannot catch a breach of them.

## Guidance

**A Button draws one text: its `label`, or without one, its children's text.** The `ButtonProps`
docs allow strings and `Text` as children; the desktop app draws the label whenever one is set and
ignores the children then. Put what should show in `label`. A glyph control is a Button whose label
is the glyph (`▶︎`, `★`); the label is then also its accessible name, so a glyph-only control
names itself by its glyph. Bold or coloured text beside it is a separate `Text`, not a child.

**A Button draws that text in one look.** Without a label its children's text draws, but their
`color`, `bold` and `dimColor` are lost. Give the Button
`dimColor` when its text is dim. Text that must keep a colour stays a `Text` beside the Button,
outside the press. Cut pressable text where its look changes, and leave runs of plain space as text:
a Button around a blank run is an empty hover target.

**Theme keys on `Text` follow the desktop app's own palette, not the terminal's.** In the shared
band they were seen drawing in the plain text colour (`warning`, `error`, `suggestion`). In a
`Pane` (the `ak-showcase` mod, 2026-10-31) most of them do paint: `success`, `error`, `warning`,
`claude`, `merged`, `autoAccept`, `bashBorder` and the diff keys in their colour, while `inactive`,
`subtle`, `suggestion`, `remember`, `permission` and `ide` all come out grey and the dimmed diff
keys barely show. So a theme key is no guarantee of a colour on the desktop app. Where the colour
carries meaning, pass a fixed hex on the desktop surface and the theme key on the terminal. A tone
between the light and dark theme's value reads on either appearance:

```tsx
const DESKTOP_TONES = { warn: '#cd8f2d', alert: '#db4c46', info: '#4889cd' }
const color = surface === 'desktop' ? DESKTOP_TONES.warn : 'warning'
```

An `Svg` keeps its own colours, and its `@media (prefers-color-scheme: dark)` follows the app's
appearance. A picture cannot sit inside a Button: only its neighbouring text can be pressed.

**A cell is a character of the code font; the text is a proportional face.** `bodyColumns` counts
monospace advances, while the band's text is narrower on average. Counting a character as a full
cell makes a layout give up a row it could hold. Counting too few overflows, and a shrinkable flex
child then wraps its text. `ak-mods` settled on:

- a character as 0.95 of a cell on the desktop app (`PROPORTIONAL_TEXT`), a ring or an icon as 3
  cells, a button's label and chrome at full width;
- each segment `flexShrink={0}`, so a row counted a little short runs over its end rather than
  wrapping a segment;
- 2 cells kept free after the `mods` button on the desktop app (`PICTURED_RESERVE`), so that
  overrun does not reach the edge.

## Why This Matters

Each rule cost a release that passed all tests and still looked wrong. A drawing that relies on
children of a Button, on theme keys for text, or on a cell per character looks correct in the test
render and in the terminal, so the defect reaches users first.

## When to Apply

- Writing or changing any `ui.render` drawing that the desktop app shows: `AbovePrompt`, a `Pane`.
- Making text pressable: decide per run whether the press or the look matters more. Where the press
  only opens what another control also opens, keep the look and leave the run as text.
- Deciding fit from `bodyColumns` on the desktop surface: count text at 0.95 of a cell, pictures at
  3, keep flex children from shrinking, and keep 2 cells free at the row's end.
- Before a release that changes such a drawing: look at it on the desktop app, at the narrowest
  width that still keeps a row, because the tests show none of these defects.
- Reviewing a test that asserts `color` or `dimColor` on a child of a Button: on the desktop app it
  proves nothing about what draws.

## Examples

A card head that drew `Details anzeigen` and `★ Standard` in place of its controls:

```tsx
// Before: the desktop app draws the label, not the children
<Button label="Show details"><Text dimColor>▸</Text> <Text bold>{title}</Text></Button>

// After: the glyph is the label; the title is text beside it, in the head's row
<Box flexDirection="row" alignItems="center" columnGap={1}>
  <Text bold>{title}</Text>
  <Button label={isOpen ? '▼' : '▶︎'} plain dimColor onPress={toggle} />
</Box>
```

A figure in the band whose dim label lost its dimness inside one Button:

```tsx
// Before: one Button for the value and its dim label; ' ctx' drew at full strength
<Button plain onPress={open}>
  <Text> 42%</Text>
  <Text dimColor> ctx</Text>
</Button>

// After: the value alone is the Button, no label, so its one child's text draws;
// the label is dim Text beside it
<Box flexDirection="row">
  <Button plain onPress={open}>
    <Text> 42%</Text>
  </Button>
  <Text dimColor> ctx</Text>
</Box>
```

## Related

- `plugins/ak-mods/hooks/band.ts` — the width count (`PROPORTIONAL_TEXT`, `PICTURED_RESERVE`)
- `plugins/ak-mods/hooks/band-render.tsx` — `toneProps`, `segmentView`
- `docs/mods/ak-mods/switcher.md` — the band's layout steps
- Derived from the `ak-mods` fixes in releases 1.57.2 to 1.58.11
