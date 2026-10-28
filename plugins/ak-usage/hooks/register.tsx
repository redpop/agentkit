// Usage: how full this session's context is and how much of the account's 5-hour limit is used, at
// a glance. Inspired by Token Weather from claude-code-playground (Anthropic, Apache-2.0); no code
// is taken over.
//
// The context is this session's own. The rate-limit windows are the account's: they count every
// session, as the last API response of this one reported them.

import type { EngineInterface, Register } from 'claude-code'

import { reading } from './reading'

const NAME = 'ak-usage'

type Segment = Parameters<EngineInterface['mods']['segment']>[0]

// The figures as the shared band shows them; undefined, a clear, while there are none. A failed
// read shows nothing rather than a stale figure.
const segment = async ($: EngineInterface): Promise<Segment> => {
  let now: ReturnType<typeof reading>
  try {
    now = reading(await $.session.usage())
  } catch {
    return undefined
  }

  return now === undefined ? undefined : { text: now.text, tone: now.tone, priority: 7 }
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
    try {
      isSwitched = await $.mods.declare({
        name: NAME,
        title: 'Usage',
        summary: "Shows how full this session's context is and how much of the 5-hour limit is used.",
        details:
          'Its segment in the shared band above the prompt reads ctx 67% · 5h 42%: the context of ' +
          'this session, and the 5-hour window of the account, every session counted. The 7-day ' +
          'window joins from 75 %. The colour follows the fullest figure: yellow from 75 %, red ' +
          'from 90 %. The windows are as the last response of this session reported them.',
      })
    } catch {
      isSwitched = false
    }
    await publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segment($)))
    $.ui.invalidate('ui.render')

    return next(e)
  })

  // Each main-loop turn brings new figures. A subagent's turn does not change this session's
  // context.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId) return done
    await publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segment($)))
    $.ui.invalidate('ui.render')

    return done
  })

  // /clear, /resume and /branch end the chat, and ak-mods clears every segment with it. Publish
  // again once the end has passed. A `session.end` hook, not `classic.SessionStart`: where Claude
  // Code's built-in guard loads, a user's mod gets no classic event.
  on('session.end', async ($, e, next) => {
    $.clock.after(0, () => {
      publish(() => $.mods.isOn({ name: NAME }), async () => $.mods.segment(await segment($)))
        .then(() => $.ui.invalidate('ui.render'))
        .catch(() => {})
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
    const color = now.tone === 'alert' ? 'red' : now.tone === 'warn' ? 'yellow' : 'green'
    const mine = (
      <Box flexDirection="row">
        <Text color={color}>{now.text}</Text>
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
