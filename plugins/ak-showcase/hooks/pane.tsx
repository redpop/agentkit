import { atom, read, update } from 'claude-code'
import type { EngineInterface, RenderInput } from 'claude-code'

import type { ShowcaseTone } from '../types'
import { languageFor, texts } from './i18n'
import { bandSection } from './sections/band'
import { buttonsSection } from './sections/buttons'
import { colorsSection } from './sections/colors'
import { contentSection } from './sections/content'
import { feedbackSection } from './sections/feedback'
import { formsSection } from './sections/forms'
import { graphicsSection } from './sections/graphics'
import { hoverSection } from './sections/hover'
import { hasForms } from './sections/kit'
import type { Kit } from './sections/kit'
import { layoutSection } from './sections/layout'
import { spacingSection } from './sections/spacing'
import { textSection } from './sections/text'

/** The pane's id, also the mod's name. */
export const PANE = 'ak-showcase'

/** The sections in the order the pane offers them. */
export const SECTIONS = [
  'text', 'colors', 'spacing', 'layout', 'hover', 'buttons', 'forms', 'content', 'graphics', 'band', 'feedback',
] as const

export type SectionId = (typeof SECTIONS)[number]

export const SECTION = atom({ plugin: 'ak-showcase', key: 'section' } as const, 'text')
export const LAST = atom({ plugin: 'ak-showcase', key: 'last' } as const, '')
export const FIELDS = atom({ plugin: 'ak-showcase', key: 'fields' } as const, {})
export const TONE = atom({ plugin: 'ak-showcase', key: 'tone' } as const, 'info')

const isSection = (value: string): value is SectionId => SECTIONS.some(one => one === value)

/** What the pane needs from the mod: whether ak-mods switches it, and how to publish its segment. */
export type PaneHost = {
  isSwitched: boolean
  republish: () => void
}

/**
 * Draws the showcase: a head with the section picker and the last action, then one section. Every
 * handler only writes the pane's own atoms; the feedback section alone shows a toast or the status
 * line. Nothing here submits a prompt, runs a command or tool, or reaches a file or the network.
 */
export async function renderShowcase($: EngineInterface, e: RenderInput<'Pane'>, host: PaneHost) {
  const el = $.ui.resolve(e)
  const { Box, Text, Button } = el
  const t = texts(await languageFor($))
  // The reads subscribe the pane: each write below redraws it.
  const [stored, last, fields, tone] = await Promise.all([read($, SECTION), read($, LAST), read($, FIELDS), read($, TONE)])
  const section: SectionId = isSection(stored) ? stored : 'text'

  const act = (what: string) => {
    void update($, LAST, () => what)
  }
  const kit: Kit = {
    el,
    surface: e.surface,
    t,
    fields,
    tone,
    act,
    put: (key, value) => {
      void update($, FIELDS, all => ({ ...all, [key]: value }))
      act(`${key} = ${value}`)
    },
    setTone: (next: ShowcaseTone) => {
      void update($, TONE, () => next).then(host.republish)
      act(`tone = ${next}`)
    },
    feedback: kind => {
      if (kind === 'toast') $.ui.toast(t.feedback.toastText)
      else $.ui.status(kind === 'status' ? t.feedback.statusText : undefined)
      act(`feedback ${kind}`)
    },
  }
  const pick = (id: string) => {
    if (isSection(id)) void update($, SECTION, () => id)
  }

  const nav =
    hasForms(e.surface) && 'Select' in el ? (
      <el.Select
        key="section"
        label={t.section}
        options={SECTIONS.map(id => ({ value: id, label: t.sections[id] }))}
        value={section}
        onSelect={pick}
      />
    ) : (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap="xs">
        {SECTIONS.map(id => (
          <Button
            key={`section-${id}`}
            label={t.sections[id]}
            {...(id === section ? { variant: 'primary' as const } : { dimColor: true })}
            onPress={() => pick(id)}
          />
        ))}
      </Box>
    )

  const body = {
    text: textSection,
    colors: colorsSection,
    spacing: spacingSection,
    layout: layoutSection,
    hover: hoverSection,
    buttons: buttonsSection,
    forms: formsSection,
    content: contentSection,
    graphics: graphicsSection,
    band: (k: Kit) => bandSection(k, host.isSwitched),
    feedback: feedbackSection,
  }[section](kit)

  return (
    <Box flexDirection="column" rowGap="sm">
      {nav}
      <Text dimColor size="footnote" wrap="truncate-end">
        {t.last}: {last === '' ? t.none : last}
      </Text>
      <Text size="heading" weight="semibold">
        {t.sections[section]}
      </Text>
      {body}
    </Box>
  )
}
