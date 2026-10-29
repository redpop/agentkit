// GitLab: the merge request of the current branch and its head pipeline, at a glance. Inspired by
// the feature set of a third-party GitLab plugin (MIT); no code is taken over.
//
// GitLab is read through glab, which brings its own login: the mod holds no token. It asks every
// 15 seconds while a pipeline runs, every few minutes while a merge request is open (pushes also
// come from outside Claude), and on every prompt, turn end and push Claude makes.

import type { EngineInterface, Register, Timer } from 'claude-code'

import { fetchStatus, fetchTrace, openUrl } from './glab'
import { languageFor, learnLanguage, texts } from './i18n'
import { draftFor, excerpt } from './joblog'
import type { Status } from './model'
import { firstFailed, phaseOf } from './model'
import type { Segment } from './view'
import { cardFor, segmentFor, toastFor } from './view'

const NAME = 'ak-gitlab'
const FAST_MS = 15_000
const SLOW_MS = 150_000
const TICK_MS = 5_000
// Fetches closer than this to the last one are dropped: a prompt, its turn and a push come together.
const QUIET_MS = 3_000
// The Bash commands after which the branch or its pipeline may have changed.
const MOVES = /\bgit\s+(?:checkout|switch|push)\b|\bglab\s+mr\s+create\b/

// Publishes while ak-mods switches the mod and it is on; whether it is off. Both fail open.
type Publish = (isOn: () => Promise<boolean>, send: () => Promise<void>) => Promise<void>
type Gate = { publish: Publish; isOff: (isOn: () => Promise<boolean>) => Promise<boolean> }

/** What the mod watches, for one load of the module. */
type Watch = {
  // What the last fetch that answered found; a failed fetch leaves it, so the band does not flicker.
  status: Status
  // The segment as last drawn, for the own band too.
  shown: Segment | undefined
  // Each pipeline's estimate, fetched once.
  estimates: Map<number, number | undefined>
  // The toasts given, by the state a pipeline reached; the pipelines seen, so one already settled
  // at first sight gets none.
  toasted: Set<string>
  seen: Set<number>
  isAuthToasted: boolean
  inflight: Promise<void> | undefined
  lastEnded: number
  poll: Timer | undefined
  tick: Timer | undefined
}

const watching = (): Watch => ({
  status: { kind: 'none' },
  shown: undefined,
  estimates: new Map(),
  toasted: new Set(),
  seen: new Set(),
  isAuthToasted: false,
  inflight: undefined,
  lastEnded: Number.NEGATIVE_INFINITY,
  poll: undefined,
  tick: undefined,
})

const stop = (watch: Watch) => {
  watch.poll?.cancel()
  watch.tick?.cancel()
  watch.poll = undefined
  watch.tick = undefined
}

// Function declarations, not arrows: the hooks loader follows `$` only into those.

/** Draws the status again: the segment with its card, in the band and in the own band. */
async function show($: EngineInterface, watch: Watch, gate: Gate): Promise<void> {
  const now = await $.clock.now()
  const lang = await languageFor($)
  const { status } = watch
  const segment = segmentFor(status, now, lang)
  watch.shown = segment === undefined || status.kind !== 'mr' ? segment : { ...segment, card: cardFor(status.mr, now, lang) }
  await gate.publish(() => $.mods.isOn({ name: NAME }), () => $.mods.segment(watch.shown))
  $.ui.invalidate('ui.render')
}

/**
 * The next fetch, by what the status shows: soon while the pipeline runs, with the time moving in
 * between; later while a merge request is open; none without one.
 */
function arm($: EngineInterface, watch: Watch, gate: Gate): void {
  stop(watch)
  if (watch.status.kind !== 'mr') return
  const isRunning = phaseOf(watch.status.mr.pipeline) === 'running'
  watch.poll = $.clock.after(isRunning ? FAST_MS : SLOW_MS, () => {
    refresh($, watch, gate).catch(() => {})
  })
  if (isRunning) {
    watch.tick = $.clock.every(TICK_MS, () => {
      show($, watch, gate).catch(() => {})
    })
  }
}

/** A toast for each state a pipeline reaches while the mod watches it; none for the state it had at first sight. */
async function announce($: EngineInterface, watch: Watch): Promise<void> {
  const { status } = watch
  if (status.kind !== 'mr' || status.mr.pipeline === undefined) return
  const { id } = status.mr.pipeline
  const toast = toastFor(status.mr, await languageFor($))
  const isFirstSight = !watch.seen.has(id)
  watch.seen.add(id)
  if (toast === undefined || watch.toasted.has(toast.key)) return
  watch.toasted.add(toast.key)
  if (!isFirstSight) $.ui.toast(toast.text)
}

/** Fetches the status and draws it; at most one fetch at a time, none right after another. */
async function refresh($: EngineInterface, watch: Watch, gate: Gate): Promise<void> {
  if (watch.inflight !== undefined) return watch.inflight
  if ((await $.clock.now()) - watch.lastEnded < QUIET_MS) return
  if (await gate.isOff(() => $.mods.isOn({ name: NAME }))) {
    stop(watch)
    return
  }
  watch.inflight = (async () => {
    const next = await fetchStatus($, watch.estimates)
    watch.lastEnded = await $.clock.now()
    if (next.kind === 'unavailable' && next.reason === 'error') {
      arm($, watch, gate)
      return
    }
    if (next.kind === 'unavailable' && next.reason === 'no-auth' && !watch.isAuthToasted) {
      watch.isAuthToasted = true
      $.ui.toast(texts(await languageFor($)).noAuth)
    }
    watch.status = next
    await announce($, watch)
    await show($, watch, gate)
    arm($, watch, gate)
  })().finally(() => {
    watch.inflight = undefined
  })

  return watch.inflight
}

/** A fetch off the hook that asked: it runs glab, which the prompt or the turn should not wait for. */
function soon($: EngineInterface, watch: Watch, gate: Gate): void {
  $.clock.after(0, () => {
    refresh($, watch, gate).catch(() => {})
  })
}

export const register: Register = on => {
  // Whether ak-mods switches this mod: false once its declare was refused or
  // threw (no ak-mods loaded, or it failed). Then the mod runs on.
  let isSwitched = true
  // Counts this mod's switch changes: a republish scheduled for one change is dropped once another
  // followed it.
  let switches = 0
  const watch = watching()

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
  const gate: Gate = { publish, isOff }

  on('session.start', async ($, e, next) => {
    const t = texts(await learnLanguage($))
    try {
      isSwitched = await $.mods.declare({ name: NAME, title: t.title, summary: t.summary, details: t.details })
    } catch {
      isSwitched = false
    }
    await $.command.register({ name: 'gitlab-open', description: 'Open the merge request of the current branch' })
    await $.command.register({ name: 'gitlab-errors', description: "Put the failed job's log excerpt in the prompt box" })
    soon($, watch, gate)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const done = await next(e)
    soon($, watch, gate)

    return done
  }).catch(($, e, next) => next(e))

  // A subagent's turn changes nothing on GitLab the main loop has not.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (!e.agentId) soon($, watch, gate)

    return done
  }).catch(($, e, next) => next(e))

  // A checkout, switch or push, or a new merge request: look at once.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const done = await next(e)
    if (MOVES.test(e.command)) soon($, watch, gate)

    return done
  }).catch(($, e, next) => next(e))

  // /clear, /resume and /branch end the chat, and ak-mods clears every segment with it. Publish
  // again once the end has passed.
  on('session.end', async ($, e, next) => {
    $.clock.after(0, () => {
      show($, watch, gate).catch(() => {})
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'gitlab-open' }, async $ => {
    const { status } = watch
    if (status.kind === 'mr') await openUrl($, status.mr.webUrl)
    else $.ui.toast(texts(await languageFor($)).noMr)

    return {}
  })

  // The failed job's log as a draft after what is typed: a sentence can be added before it goes.
  on('command.run', { command: 'gitlab-errors' }, async $ => {
    const lang = await languageFor($)
    const t = texts(lang)
    const { status } = watch
    const failed = status.kind === 'mr' && status.mr.pipeline !== undefined ? firstFailed(status.mr.pipeline) : undefined
    const trace = failed === undefined ? undefined : await fetchTrace($, failed.id)
    if (status.kind !== 'mr' || failed === undefined || trace === undefined) {
      $.ui.toast(t.noLog)
      return {}
    }
    const body = draftFor(status.mr, failed, excerpt(trace), lang)
    const box = await $.prompt.read()
    const filled = await $.prompt.fill({ text: box.text === '' ? body : `\n\n${body}`, mode: 'append' })
    if (!filled.isFilled) $.ui.toast(t.noBox)

    return {}
  })

  // The mod's own band, drawn only while ak-mods does not switch the mod:
  // otherwise ak-mods draws its segment, never both.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isSwitched) return next(e)
    const below = await next(e)
    const { shown } = watch
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

  // This mod's switch changed, and the write landed: when on, fetch and publish again (ak-mods
  // cleared the segment at the switch-off); when off, stop asking GitLab. Not from inside this
  // hook: it runs within the `set` of ak-mods, where a segment call resolves without reaching it.
  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    const done = await next(e)
    const isOn = e.value[NAME] === true
    if (isSwitched && done.value?.isSet === true && isOn !== (e.previous?.[NAME] === true)) {
      const change = ++switches
      if (isOn) {
        $.clock.after(0, () => {
          if (change !== switches) return
          watch.lastEnded = Number.NEGATIVE_INFINITY
          refresh($, watch, gate).catch(() => {})
        })
      } else {
        stop(watch)
      }
      $.ui.invalidate('ui.render')
    }

    return done
  }).catch(($, e, next) => next(e))
}
