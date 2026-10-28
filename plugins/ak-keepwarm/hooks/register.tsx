// Keep warm: keeps this chat's prompt cache warm on request.
//
// Based on the keepwarm part of Cache Keeper by Nate Herk (MIT, see ../LICENSE).
//
// Each request re-reads the whole context. From the cache that costs about a tenth of normal
// input. Once the cache expires (1 hour idle on a subscription, 5 minutes on the default API TTL),
// the next message writes the whole context again at 1.25x to 2x input. A cache read restarts the
// timer, so a tiny ping before expiry costs a fraction of a rewrite.

import type { EngineInterface, Register, Timer } from 'claude-code'

import { minutes, tokens, usd } from './fmt'
import { languageFor, learnLanguage, texts, type Lang } from './i18n'
import { cachedShare, requestCost, rewriteCost, totalInput, type Usage } from './pricing'

const NAME = 'ak-keepwarm'
const MIN = 60000
const HOUR = 60 * MIN
const TICK_EVERY = 30000
const DEFAULT_MS = 4 * HOUR
// With `always` on, each main-loop turn keeps the chat warm until this long after it.
const ALWAYS_MS = 6 * HOUR
const MAX_MS = 24 * HOUR
// A request counts as a rewrite or a hit only above this size: small contexts say nothing about the TTL.
const MEASURE_ABOVE = 30000
// The waits before a ping the API turned away as busy is sent again.
const RETRY_MIN = [1, 2, 4]
// A chat's saved state is dropped once it has been idle this long and keeps nothing warm.
const FORGET_AFTER = 48 * HOUR

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
  // Requests that wrote the cache afresh after it had been warm, and what they cost.
  rewrites: 0,
  rewriteUsd: 0,
  // Busy-API retries of the ping due now, and when the next is sent; 0 while none waits.
  retries: 0,
  retryAt: 0,
  // The process has no conversation to fork yet (after a restart): the next turn gives it one.
  isAwaitingTurn: false,
  // Keep every chat warm until ALWAYS_MS after its last turn, across sessions.
  isAlways: false,
}

// The fields of S saved per chat, so keep warm survives a reload of the mod and a restart.
const SAVED = ['model', 'lastActivity', 'ctx', 'ttlMin', 'isMeasured', 'keepWarmUntil', 'pings', 'pingUsd', 'rewrites', 'rewriteUsd'] as const

// The language of the texts, read at the session's start and at each restore.
let lang: Lang = 'en'
const T = () => texts(lang)

// A time of day on the language's clock: `11:10pm`, `23:10`.
const clock = (ts: number): string => {
  const d = new Date(ts)

  return T().clock(d.getHours(), d.getMinutes())
}

// The chat whose state S holds; undefined until the first restore.
let chatId: string | undefined
// The 30-second check, one per load of the module.
let ticking: Timer | undefined

let now = 0

type Segment = Parameters<EngineInterface['mods']['segment']>[0]

// The last segment handed to ak-mods, as JSON; null before the first and after a switch-off,
// whose clear ak-mods makes itself. Publishing only a change keeps redraws from churning the state.
let published: string | null = null
// Whether ak-mods ever took a segment: a mod it never drew has no stale segment to clear.
let hasPublished = false

const msLeft = (): number | null => (S.lastActivity ? S.ttlMin * MIN - (now - S.lastActivity) : null)

const cacheState = (): 'unknown' | 'kept' | 'cold' | 'cooling' | 'warm' => {
  const left = msLeft()
  if (left === null) return 'unknown'
  if (S.isKeepWarm) return 'kept'
  if (left <= 0) return 'cold'

  return left <= 5 * MIN ? 'cooling' : 'warm'
}

// A new chat: nothing known of its cache, nothing kept warm, nothing counted. `always` is not the
// chat's and stays.
const reset = () => {
  S.model = ''
  S.lastActivity = 0
  S.ctx = 0
  S.ttlMin = 60
  S.isMeasured = false
  S.isKeepWarm = false
  S.keepWarmUntil = 0
  S.pings = 0
  S.pingUsd = 0
  S.rewrites = 0
  S.rewriteUsd = 0
  S.retries = 0
  S.retryAt = 0
  S.isAwaitingTurn = false
}

// Writes this chat's state to the store. A failed write keeps the state in memory only.
const save = ($: EngineInterface) => {
  if (chatId === undefined) return
  const record = Object.fromEntries(SAVED.map(key => [key, S[key]]))
  $.store.set(`chat:${chatId}`, { ...record, keepWarmUntil: S.isKeepWarm ? S.keepWarmUntil : 0 }).catch(() => {})
}

// Brings S to the current chat: after a reload of the mod, a restart, a resume or a /clear, the
// chat's saved state comes back, keep warm with it while its window runs. A chat with none starts
// from an unknown cache. `always` is read along. A failed read starts from what S holds.
const restore = async ($: EngineInterface) => {
  let id: string
  try {
    id = await $.session.id()
  } catch {
    return
  }
  lang = await languageFor($)
  if (id === chatId) return
  chatId = id
  reset()
  now = await $.clock.now()
  try {
    S.isAlways = (await $.store.get('always')) === true
    const saved = await $.store.get(`chat:${id}`)
    if (saved && typeof saved === 'object') {
      const record = saved as Record<string, unknown>
      for (const key of SAVED) {
        if (typeof record[key] === typeof S[key]) Object.assign(S, { [key]: record[key] })
      }
    }
  } catch {
    return
  }
  S.isKeepWarm = S.keepWarmUntil > now
}

// Drops the saved state of other chats that went idle long ago and keep nothing warm.
const prune = async ($: EngineInterface) => {
  for (const key of await $.store.keys()) {
    if (!key.startsWith('chat:') || key === `chat:${chatId}`) continue
    const record = (await $.store.get(key)) as { lastActivity?: unknown; keepWarmUntil?: unknown } | undefined
    const last = typeof record?.lastActivity === 'number' ? record.lastActivity : 0
    const until = typeof record?.keepWarmUntil === 'number' ? record.keepWarmUntil : 0
    if (until <= now && now - last > FORGET_AFTER) await $.store.delete(key)
  }
}

type Switch = (isOn: () => Promise<boolean>) => Promise<boolean>
type Share = (isOn: () => Promise<boolean>, send: () => Promise<boolean>) => Promise<void>

// Starts the 30-second check once per load of the module: a ping when due, then the segment.
// `session.start` starts it, and so does the first hook a reloaded module runs, should the session
// not start again.
const startTicking = ($: EngineInterface, isOff: Switch, share: Share) => {
  if (ticking) return
  ticking = $.clock.every(TICK_EVERY, () => {
    isOff(() => $.mods.isOn({ name: NAME }))
      .then(off => tick($, off))
      .then(() => share(() => $.mods.isOn({ name: NAME }), () => publish($)))
      .then(() => $.ui.invalidate('ui.render'))
      .catch(() => {})
  })
}

// Starts keep warm until `ms` from now. A roll (`always` after a turn) only lengthens a window that
// runs, quietly; a start by hand sets it.
const startKeepWarm = ($: EngineInterface, ms: number, isRoll = false) => {
  const until = isRoll && S.isKeepWarm ? Math.max(S.keepWarmUntil, now + ms) : now + ms
  if (!isRoll) {
    $.ui.toast(
      S.isAlways
        ? T().startedAlways(minutes(ALWAYS_MS))
        : T().started(clock(until)),
    )
  }
  S.isKeepWarm = true
  S.keepWarmUntil = until
  S.retries = 0
  S.retryAt = 0
  save($)
}

const stopKeepWarm = ($: EngineInterface, why: string) => {
  if (!S.isKeepWarm) return
  S.isKeepWarm = false
  S.retries = 0
  S.retryAt = 0
  S.isAwaitingTurn = false
  save($)
  $.ui.toast(T().stopped(why, S.pings, usd(S.pingUsd)), { timeoutMs: 8000 })
}

// Turns `always` on or off for every chat, here and in later sessions.
const setAlways = ($: EngineInterface, isAlways: boolean) => {
  S.isAlways = isAlways
  $.store.set('always', isAlways).catch(() => {})
}

// An API status that says it was busy, not that the ping was wrong: worth sending again.
const isBusy = (status: number | null): boolean => status === 429 || status === 529 || (status !== null && status >= 500)

// One ping when the cache is close to expiring. A ping that writes instead of reading, or reads
// nothing, did not hit the cache, so the loop stops rather than pay for it again. A ping the API
// turned away as busy is sent again after 1, 2 and 4 minutes, while it can still land before the
// cache expires. One with nothing to fork waits for the next turn.
const keepWarmStep = async ($: EngineInterface) => {
  if (!S.isKeepWarm) return
  if (now >= S.keepWarmUntil) return stopKeepWarm($, T().why.limit)
  if (S.isWorking || !S.lastActivity || S.isAwaitingTurn) return
  const expiry = S.lastActivity + S.ttlMin * MIN
  if (S.retryAt) {
    if (now < S.retryAt) return
  } else {
    const margin = S.ttlMin >= 60 ? 8 * MIN : 90000
    if (now < expiry - margin) return
  }
  if (now >= expiry) return stopKeepWarm($, T().why.expired)

  let reply: Awaited<ReturnType<EngineInterface['model']['fork']>> | null = null
  try {
    reply = await $.model.fork({ prompt: 'keep-alive ping. Reply with only: ok' })
  } catch {
    reply = null
  }
  // `usage` rides every arm of the result, zeros included, so only `isAnswered` says the ping got through.
  if (reply && !reply.isAnswered && reply.reason === 'nothing-to-fork') {
    S.isAwaitingTurn = true

    return
  }
  if (reply && !reply.isAnswered && reply.reason === 'api-error' && isBusy(reply.status)) {
    const wait = RETRY_MIN[S.retries]
    if (wait !== undefined && now + wait * MIN < expiry - MIN) {
      S.retries += 1
      S.retryAt = now + wait * MIN

      return
    }

    return stopKeepWarm($, T().why.busy)
  }
  if (!reply || !reply.isAnswered) return stopKeepWarm($, T().why.unanswered)

  const u = reply.usage
  S.pings += 1
  S.pingUsd += requestCost(u, S.model, S.ttlMin)
  S.retries = 0
  S.retryAt = 0
  if (!(u.cache_read_input_tokens || 0)) return stopKeepWarm($, T().why.unread)
  if ((u.cache_creation_input_tokens || 0) > 0.1 * (u.cache_read_input_tokens || 0)) {
    return stopKeepWarm($, T().why.wrote(tokens(u.cache_creation_input_tokens)))
  }
  S.lastActivity = now
  save($)
}

const tick = async ($: EngineInterface, isOff: boolean) => {
  await restore($)
  now = await $.clock.now()
  if (isOff) stopKeepWarm($, T().why.modOff)
  else await keepWarmStep($)
}

// What keep warm and the lost caches cost this chat, from its first request: shown in the Mods
// pane, not the band, which stays one row. When keep warm ends is the start toast's.
const tally = (): string | undefined => {
  const parts = [
    S.pings === 0 ? '' : T().pings(S.pings, usd(S.pingUsd)),
    S.rewrites === 0 ? '' : T().rewrites(S.rewrites, usd(S.rewriteUsd)),
    S.retryAt ? T().retry(S.retries, RETRY_MIN.length) : '',
    S.isKeepWarm && S.isAwaitingTurn ? T().waiting : '',
    S.isAlways ? T().always : '',
  ].filter(Boolean)

  return parts.length === 0 ? undefined : parts.join(' · ')
}

// How much of the cache's time is left, as a circle that empties: full, three quarters, half, a
// quarter. The colour says how urgent it is, the circle how far it has run down.
const drain = (left: number): string => {
  const share = left / (S.ttlMin * MIN)

  return share > 0.75 ? '●' : share > 0.5 ? '◕' : share > 0.25 ? '◑' : '◔'
}

// The cache state as the shared band shows it: no segment before the first request. The circle
// and the time left say it is warm; only cold says so in a word. The rewrite estimate rides along
// only while it matters, as the cache cools or is cold, its label dim.
const segment = (): Segment => {
  const state = S.isKeepWarm ? 'kept' : cacheState()
  if (state === 'unknown') return undefined
  const t = T()
  const left = msLeft() ?? 0
  const cost = `≈ ${usd(rewriteCost(S.ctx, S.model, S.ttlMin))}`
  const button = (label: string) => ({ label, hotkey: '1', command: 'keepwarm' })
  const detail = tally()
  // The hover card on the desktop app: the cache's state, what it holds and what it cost.
  const card = [
    {
      label: t.card.cache,
      value:
        state === 'kept'
          ? t.keptUntil(clock(S.keepWarmUntil))
          : state === 'cold'
            ? t.coldFor(minutes(-left))
            : t.left(minutes(left)),
    },
    { label: t.card.lifetime, value: `${S.ttlMin >= 60 ? t.hour : t.fiveMinutes}${S.isMeasured ? '' : t.assumed}` },
    { label: t.card.context, value: t.tokens(tokens(S.ctx)) },
    { label: t.card.rewrite, value: cost },
    ...(S.pings === 0 ? [] : [{ label: t.card.pings, value: `${S.pings} · ${usd(S.pingUsd)}` }]),
    ...(S.rewrites === 0 ? [] : [{ label: t.card.rewrites, value: `${S.rewrites} · ${usd(S.rewriteUsd)}` }]),
    ...(S.retryAt ? [{ label: t.card.retry, value: t.of(S.retries, RETRY_MIN.length) }] : []),
    ...(S.isKeepWarm && S.isAwaitingTurn ? [{ label: t.card.ping, value: t.waitsTurn }] : []),
    ...(S.isAlways ? [{ label: t.card.always, value: t.on }] : []),
  ]
  const more = { ...(detail ? { detail } : {}), card }
  // Where the band draws pictures, the circle is a ring that empties with the time left.
  const ring = Math.round((Math.max(0, left) / (S.ttlMin * MIN)) * 100)
  if (state === 'kept') {
    return {
      text: `◆ ${t.keptWarm}`,
      rich: [
        { text: t.ringKept, tone: 'info', ring: 100 },
        { text: ` ${t.keptWarm}`, tone: 'info' },
      ],
      ...more,
      tone: 'info',
      priority: 6,
      button: button(t.stop),
    }
  }
  const time = `${drain(left)} ${minutes(left)}`
  if (state === 'warm') {
    return {
      text: time,
      rich: [
        { text: t.ringLeft(minutes(left)), tone: 'ok', ring },
        { text: ` ${minutes(left)}`, tone: 'ok' },
        { text: ` ${t.cacheWord}`, tone: 'dim' },
      ],
      ...more,
      tone: 'ok',
      priority: 6,
      button: button(t.keep),
    }
  }
  if (state === 'cooling') {
    return {
      text: `${time}  ${t.rewrite} ${cost}`,
      ...more,
      // The desktop app has the room to say what is at stake: when the cache drops, and what the next
      // message then writes again.
      rich: [
        { text: t.ringLeft(minutes(left)), tone: 'warn', ring },
        { text: ` ${t.drops(minutes(left))}`, tone: 'warn' },
        { text: ` · ${t.nextRewrites} `, tone: 'dim' },
        { text: t.tokensAt(tokens(S.ctx), cost), tone: 'warn' },
      ],
      parts: [
        { text: time, tone: 'warn' },
        { text: `  ${t.rewrite} `, tone: 'dim' },
        { text: cost, tone: 'warn' },
      ],
      tone: 'warn',
      priority: 6,
      button: button(t.keep),
    }
  }

  return {
    text: `○ ${t.cold} ${minutes(-left)}  ${t.rewrite} ${cost}`,
    rich: [
      { text: t.ringCold, tone: 'dim', ring: 0 },
      { text: ` ${t.cold} ${minutes(-left)}  ${t.rewrite} ${cost}`, tone: 'dim' },
    ],
    ...more,
    tone: 'dim',
    priority: 6,
  }
}

// Hands the segment to ak-mods when it changed. A failed send clears the last one, so a stale
// segment is never drawn, and the next publish sends again. False when ak-mods never took a segment
// or the clear failed too: then the mod draws its own band again (fail-open).
const publish = async ($: EngineInterface): Promise<boolean> => {
  const next = segment()
  const key = JSON.stringify(next ?? null)
  if (key === published) return true
  try {
    await $.mods.segment(next)
    published = key
    hasPublished = true

    return true
  } catch {
    published = null
  }
  if (!hasPublished) return false
  try {
    await $.mods.segment(undefined)

    return true
  } catch {
    return false
  }
}

// Switched off, ak-mods clears the segment: the next publish after switching on is sent whole.
const forget = () => {
  published = null
}

// The usage of one main-loop request tells whether it read the cache or rewrote it. A rewrite after
// 5 to 60 idle minutes shows a 5-minute TTL; a hit after more than 5 idle minutes proves the 1-hour one.
// A rewrite of a cache that had been warm is counted with its cost: the price of a lost cache.
const measure = (u: Usage & { model?: string }, startedAt: number) => {
  const total = totalInput(u)
  const gap = S.lastActivity ? startedAt - S.lastActivity : 0
  S.model = u.model || S.model
  if (S.lastActivity && total > MEASURE_ABOVE && (u.cache_creation_input_tokens || 0) / total > 0.5) {
    S.rewrites += 1
    S.rewriteUsd += rewriteCost(u.cache_creation_input_tokens || 0, S.model, S.ttlMin)
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

// The argument of /keepwarm as a span: `90m`, `2h30m`, `6h`, or bare hours (`3`, `1.5`); undefined
// when it is none of these, zero, or past MAX_MS.
const durationOf = (arg: string): number | undefined => {
  const hours = /^\d+(\.\d+)?$/.test(arg) ? Number(arg) * HOUR : undefined
  const match = /^(?:(\d+)h)?(?:(\d+)m)?$/.exec(arg)
  const span = hours ?? (match && (match[1] || match[2]) ? (Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)) * MIN : undefined)

  return span !== undefined && span > 0 && span <= MAX_MS ? span : undefined
}

export const register: Register = on => {
  // Whether ak-mods switches this mod: false once its declare was refused or
  // threw (no ak-mods loaded, or it failed). Then the mod runs on.
  let isSwitched = true
  // Counts this mod's switch changes: a republish scheduled for one change is dropped once another
  // followed it. Its own read of the switch could still answer as of the change it was scheduled for.
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

  // While ak-mods draws, the mod publishes its state instead of drawing it, never while off.
  // A publish that fails for good hands the drawing back to the mod's own band. Every caller
  // redraws after it, so the own band shows at once.
  const share = async (isOn: () => Promise<boolean>, send: () => Promise<boolean>) => {
    if (!isSwitched) return
    if (await isOff(isOn)) return forget()
    if (await send()) return
    isSwitched = false
  }

  on('session.start', async ($, e, next) => {
    lang = await learnLanguage($)
    const t = T()
    try {
      isSwitched = await $.mods.declare({ name: NAME, title: t.title, summary: t.summary, details: t.details })
    } catch {
      isSwitched = false
    }
    await $.command.register({
      name: 'keepwarm',
      description: t.command,
      argumentHint: '[90m|2h30m|hours|always|off]',
      immediate: true,
    })
    await restore($)
    S.model = S.model || (await $.session.model())
    await prune($).catch(() => {})
    startTicking($, isOff, share)
    await share(() => $.mods.isOn({ name: NAME }), () => publish($))
    $.ui.invalidate('ui.render')

    return next(e)
  })

  // /clear, /resume and /branch end the chat, and the next one starts from an unknown cache. The
  // process goes on under a new session id, and no session.start fires for it. A `session.end`
  // hook, not `classic.SessionStart`: where Claude Code's built-in guard loads, a user's mod gets
  // no classic event. The publish waits until the end has passed, after ak-mods' own clear.
  on('session.end', async ($, e, next) => {
    // /clear ends keep warm for the chat. Any other end leaves its window saved, so a resume or a
    // restart picks it up again.
    if (e.reason === 'clear' && S.isKeepWarm) {
      S.isKeepWarm = false
      save($)
    }
    reset()
    // S is the ended chat's until the next chat's id is current; the next restore loads that one.
    chatId = e.sessionId
    $.clock.after(0, () => {
      share(() => $.mods.isOn({ name: NAME }), () => publish($))
        .then(() => $.ui.invalidate('ui.render'))
        .catch(() => {})
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    await restore($)
    startTicking($, isOff, share)
    now = await $.clock.now()
    S.isWorking = true

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const startedAt = await $.clock.now()
    const result = yield* next(e)
    if (e.agentId || !result || !result.usage) return result
    await restore($)
    now = await $.clock.now()
    measure(result.usage, startedAt)
    S.lastActivity = now
    S.isAwaitingTurn = false
    S.retries = 0
    S.retryAt = 0
    save($)
    await share(() => $.mods.isOn({ name: NAME }), () => publish($))
    $.ui.invalidate('ui.render')

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId) return done
    now = await $.clock.now()
    S.isWorking = false
    // With `always` on, each turn keeps the chat warm until ALWAYS_MS after it.
    if (S.isAlways && S.lastActivity && !(await isOff(() => $.mods.isOn({ name: NAME })))) {
      startKeepWarm($, ALWAYS_MS, true)
    }
    await share(() => $.mods.isOn({ name: NAME }), () => publish($))
    $.ui.invalidate('ui.render')

    return done
  })

  // The mod's own command turns it on, then does what it does.
  on('command.run', { command: 'keepwarm' }, async ($, e) => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) await $.mods.set({ name: NAME, on: true })
    await restore($)
    startTicking($, isOff, share)
    now = await $.clock.now()
    const arg = String(e.args || '').trim().toLowerCase()
    const span = durationOf(arg)
    if (arg === 'off' || (arg === '' && S.isKeepWarm)) {
      // Stopping by hand ends `always` too: else the next turn would start it again.
      setAlways($, false)
      stopKeepWarm($, T().why.byHand)
    } else if (arg === 'always') {
      setAlways($, true)
      startKeepWarm($, ALWAYS_MS)
    } else if (arg === '' || span !== undefined) {
      startKeepWarm($, span ?? DEFAULT_MS)
    } else {
      $.ui.toast(T().badSpan(arg), { timeoutMs: 8000 })
    }
    // Off the hook: run from ak-mods' button, this command is nested in ak-mods' own call, where a
    // publish would resolve without reaching ak-mods.
    $.clock.after(0, () => {
      share(() => $.mods.isOn({ name: NAME }), () => publish($))
        .then(() => $.ui.invalidate('ui.render'))
        .catch(() => {})
    })
    $.ui.invalidate('ui.render')

    return {}
  })

  // The band above the prompt: this chat's cache at a glance, with one button. Drawn only while
  // ak-mods does not draw the mod's segment: never both.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isSwitched) return next(e)
    const below = await next(e)
    const state = cacheState()
    if (state === 'unknown' && !S.isKeepWarm) return below
    if (e.props?.hasSurvey) return below

    const { Box, Text, Button } = $.ui.resolve(e)
    const left = msLeft() ?? 0
    const press = async () => {
      now = await $.clock.now()
      if (S.isKeepWarm) {
        setAlways($, false)
        stopKeepWarm($, T().why.byHand)
      } else startKeepWarm($, DEFAULT_MS)
      $.ui.invalidate('ui.render')
    }
    const status =
      state === 'kept' ? (
        <Text color="suggestion">{`◆ ${T().keptWarm}`}</Text>
      ) : state === 'warm' ? (
        <Text>{T().ownWarm(minutes(left))}</Text>
      ) : state === 'cooling' ? (
        <Text color="warning" bold>{T().ownCools(minutes(left))}</Text>
      ) : (
        <Text dimColor>{T().ownCold(minutes(-left))}</Text>
      )
    const mine = (
      <Box flexDirection="row" columnGap={2}>
        <Box flexDirection="row">
          {status}
          <Text dimColor>{` │ ctx ${tokens(S.ctx)} │ ${T().rewrite} ≈ ${usd(rewriteCost(S.ctx, S.model, S.ttlMin))}`}</Text>
        </Box>
        {state !== 'cold' && (
          <Button key="keepwarm" label={S.isKeepWarm ? T().stop : T().keep} hotkey="1" plain onPress={press} />
        )}
      </Box>
    )

    return <Box flexDirection="column">{below ? [mine, below] : [mine]}</Box>
  })

  // This mod's switch changed, and the write landed: switching off stops the keep-warm loop,
  // switching on publishes the segment again. Not from inside this hook: it runs within the
  // `set` of ak-mods, where a segment call resolves without reaching ak-mods. Hence the next turn
  // of the clock, unless the switch changed again meanwhile. The time is read afresh: the last
  // tick or turn read it up to 30 s earlier.
  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    const done = await next(e)
    const isOn = e.value[NAME] === true
    if (isSwitched && done.value?.isSet === true && isOn !== (e.previous?.[NAME] === true)) {
      if (!isOn) stopKeepWarm($, T().why.modOff)
      forget()
      const change = ++switches
      if (isOn) {
        $.clock.after(0, () => {
          if (change !== switches) return
          $.clock
            .now()
            .then(async time => {
              // The switch may have changed again while the time was read.
              if (change !== switches) return
              now = time
              await share(() => $.mods.isOn({ name: NAME }), () => publish($))
              $.ui.invalidate('ui.render')
            })
            .catch(() => {})
        })
      }
      $.ui.invalidate('ui.render')
    }

    return done
  }).catch(($, e, next) => next(e))
}
