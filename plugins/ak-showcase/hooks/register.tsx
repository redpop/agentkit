// Showcase: a style guide in a pane. It draws every element, prop and variant a hooks module has,
// names the prop under each sample and what does not exist. Its controls are dummies: they only
// write the pane's own state, so a person or an agent can try them without anything happening.

import type { EngineInterface, Register } from 'claude-code'

import type { ShowcaseTone } from '../types'
import { languageFor, learnLanguage, texts } from './i18n'
import { PANE, renderShowcase } from './pane'
import { TONES } from './sections/kit'

type Segment = Parameters<EngineInterface['mods']['segment']>[0]

// The ring the demo segment shows, in percent.
const RING = 60

/** The demo segment: one of every part a segment can carry, in the tone the pane picked. */
const segment = async ($: EngineInterface): Promise<Segment> => {
  const t = texts(await languageFor($))
  // The tone the pane picked; the pane's atom starts at info.
  const { value: tone = 'info' } = await $.state.get({ plugin: 'ak-showcase', key: 'tone' })

  return {
    text: `Showcase ${RING}%`,
    parts: [{ text: 'Showcase', tone: 'dim' }, { text: ` ${RING}%` }],
    rich: [
      { text: 'check', icon: 'check' },
      { text: ' Showcase ' },
      { text: `${RING}%`, ring: RING },
    ],
    compact: { text: `SC ${RING}%`, rich: [{ text: `${RING}%`, ring: RING }] },
    card: [
      { label: 'tone', value: tone },
      { label: 'ring', value: `${RING}%` },
    ],
    settings: {
      command: 'showcase',
      rows: [{ key: 'tone', label: t.band.tone, value: tone, options: TONES.map(value => ({ value })) }],
    },
    // The ⋯ menu of the open card in the Mods pane; /showcase demo only records the pick.
    actions: t.demoActions.map(({ label, args }) => ({ label, command: 'showcase', args })),
    tone,
    priority: 1,
    button: { label: t.open, command: 'showcase', isPaneOnly: true },
  }
}

const toneOf = (value: string): ShowcaseTone | undefined => TONES.find(one => one === value)

export const register: Register = on => {
  // Whether ak-mods switches this mod: false once its declare was refused or
  // threw (no ak-mods loaded, or it failed). Then the mod runs on.
  let isSwitched = true
  // Counts this mod's switch changes, so a republish scheduled for one change
  // is dropped once another followed it.
  let switches = 0

  // Off only when ak-mods switches the mod and says so. A call that throws
  // leaves the mod on (fail-open).
  const isOff = async (isOn: () => Promise<boolean>): Promise<boolean> => {
    if (!isSwitched) return false
    try {
      return !(await isOn())
    } catch {
      return false
    }
  }

  // Publishes while ak-mods switches the mod and it is on. A publish that
  // throws hands the drawing back to the mod's own band (fail-open).
  const publish = async (isOn: () => Promise<boolean>, send: () => Promise<void>) => {
    if (!isSwitched || (await isOff(isOn))) return
    try {
      await send()
    } catch {
      isSwitched = false
    }
  }

  on('session.start', async ($, e, next) => {
    const t = texts(await learnLanguage($))
    try {
      isSwitched = await $.mods.declare({ name: PANE, title: t.title, summary: t.summary, details: t.details })
    } catch {
      isSwitched = false
    }
    await $.command.register({ name: 'showcase', description: t.command, argumentHint: '[tone <tone>]' })
    await publish(() => $.mods.isOn({ name: PANE }), async () => $.mods.segment(await segment($)))

    return next(e)
  })

  // /clear, /resume and /branch end the chat, and ak-mods clears every
  // segment with it: publish again once the end has passed.
  on('session.end', async ($, e, next) => {
    $.clock.after(0, () => {
      publish(() => $.mods.isOn({ name: PANE }), async () => $.mods.segment(await segment($))).catch(() => {})
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  // The mod's own band, drawn only while ak-mods does not switch the mod:
  // otherwise ak-mods draws its segment, never both.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isSwitched) return next(e)
    const below = await next(e)
    if (e.props?.hasSurvey) return below

    const { Box, Text, Button } = $.ui.resolve(e)
    const t = texts(await languageFor($))
    const mine = (
      <Box flexDirection="row" columnGap={2}>
        <Text dimColor>{t.title}</Text>
        <Button key="showcase-open" label={t.open} plain onPress={() => void $.ui.open({ id: PANE, title: t.title })} />
      </Box>
    )

    return <Box flexDirection="column">{below ? [mine, below] : [mine]}</Box>
  })

  // The pane, drawn while the mod is on.
  on('ui.render', { component: 'Pane', requestId: 'ak-showcase' }, async ($, e, next) => {
    if (await isOff(() => $.mods.isOn({ name: PANE }))) return next(e)

    return renderShowcase($, e, {
      isSwitched,
      // Off the press, as a publish is elsewhere scheduled: one path for every caller.
      republish: () =>
        $.clock.after(0, () => {
          publish(() => $.mods.isOn({ name: PANE }), async () => $.mods.segment(await segment($))).catch(() => {})
        }),
    })
  })

  // The mod's own command turns it on, then opens the pane; `tone <tone>` sets the demo segment's
  // tone, which the settings picker in the Mods pane runs.
  on('command.run', { command: 'showcase' }, async ($, e) => {
    if (await isOff(() => $.mods.isOn({ name: PANE }))) await $.mods.set({ name: PANE, on: true })
    const t = texts(await languageFor($))
    const [verb, value = '', ...rest] = String(e.args || '').trim().split(/\s+/).filter(word => word !== '')
    if (verb === undefined) {
      await $.ui.open({ id: PANE, title: t.title })

      return { text: t.opened }
    }
    if (verb === 'demo') {
      // An action of the demo segment's ⋯ menu: it only records itself, like every control here.
      const action = t.demoActions.find(one => one.args === `demo ${value}`)
      if (action === undefined || rest.length > 0) return { text: t.usage }
      await $.state.set({ plugin: 'ak-showcase', key: 'last' }, `Menu action ${action.label}`)

      return { text: t.demoRan(action.label) }
    }
    const tone = toneOf(value)
    if (verb !== 'tone' || tone === undefined || rest.length > 0) return { text: t.usage }
    await $.state.set({ plugin: 'ak-showcase', key: 'tone' }, tone)
    // Off the hook: a settings pick runs this inside ak-mods' own call.
    $.clock.after(0, () => {
      publish(() => $.mods.isOn({ name: PANE }), async () => $.mods.segment(await segment($))).catch(() => {})
    })

    return { text: t.toneSet(tone) }
  })

  // This mod's switch changed, and the write landed: when on, publish its
  // segment again (ak-mods cleared it at the switch-off) and open the pane;
  // when off, clear its status line and close its pane.
  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    const done = await next(e)
    const isOn = e.value[PANE] === true
    if (isSwitched && done.value?.isSet === true && isOn !== (e.previous?.[PANE] === true)) {
      const change = ++switches
      if (isOn) {
        const title = texts(await languageFor($)).title
        $.clock.after(0, () => {
          if (change !== switches) return
          publish(async () => true, async () => $.mods.segment(await segment($)))
            .then(() => $.ui.open({ id: PANE, title }))
            .catch(() => {})
        })
      } else {
        $.ui.status(undefined)
        await $.ui.close({ id: PANE })
      }
    }

    return done
  }).catch(($, e, next) => next(e))
}
