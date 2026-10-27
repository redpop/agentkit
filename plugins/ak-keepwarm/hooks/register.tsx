// Keep warm: keeps this chat's prompt cache warm on request.
//
// Based on the keepwarm part of Cache Keeper by Nate Herk (MIT, see ../LICENSE).
//
// Each request re-reads the whole context. From the cache that costs about a tenth of normal
// input. Once the cache expires (1 hour idle on a subscription, 5 minutes on the default API TTL),
// the next message writes the whole context again at 1.25x to 2x input. A cache read restarts the
// timer, so a tiny ping before expiry costs a fraction of a rewrite.

import type { EngineInterface, Register } from 'claude-code'

import { clock, minutes, tokens, usd } from './fmt'
import { cachedShare, requestCost, rewriteCost, totalInput, type Usage } from './pricing'

const NAME = 'ak-keepwarm'
const MIN = 60000
const TICK_EVERY = 30000
const DEFAULT_HOURS = 4
const MAX_HOURS = 24
// A request counts as a rewrite or a hit only above this size: small contexts say nothing about the TTL.
const MEASURE_ABOVE = 30000

const S = {
  model: '',
  // Last main-loop request or keep-warm ping that touched the cache.
  lastActivity: 0,
  ctx: 0,
  ttlMin: 60,
  isMeasured: false,
  isWorking: false,
  isKeepWarm: false,
  keepWarmUntil: 0,
  pings: 0,
  pingUsd: 0,
}

let now = 0

const msLeft = (): number | null => (S.lastActivity ? S.ttlMin * MIN - (now - S.lastActivity) : null)

const cacheState = (): 'unknown' | 'kept' | 'cold' | 'cooling' | 'warm' => {
  const left = msLeft()
  if (left === null) return 'unknown'
  if (S.isKeepWarm) return 'kept'
  if (left <= 0) return 'cold'

  return left <= 5 * MIN ? 'cooling' : 'warm'
}

const reset = () => {
  S.lastActivity = 0
  S.ctx = 0
  S.isKeepWarm = false
  S.pings = 0
  S.pingUsd = 0
}

const startKeepWarm = ($: EngineInterface, hours: number) => {
  S.isKeepWarm = true
  S.keepWarmUntil = now + hours * 60 * MIN
  $.ui.toast(`Keeping this cache warm until ${clock(S.keepWarmUntil)}. A ping reads the cache before it expires.`)
}

const stopKeepWarm = ($: EngineInterface, why: string) => {
  if (!S.isKeepWarm) return
  S.isKeepWarm = false
  $.ui.toast(`Keep warm off (${why}). ${S.pings} ping(s), ${usd(S.pingUsd)}.`, { timeoutMs: 8000 })
}

// One ping when the cache is close to expiring. A ping that writes instead of reading did not hit
// the cache, so the loop stops rather than pay for it again.
const keepWarmStep = async ($: EngineInterface) => {
  if (!S.isKeepWarm) return
  if (now >= S.keepWarmUntil) return stopKeepWarm($, 'time limit reached')
  if (S.isWorking || !S.lastActivity) return
  const margin = S.ttlMin >= 60 ? 8 * MIN : 90000
  if (now - S.lastActivity < S.ttlMin * MIN - margin) return

  let reply: Awaited<ReturnType<EngineInterface['model']['fork']>> | null = null
  try {
    reply = await $.model.fork({ prompt: 'keep-alive ping. Reply with only: ok' })
  } catch {
    reply = null
  }
  // `usage` rides every arm of the result, zeros included, so only `isAnswered` says the ping got through.
  if (!reply || !reply.isAnswered) return stopKeepWarm($, 'the ping got no answer, so the cache may already be cold')

  const u = reply.usage
  S.pings += 1
  S.pingUsd += requestCost(u, S.model, S.ttlMin)
  if ((u.cache_creation_input_tokens || 0) > 0.1 * Math.max(1, u.cache_read_input_tokens || 0)) {
    return stopKeepWarm($, `the ping wrote ${tokens(u.cache_creation_input_tokens)} tokens instead of reading the cache`)
  }
  S.lastActivity = now
}

const tick = async ($: EngineInterface, isOff: boolean) => {
  now = await $.clock.now()
  if (isOff) stopKeepWarm($, 'the mod is off')
  else await keepWarmStep($)
  $.ui.invalidate('ui.render')
}

// The usage of one main-loop request tells whether it read the cache or rewrote it. A rewrite after
// 5 to 60 idle minutes shows a 5-minute TTL; a hit after more than 5 idle minutes proves the 1-hour one.
const measure = (u: Usage & { model?: string }, startedAt: number) => {
  const total = totalInput(u)
  const gap = S.lastActivity ? startedAt - S.lastActivity : 0
  S.model = u.model || S.model
  if (S.lastActivity && total > MEASURE_ABOVE && (u.cache_creation_input_tokens || 0) / total > 0.5) {
    if (!S.isMeasured && gap > 5.5 * MIN && gap < S.ttlMin * MIN) {
      S.ttlMin = 5
      S.isMeasured = true
    }
  } else if (S.lastActivity && total > MEASURE_ABOVE && gap > 5.5 * MIN && cachedShare(u) > 0.8 && !S.isMeasured) {
    S.ttlMin = 60
    S.isMeasured = true
  }
  S.ctx = total
}

export const register: Register = on => {
  // Whether ak-mods switches this mod: false once its declare was refused or
  // threw (no ak-mods loaded, or it failed). Then the mod runs on.
  let isSwitched = true

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

  on('session.start', async ($, e, next) => {
    try {
      isSwitched = await $.mods.declare({
        name: NAME,
        title: 'Keep warm',
        summary: 'Keeps the prompt cache warm with a small ping before it expires.',
        details:
          'A band above the prompt shows how long the cache stays warm. /keepwarm [hours|off] sends a ' +
          'small ping shortly before the cache would expire (default 4 hours); the cache read restarts ' +
          'its timer. If a ping writes to the cache instead of reading it, keep warm turns itself off.',
      })
    } catch {
      isSwitched = false
    }
    now = await $.clock.now()
    S.model = await $.session.model()
    await $.command.register({
      name: 'keepwarm',
      description: "Keep this session's prompt cache warm (default 4 hours), or /keepwarm off",
      argumentHint: '[hours|off]',
      immediate: true,
    })
    $.clock.every(TICK_EVERY, () => {
      isOff(() => $.mods.isOn({ name: NAME }))
        .then(off => tick($, off))
        .catch(() => {})
    })

    return next(e)
  })

  // /clear, /resume and /branch start from an unknown cache. The process goes on under a new
  // session id, and no session.start fires for it.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    reset()

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    now = await $.clock.now()
    S.isWorking = true

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const startedAt = await $.clock.now()
    const result = yield* next(e)
    if (e.agentId || !result || !result.usage) return result
    now = await $.clock.now()
    measure(result.usage, startedAt)
    S.lastActivity = now

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId) return done
    now = await $.clock.now()
    S.isWorking = false
    $.ui.invalidate('ui.render')

    return done
  })

  // The mod's own command turns it on, then does what it does.
  on('command.run', { command: 'keepwarm' }, async ($, e) => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) await $.mods.set({ name: NAME, on: true })
    now = await $.clock.now()
    const arg = String(e.args || '').trim().toLowerCase()
    if (arg === 'off' || (arg === '' && S.isKeepWarm)) {
      stopKeepWarm($, 'turned off')
    } else {
      startKeepWarm($, Number(arg) > 0 ? Math.min(MAX_HOURS, Number(arg)) : DEFAULT_HOURS)
    }
    $.ui.invalidate('ui.render')

    return {}
  })

  // The band above the prompt: this chat's cache at a glance, with one button.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The read subscribes the drawing, so a switch redraws it.
    await $.state.get({ plugin: 'ak-mods', key: 'on' })
    if (await isOff(() => $.mods.isOn({ name: NAME }))) return next(e)
    const below = await next(e)
    const state = cacheState()
    if (state === 'unknown' && !S.isKeepWarm) return below
    if (e.props?.hasSurvey) return below

    const { Box, Text, Button } = $.ui.resolve(e)
    const left = msLeft() ?? 0
    const press = async () => {
      now = await $.clock.now()
      if (S.isKeepWarm) stopKeepWarm($, 'turned off')
      else startKeepWarm($, DEFAULT_HOURS)
      $.ui.invalidate('ui.render')
    }
    const status =
      state === 'kept' ? (
        <Text color="cyan">{`◆ kept warm · ${S.pings} ping${S.pings === 1 ? '' : 's'} ${usd(S.pingUsd)} · until ${clock(S.keepWarmUntil)}`}</Text>
      ) : state === 'warm' ? (
        <Text color="green">{`● cache warm ${minutes(left)}`}</Text>
      ) : state === 'cooling' ? (
        <Text color="yellow" bold>{`◐ cache cools in ${minutes(left)}`}</Text>
      ) : (
        <Text dimColor>{`○ cache cold ${minutes(-left)}`}</Text>
      )
    const mine = (
      <Box flexDirection="row" columnGap={2}>
        <Box flexDirection="row">
          {status}
          <Text dimColor>{` │ ctx ${tokens(S.ctx)} │ rewrite ≈ ${usd(rewriteCost(S.ctx, S.model, S.ttlMin))}`}</Text>
        </Box>
        {state !== 'cold' && (
          <Button key="keepwarm" label={S.isKeepWarm ? 'stop warm' : 'keep warm'} hotkey="1" plain onPress={press} />
        )}
      </Box>
    )

    return <Box flexDirection="column">{below ? [mine, below] : [mine]}</Box>
  })

  // This mod's switch changed, and the write landed: switching off stops the keep-warm loop.
  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    const done = await next(e)
    const isOn = e.value[NAME] === true
    if (isSwitched && done.value?.isSet === true && !isOn && e.previous?.[NAME] === true) {
      stopKeepWarm($, 'the mod is off')
    }

    return done
  }).catch(($, e, next) => next(e))
}
