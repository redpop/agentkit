import type { ElementTable, RenderChildren, RenderSurface } from 'claude-code'

import type { ShowcaseTone } from '../../types'
import type { Texts } from '../i18n'

/**
 * What a section draws with. A section gets no `$`: every control it draws calls one of these, and
 * none of them reaches past the pane (no prompt, command, tool, file or network).
 */
export type Kit = {
  el: ElementTable
  surface: RenderSurface
  t: Texts
  /** The values the pane keeps: typed text and picks by key, the demo segment's tone. */
  fields: Readonly<Record<string, string>>
  tone: ShowcaseTone
  /** Records that a control was used; the pane's head shows it. */
  act: (what: string) => void
  /** Keeps what was typed or picked under the element's key, and records the action. */
  put: (key: string, value: string) => void
  /** Sets the demo segment's tone and publishes it again. */
  setTone: (tone: ShowcaseTone) => void
  /** The only controls that show something outside the pane: a toast or the status line. */
  feedback: (kind: 'toast' | 'status' | 'clear') => void
}

export const TONES: readonly ShowcaseTone[] = ['ok', 'warn', 'alert', 'info', 'dim']

// The surfaces that draw `Input` and `Select`: the mobile app draws neither, and an element a
// surface does not know renders as nothing, so the table `resolve` answers is no guide.
const FORM_SURFACES = new Set<RenderSurface>(['terminal', 'desktop', 'vscode'])

export const hasForms = (surface: RenderSurface): boolean => FORM_SURFACES.has(surface)

/** A sample's caption: the code that draws it, small and dim. */
export const Snippet = (k: Kit, code: string) => (
  <k.el.Text dimColor mono size="footnote" wrap="truncate-end">
    {code}
  </k.el.Text>
)

/** A labelled group of samples. */
export const Group = (k: Kit, title: string, children: RenderChildren[]) => (
  <k.el.Box flexDirection="column" rowGap="xs" marginBottom="sm">
    <k.el.Text weight="semibold">{title}</k.el.Text>
    {children}
  </k.el.Box>
)

/** The lines every section ends with: a note where one helps, then what does not exist. */
export const Footer = (k: Kit, missing: string, note?: string) => (
  <k.el.Box flexDirection="column" rowGap="xs" marginTop="sm">
    {note !== undefined && (
      <k.el.Text size="footnote" wrap="wrap">
        <k.el.Text weight="semibold">{k.t.note}: </k.el.Text>
        {note}
      </k.el.Text>
    )}
    <k.el.Text size="footnote" dimColor wrap="wrap">
      <k.el.Text weight="semibold">{k.t.missing}: </k.el.Text>
      {missing}
    </k.el.Text>
  </k.el.Box>
)
