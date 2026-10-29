// Session id: copies this session's id, so an agent in another session can be told which one is
// meant. Session names are not unique; the id is.

import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import { languageFor, learnLanguage, texts } from './i18n'

const NAME = 'ak-session-id'
// How much of the id the band shows: enough to tell sessions apart at a glance.
const TAIL = 6
// The characters the compact band keeps: enough to tell two sessions apart at a glance.
const COMPACT_TAIL = 4
// How long the segment says the id was copied.
const COPIED_MS = 2000

// Until when the segment says the id was copied: a check mark in place of the id.
let copiedUntil = 0
// The engine id the segment was last built from: a turn that finds another publishes again.
let shownEngine: string | undefined

type Segment = Parameters<EngineInterface['mods']['segment']>[0]

// A session has two ids: the engine's, which names the transcript file, and in the desktop app the
// host's (`local_…`), which the desktop's session tools address. The host's comes from the
// environment alone; `isEngine` asks for the engine's even there.
const pick = async ($: EngineInterface, isEngine: boolean): Promise<string> => {
  const host = isEngine ? undefined : await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')

  return host !== undefined && host !== '' ? host : await $.session.id()
}

const tail = (id: string): string => `id …${id.slice(-TAIL)}`

// Copies the id and says so. Should no clipboard take it, the answer names the whole id and why, so
// it can be copied by hand.
const copy = async ($: EngineInterface, isEngine: boolean, surface?: RenderSurface): Promise<string> => {
  const id = await pick($, isEngine)
  const copied = await $.ui.copy(surface === undefined ? { text: id } : { text: id, surface })
  const t = texts(await languageFor($))
  if (copied.isCopied) copiedUntil = (await $.clock.now()) + COPIED_MS

  return copied.isCopied ? t.copied(id) : t.notCopied(id, copied.reason)
}

// The id as the shared band shows it, with the button that copies it. Low priority: when the band
// runs out of room, this segment goes first. On the desktop app an id icon stands for the word,
// and the card holds both ids whole. For a moment after a copy, a check mark says it landed.
const segment = async ($: EngineInterface): Promise<Segment> => {
  const t = texts(await languageFor($))
  const shown = await pick($, false)
  const host = await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')
  const engine = await $.session.id()
  shownEngine = engine
  const card = [
    ...(host !== undefined && host !== '' ? [{ label: t.desktopId, value: host }] : []),
    { label: t.engineId, value: engine },
  ]
  // On the desktop app the id itself copies: its one action is plain from what it shows.
  const button = { label: t.copy, hotkey: 'c', command: 'session-id', isOnText: true }
  if ((await $.clock.now()) < copiedUntil) {
    return {
      text: `✓ ${t.copiedShort}`,
      rich: [
        { text: t.copiedShort, icon: 'check' },
        { text: ` ${t.copiedShort}` },
      ],
      // Compact, only the icon changes: the same width, so the band keeps its layout.
      compact: {
        text: `✓…${shown.slice(-COMPACT_TAIL)}`,
        rich: [
          { text: t.copiedShort, icon: 'check' },
          { text: ` …${shown.slice(-COMPACT_TAIL)}` },
        ],
      },
      card,
      priority: 2,
      button,
    }
  }

  return {
    text: tail(shown),
    rich: [
      { text: 'id', icon: 'id' },
      { text: ` …${shown.slice(-TAIL)}` },
    ],
    // Short of room: the icon and fewer characters, still text, so the id stays a press away.
    compact: {
      text: `#…${shown.slice(-COMPACT_TAIL)}`,
      rich: [
        { text: 'id', icon: 'id' },
        { text: ` …${shown.slice(-COMPACT_TAIL)}` },
      ],
    },
    card,
    tone: 'dim',
    priority: 2,
    button,
  }
}

export const register: Register = on => {
  // Whether ak-mods switches this mod: false once its declare was refused or
  // threw (no ak-mods loaded, or it failed). Then the mod runs on.
  let isSwitched = true
  // Counts this mod's switch changes: a republish scheduled for one change is dropped once another
  // followed it.
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

  // Publishes while ak-mods switches the mod and it is on. A publish that throws hands the drawing
  // back to the mod's own band (fail-open).
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
      isSwitched = await $.mods.declare({ name: NAME, title: t.title, summary: t.summary, details: t.details })
    } catch {
      isSwitched = false
    }
    await $.command.register({
      name: 'session-id',
      description: t.command,
      argumentHint: '[engine]',
      immediate: true,
    })
    await publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segment($)))
    $.ui.invalidate('ui.render')

    return next(e)
  })

  // /clear, /resume and /branch end the chat, and ak-mods clears every segment with it; the engine
  // id changes too. Publish again once the end has passed. A `session.end` hook, not
  // `classic.SessionStart`: where Claude Code's built-in guard loads, a user's mod gets no classic
  // event.
  on('session.end', async ($, e, next) => {
    $.clock.after(0, () => {
      publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segment($)))
        .then(() => $.ui.invalidate('ui.render'))
        .catch(() => {})
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  // The id the end's republish read may still be the ended chat's: the next main-loop turn finds
  // the new one and publishes again.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && shownEngine !== undefined && (await $.session.id()) !== shownEngine) {
      $.clock.after(0, () => {
        publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segment($)))
          .then(() => $.ui.invalidate('ui.render'))
          .catch(() => {})
      })
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // The mod's own command turns it on, then copies. Its answer is a toast too: run from the band's
  // button, the command's text is not shown.
  on('command.run', { command: 'session-id' }, async ($, e) => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) await $.mods.set({ name: NAME, on: true })
    const arg = String(e.args || '').trim().toLowerCase()
    if (arg !== '' && arg !== 'engine') return { text: texts(await languageFor($)).usage }
    const text = await copy($, arg === 'engine')
    $.ui.toast(text)
    // Off the hook, as the band's button runs this inside ak-mods' own call: the check mark now,
    // the id again once it has been read.
    const republish = () =>
      publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segment($)))
        .then(() => $.ui.invalidate('ui.render'))
        .catch(() => {})
    $.clock.after(0, republish)
    $.clock.after(COPIED_MS + 50, republish)

    return { text }
  })

  // The mod's own band, drawn only while ak-mods does not switch the mod:
  // otherwise ak-mods draws its segment, never both.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isSwitched) return next(e)
    const below = await next(e)
    if (e.props?.hasSurvey) return below

    const { Box, Text, Button } = $.ui.resolve(e)
    const press = (surface: RenderSurface) => {
      copy($, false, surface)
        .then(text => $.ui.toast(text))
        .catch(() => {})
    }
    const mine = (
      <Box flexDirection="row" columnGap={2}>
        <Text dimColor>{tail(await pick($, false))}</Text>
        <Button key="session-id" label={texts(await languageFor($)).copy} hotkey="c" plain onPress={pressed => press(pressed.surface)} />
      </Box>
    )

    return <Box flexDirection="column">{below ? [mine, below] : [mine]}</Box>
  })

  // This mod's switch changed, and the write landed: when on, publish its segment again (ak-mods
  // cleared it at the switch-off). Not from inside this hook: it runs within the `set` of ak-mods,
  // where a segment call resolves without reaching ak-mods.
  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    const done = await next(e)
    const isOn = e.value[NAME] === true
    if (isSwitched && done.value?.isSet === true && isOn !== (e.previous?.[NAME] === true)) {
      const change = ++switches
      if (isOn) {
        $.clock.after(0, () => {
          if (change !== switches) return
          publish(async () => true, async () => $.mods.segment(await segment($)))
            .then(() => $.ui.invalidate('ui.render'))
            .catch(() => {})
        })
      }
      $.ui.invalidate('ui.render')
    }

    return done
  }).catch(($, e, next) => next(e))
}
