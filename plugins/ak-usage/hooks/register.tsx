// Usage: how full this session's context is and how much of the account's 5-hour limit is used, at
// a glance. Inspired by Token Weather from claude-code-playground (Anthropic, Apache-2.0); no code
// is taken over.
//
// The context is this session's own. The rate-limit windows are the account's: they count every
// session, as the last API response of this one reported them.

import type { EngineInterface, Register, Timer } from 'claude-code'

import { languageFor, learnLanguage, texts } from './i18n'
import { alerts, nextReset, reading } from './reading'

const NAME = 'ak-usage'

type Segment = Parameters<EngineInterface['mods']['segment']>[0]

// The figures as the shared band shows them; undefined, a clear, while there are none. A failed
// read shows nothing rather than a stale figure.
const segment = async ($: EngineInterface): Promise<Segment> => {
  let now: ReturnType<typeof reading>
  try {
    now = reading(await $.session.usage(), await $.clock.now(), await languageFor($))
  } catch {
    return undefined
  }

  return now === undefined ? undefined : { ...now, priority: 7 }
}

// Publishes while ak-mods switches the mod and it is on, else does nothing.
type Publish = (isOn: () => Promise<boolean>, send: () => Promise<void>) => Promise<void>

// Fires at the next reset of a window the reading shows, which then leaves the band.
let resetTimer: Timer | undefined

// Publishes the figures, draws the own band again and waits for the next reset of a window shown.
// Past it the window is left out, so the wait does not repeat.
const refresh = async ($: EngineInterface, publish: Publish): Promise<void> => {
  await publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segment($)))
  $.ui.invalidate('ui.render')
  resetTimer?.cancel()
  resetTimer = undefined
  let at: number | undefined
  let now = 0
  try {
    now = await $.clock.now()
    at = nextReset(await $.session.usage(), now)
  } catch {
    return
  }
  if (at === undefined) return
  resetTimer = $.clock.after(at - now + 1000, () => {
    refresh($, publish).catch(() => {})
  })
}

export const register: Register = on => {
  // Whether ak-mods switches this mod: false once its declare was refused or
  // threw (no ak-mods loaded, or it failed). Then the mod runs on.
  let isSwitched = true
  // Counts this mod's switch changes: a republish scheduled for one change is dropped once another
  // followed it.
  let switches = 0
  // The windows already toasted past 90 %, by kind and reset: each one once until it resets.
  const toasted = new Set<string>()

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
    await refresh($, publish)

    return next(e)
  })

  // Each main-loop turn brings new figures. A subagent's turn does not change this session's
  // context.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId) return done
    await refresh($, publish)

    return done
  })

  // A window past 90 % gets one toast until it resets. Its bar turns red as well, but the band may be
  // out of sight.
  on('session.measure', async ($, e, next) => {
    const done = await next(e)
    if (!e.changed.includes('rateLimits') || (await isOff(() => $.mods.isOn({ name: NAME })))) return done
    for (const one of alerts(e.rateLimits, await $.clock.now(), await languageFor($))) {
      if (toasted.has(one.key)) continue
      toasted.add(one.key)
      $.ui.toast(one.text)
    }

    return done
  }).catch(($, e, next) => next(e))

  // /clear, /resume and /branch end the chat, and ak-mods clears every segment with it. Publish
  // again once the end has passed. A `session.end` hook, not `classic.SessionStart`: where Claude
  // Code's built-in guard loads, a user's mod gets no classic event.
  on('session.end', async ($, e, next) => {
    $.clock.after(0, () => {
      refresh($, publish).catch(() => {})
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  // The mod's own band, drawn only while ak-mods does not switch the mod:
  // otherwise ak-mods draws its segment, never both.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isSwitched) return next(e)
    const below = await next(e)
    if (e.props?.hasSurvey) return below
    const now = await segment($)
    if (now === undefined) return below

    const { Box, Text } = $.ui.resolve(e)
    // As in the shared band: each part in its own tone, colour only from 75 %, the text colour below.
    // The bars need the parts: their filled and empty cells differ in tone alone.
    // The desktop app paints no theme key on text: there the colours are fixed, as ak-mods has them.
    const isDesktop = e.surface === 'desktop'
    const toneProps = (tone: string | undefined) =>
      tone === 'alert'
        ? { color: isDesktop ? '#db4c46' : 'error' }
        : tone === 'warn'
          ? { color: isDesktop ? '#cd8f2d' : 'warning' }
          : tone === 'dim'
            ? { dimColor: true }
            : {}
    const mine = (
      <Box flexDirection="row">
        <Text>
          {(now.parts ?? [now]).map((part, at) => (
            <Text key={`part-${at}`} {...toneProps(part.tone)}>
              {part.text}
            </Text>
          ))}
        </Text>
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
