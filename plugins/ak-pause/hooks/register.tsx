// Break: how long the person has worked without a break, at a glance, and a nudge once a block at a
// moment that does not break the flow. Other break reminders exist for Claude Code (they write into
// the conversation, or know no timer); no code is taken over.
//
// The count is the person's, not the session's: every session of the mod reads and writes one block
// in the store. Ten minutes without input end it, or the break length the person set. Nothing of it
// reaches Claude's context.

import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Block, Limits } from './block'
import {
  BREAK_MINUTES,
  LONG_TURN_MS,
  WORK_MINUTES,
  drink,
  limitsOf,
  mayNotice,
  notice,
  notifyAtMs,
  parse,
  sensed,
  storedLimits,
  touch,
  workedMs,
} from './block'
import { languageFor, learnLanguage, texts } from './i18n'
import { systemIdleMs } from './idle'
import type { Segment } from './view'
import { DRINK, SET, cardOf, notifyText, segmentOf, settingsOf, toastText } from './view'

const NAME = 'ak-pause'
const KEY = 'block'
const LIMITS = 'limits'
const TICK_MS = 60_000
// Typing writes the block at most this often; a prompt sent always does.
const TYPING_MS = 60_000
// A hint waits while the person has typed this recently.
const TYPED_MS = 5_000
// The prompts the person sent: at the terminal, through Remote Control, or in the desktop app (an
// SDK host). A notification, a routine or another agent's message is not them.
const PERSON = new Set(['composer', 'bridge', 'sdk'])

// Publishes while ak-mods switches the mod and it is on; whether it is off. Both fail open.
type Publish = (isOn: () => Promise<boolean>, send: () => Promise<void>) => Promise<void>
type Gate = { publish: Publish; isOff: (isOn: () => Promise<boolean>) => Promise<boolean>; isSwitched: () => boolean }

/** What the mod holds, for one load of the module. */
type Pause = {
  // The segment as last drawn, for the own band too.
  shown: Segment | undefined
  // When this session last wrote the block, and when the person last typed.
  lastWrite: number
  lastTyped: number
  tick: Timer | undefined
  longTurn: Timer | undefined
  // Whether the system's idle time is asked for: false once it could not tell, until the next session.
  canSense: boolean
  // The break length the details this session declared name, in minutes.
  declaredBreak: number | undefined
}

const pausing = (): Pause => ({
  shown: undefined,
  lastWrite: Number.NEGATIVE_INFINITY,
  lastTyped: Number.NEGATIVE_INFINITY,
  tick: undefined,
  longTurn: undefined,
  canSense: true,
  declaredBreak: undefined,
})

const stop = (pause: Pause) => {
  pause.tick?.cancel()
  pause.longTurn?.cancel()
  pause.tick = undefined
  pause.longTurn = undefined
}

// Function declarations, not arrows: the hooks loader follows `$` only into those.

/** The shared block: `ok` false when the store cannot be read, and nothing is shown or written then. */
async function read($: EngineInterface): Promise<{ ok: boolean; block: Block | undefined }> {
  try {
    return { ok: true, block: parse(await $.store.get(KEY)) }
  } catch {
    return { ok: false, block: undefined }
  }
}

/** The block and break lengths the person set, shared by every session; the defaults when unreadable. */
async function limits($: EngineInterface): Promise<Limits> {
  return limitsOf(await $.store.get(LIMITS).catch(() => undefined))
}

/** Writes the shared block; a write that fails is dropped, and the next input tries again. */
async function write($: EngineInterface, block: Block): Promise<void> {
  await $.store.set(KEY, block).catch(() => {})
}

/** Draws the block again: the segment with its card, in the band and in the own band. */
async function show($: EngineInterface, pause: Pause, gate: Gate): Promise<void> {
  const now = await $.clock.now()
  const lang = await languageFor($)
  const [{ block }, set] = await Promise.all([read($), limits($)])
  // Another session may have set another break length: the details name it, so declare them again.
  const { breakMinutes } = storedLimits(set)
  if (gate.isSwitched() && pause.declaredBreak !== undefined && pause.declaredBreak !== breakMinutes) {
    pause.declaredBreak = breakMinutes
    await declare($).catch(() => false)
  }
  const segment = segmentOf(block, now, lang, set)
  pause.shown =
    segment === undefined ? undefined : { ...segment, card: cardOf(block, now, lang, set), settings: settingsOf(set, lang) }
  await gate.publish(() => $.mods.isOn({ name: NAME }), () => $.mods.segment(pause.shown))
  $.ui.invalidate('ui.render')
}

/**
 * The system's last input, on macOS: work in another app continues the block as input in Claude
 * does. Where the system cannot tell, the mod stops asking and counts the input in Claude alone.
 */
async function sense($: EngineInterface, pause: Pause): Promise<void> {
  if (!pause.canSense) return
  const idleMs = await systemIdleMs($)
  if (idleMs === undefined) {
    pause.canSense = false
    return
  }
  const now = await $.clock.now()
  const [{ ok, block }, set] = await Promise.all([read($), limits($)])
  const next = ok ? sensed(block, now - idleMs, now, set.breakMs) : undefined
  if (next === undefined) return
  pause.lastWrite = now
  await write($, next)
}

/** Asks the system for its last input, then draws the block again. */
async function refresh($: EngineInterface, pause: Pause, gate: Gate): Promise<void> {
  await sense($, pause)
  await show($, pause, gate)
}

/**
 * The mod is on: asks the system off the hook, so no start waits on `ioreg`, then redraws every
 * minute, so a block's time moves and a break shows.
 */
function resume($: EngineInterface, pause: Pause, gate: Gate): void {
  $.clock.after(0, () => {
    refresh($, pause, gate).catch(() => {})
  })
  pause.tick?.cancel()
  pause.tick = $.clock.every(TICK_MS, () => {
    refresh($, pause, gate).catch(() => {})
  })
}

/**
 * An input: the block moves on, or a new one starts after a break. Typing writes once a minute and,
 * in between, touches nothing but the clock: a block this session wrote a minute ago is no break.
 */
async function active($: EngineInterface, pause: Pause, gate: Gate, isTyping: boolean): Promise<void> {
  const now = await $.clock.now()
  if (isTyping) pause.lastTyped = now
  if (isTyping && now - pause.lastWrite < TYPING_MS) return
  if (await gate.isOff(() => $.mods.isOn({ name: NAME }))) return
  const [{ ok, block }, set] = await Promise.all([read($), limits($)])
  if (!ok) return
  pause.lastWrite = now
  await write($, touch(block, now, set.breakMs))
  await show($, pause, gate)
}

/**
 * The block's one hint: during a long turn from ten minutes before the block's end, after a turn
 * from its end. Claimed in the store first, so no session repeats it. None while the person types:
 * the next quiet moment gets it.
 */
async function hint($: EngineInterface, pause: Pause, gate: Gate, isLong: boolean): Promise<void> {
  if (await gate.isOff(() => $.mods.isOn({ name: NAME }))) return
  const now = await $.clock.now()
  if (now - pause.lastTyped < TYPED_MS) return
  const [{ block }, set] = await Promise.all([read($), limits($)])
  const atMs = isLong ? notifyAtMs(set) : set.workMs
  if (block === undefined || !mayNotice(block, now, atMs, set.breakMs)) return
  await write($, notice(block))
  const lang = await languageFor($)
  const worked = workedMs(block, now, set.breakMs)
  if (isLong) await $.ui.notify(notifyText(worked, lang)).catch(() => {})
  else $.ui.toast(toastText(worked, lang))
}

/** Announces the mod to ak-mods, its details naming the break length set now. */
async function declare($: EngineInterface): Promise<boolean> {
  const [t, set] = await Promise.all([languageFor($).then(texts), limits($)])

  return $.mods.declare({ name: NAME, title: t.title, summary: t.summary, details: t.details(storedLimits(set).breakMinutes) })
}

export const register: Register = on => {
  // Whether ak-mods switches this mod: false once its declare was refused or
  // threw (no ak-mods loaded, or it failed). Then the mod runs on.
  let isSwitched = true
  // Counts this mod's switch changes: a republish scheduled for one change is dropped once another
  // followed it.
  let switches = 0
  const pause = pausing()

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
  const gate: Gate = { publish, isOff, isSwitched: () => isSwitched }

  on('session.start', async ($, e, next) => {
    await learnLanguage($)
    try {
      isSwitched = await declare($)
      pause.declaredBreak = storedLimits(await limits($)).breakMinutes
    } catch {
      isSwitched = false
    }
    await $.command.register({ name: DRINK, description: 'Mark that you drank water' })
    await $.command.register({ name: SET, description: 'Set the block or break length: work <minutes> or break <minutes>' })
    // A session asks the system afresh: `ioreg` may answer now where it did not before.
    pause.canSense = true
    if (!(await isOff(() => $.mods.isOn({ name: NAME })))) {
      await show($, pause, gate)
      resume($, pause, gate)
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const done = await next(e)
    if (PERSON.has(e.origin.kind)) await active($, pause, gate, false)

    return done
  }).catch(($, e, next) => next(e))

  on('prompt.edit', async ($, e, next) => {
    const done = await next(e)
    await active($, pause, gate, true)

    return done
  }).catch(($, e, next) => next(e))

  // A turn of the main loop that runs long leaves the person waiting: a good moment, once a block.
  on('turn.start', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId || (await isOff(() => $.mods.isOn({ name: NAME })))) return done
    pause.longTurn?.cancel()
    pause.longTurn = $.clock.after(LONG_TURN_MS, () => {
      hint($, pause, gate, true).catch(() => {})
    })

    return done
  }).catch(($, e, next) => next(e))

  // A finished turn is the other good moment: Claude waits for the person, not they for Claude.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId) return done
    pause.longTurn?.cancel()
    pause.longTurn = undefined
    await hint($, pause, gate, false)

    return done
  }).catch(($, e, next) => next(e))

  on('command.run', { command: DRINK }, async $ => {
    const now = await $.clock.now()
    const { block } = await read($)
    if (block !== undefined) await write($, drink(block, now))
    // Off the hook: the band's button runs this inside ak-mods' own call, where a publish is lost.
    $.clock.after(0, () => {
      show($, pause, gate).catch(() => {})
    })

    return {}
  })

  // The Mods pane's pickers run this, as a person may: one length, stored for every session.
  on('command.run', { command: SET }, async ($, e) => {
    const t = texts(await languageFor($))
    const words = e.args.trim().split(/\s+/)
    const [what, value] = words
    const minutes = Number(value)
    const options: readonly number[] | undefined =
      what === 'work' ? WORK_MINUTES : what === 'break' ? BREAK_MINUTES : undefined
    if (words.length !== 2 || options === undefined || !options.includes(minutes)) return { text: t.setUsage }
    const held = storedLimits(await limits($))
    const next = what === 'work' ? { ...held, workMinutes: minutes } : { ...held, breakMinutes: minutes }
    await $.store.set(LIMITS, next)
    // Off the hook: the pane's picker runs this inside ak-mods' own call, where a publish is lost.
    // Drawing again declares the details again too, as they name the break length.
    $.clock.after(0, () => {
      show($, pause, gate).catch(() => {})
    })

    return { text: t.set(`${what === 'work' ? t.workSetting : t.breakSetting} ${minutes} min`) }
  })

  // /clear, /resume and /branch end the chat, and ak-mods clears every segment with it. Publish
  // again once the end has passed.
  on('session.end', async ($, e, next) => {
    $.clock.after(0, () => {
      show($, pause, gate).catch(() => {})
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  // The mod's own band, drawn only while ak-mods does not switch the mod:
  // otherwise ak-mods draws its segment, never both.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isSwitched) return next(e)
    const below = await next(e)
    const { shown } = pause
    if (e.props?.hasSurvey || shown === undefined) return below

    const { Box, Text } = $.ui.resolve(e)
    // As ak-mods draws a tone in the shared band: `ok` in the text colour, so only what needs
    // attention stands out. The desktop app paints no theme key on text: there the colours are
    // fixed, as ak-mods has them.
    const isDesktop = e.surface === 'desktop'
    const TONES: Record<string, { color?: string; bold?: true; dimColor?: true }> = {
      warn: { color: isDesktop ? '#cd8f2d' : 'warning' },
      alert: { color: isDesktop ? '#db4c46' : 'error', bold: true },
      info: { color: isDesktop ? '#4889cd' : 'suggestion' },
      dim: { dimColor: true },
    }
    const mine = (
      <Box flexDirection="row">
        <Text>
          {(shown.parts ?? [shown]).map((part, at) => (
            <Text key={`part-${at}`} {...TONES[part.tone ?? '']}>
              {part.text}
            </Text>
          ))}
        </Text>
      </Box>
    )

    return <Box flexDirection="column">{below ? [mine, below] : [mine]}</Box>
  })

  // This mod's switch changed, and the write landed: when on, publish again and tick (ak-mods
  // cleared the segment at the switch-off); when off, stop the timers. Not from inside this hook: it
  // runs within the `set` of ak-mods, where a segment call resolves without reaching it.
  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    const done = await next(e)
    const isOn = e.value[NAME] === true
    if (isSwitched && done.value?.isSet === true && isOn !== (e.previous?.[NAME] === true)) {
      const change = ++switches
      if (isOn) {
        $.clock.after(0, () => {
          if (change !== switches) return
          resume($, pause, gate)
        })
      } else {
        stop(pause)
      }
      $.ui.invalidate('ui.render')
    }

    return done
  }).catch(($, e, next) => next(e))
}
