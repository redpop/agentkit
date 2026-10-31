import type { EngineInterface } from 'claude-code'

/** The languages the texts come in. */
export type Lang = 'en' | 'de'

// Claude Code's `language` setting names a language in words (`German`, `Deutsch`) or by its code
// (`de`); LC_ALL, LC_MESSAGES and LANG carry a locale (`de_DE.UTF-8`).
const GERMAN = /^(de$|de[_-]|german|deutsch)/i

/** German when the first of `values` that is set names it, else English. */
export const languageOf = (values: readonly unknown[]): Lang => {
  const first = values.find((value): value is string => typeof value === 'string' && value.trim() !== '')

  return first !== undefined && GERMAN.test(first.trim()) ? 'de' : 'en'
}

/**
 * The language of this session's texts: Claude Code's `language` setting, else LC_ALL, LC_MESSAGES
 * or LANG, else English. Not the system's: on macOS the runtime reports en-US whatever the system
 * is set to. A read that fails counts as unset.
 */
async function detect($: EngineInterface): Promise<Lang> {
  const setting = await $.config.list().then(
    rows => rows.find(row => row.key === 'language')?.value,
    () => undefined,
  )
  // Each name written out: the hooks loader lists the variables a module reads.
  const locales = await Promise.all([
    $.env.get('LC_ALL').catch(() => undefined),
    $.env.get('LC_MESSAGES').catch(() => undefined),
    $.env.get('LANG').catch(() => undefined),
  ])

  return languageOf([setting, ...locales])
}

// The language read for this load of the module; read again at each session start.
let language: Promise<Lang> | undefined

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those.

/** Reads the language afresh, at a session start. */
export function learnLanguage($: EngineInterface): Promise<Lang> {
  language = detect($)

  return language
}

/** The language as last read, read now when this load of the module has not yet. */
export function languageFor($: EngineInterface): Promise<Lang> {
  return language ?? learnLanguage($)
}

const EN = {
  title: 'Keep warm',
  summary: 'Keeps the prompt cache warm, so the next reply after a pause stays fast and cheap.',
  details:
    'Without activity the cache expires after 5 minutes or an hour, and the next request has to ' +
    'write the whole context again, which costs. Keep warm sends a small ping shortly before, for ' +
    '4 hours by default. Above the prompt you see how long the cache stays warm. /keepwarm 90m, ' +
    '2h30m or a number of hours sets the span; always keeps every chat warm until 6 hours after ' +
    'its last turn; off turns it off. If a ping finds the cache already lost, keep warm turns ' +
    'itself off. This card shows the pings and rewrites with their cost. After a restart it ' +
    'resumes with the next turn.',
  command: "Keep this session's prompt cache warm (default 4 hours), or /keepwarm off",
  // `11:10pm`
  clock: (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`,
  started: (until: string) => `Keeping this cache warm until ${until}. A ping reads the cache before it expires.`,
  startedAlways: (span: string) => `Keeping every chat warm until ${span} after its last turn. /keepwarm off stops it.`,
  stopped: (why: string, pings: number, cost: string) => `Keep warm off (${why}). ${pings} ping(s), ${cost}.`,
  badSpan: (arg: string) => `/keepwarm takes a span (90m, 2h30m, 6h, up to 24h), always or off; not "${arg}".`,
  why: {
    limit: 'time limit reached',
    expired: 'the cache expired before the ping',
    busy: 'the API stayed busy, so the cache may go cold',
    unanswered: 'the ping got no answer, so the cache may already be cold',
    unread: 'the ping read nothing from the cache',
    wrote: (count: string) => `the ping wrote ${count} tokens instead of reading the cache`,
    modOff: 'the mod is off',
    byHand: 'turned off',
  },
  keep: 'keep warm',
  stop: 'stop',
  pings: (count: number, cost: string) => `${count} ping${count === 1 ? '' : 's'} ${cost}`,
  rewrites: (count: number, cost: string) => `${count} rewrite${count === 1 ? '' : 's'} ${cost}`,
  retry: (count: number, of: number) => `ping retry ${count} of ${of}`,
  waiting: 'waiting for the next turn',
  always: 'always',
  // The band.
  keptWarm: 'kept warm',
  warmShort: 'warm',
  cacheWord: 'cache',
  cold: 'cold',
  rewrite: 'rewrite',
  ringLeft: (left: string) => `cache ${left} left`,
  ringKept: 'cache kept warm',
  ringCold: 'cache cold',
  drops: (left: string) => `cache drops in ${left}`,
  nextRewrites: 'next message rewrites',
  tokensAt: (count: string, cost: string) => `${count} tokens ${cost}`,
  // The card.
  card: {
    cache: 'Cache',
    lifetime: 'Lifetime',
    context: 'Context',
    rewrite: 'Rewrite',
    pings: 'Pings',
    rewrites: 'Rewrites',
    retry: 'Retry',
    ping: 'Ping',
    always: 'Always',
  },
  keptUntil: (until: string) => `kept warm until ${until}`,
  coldFor: (span: string) => `cold for ${span}`,
  left: (span: string) => `${span} left`,
  hour: '1 hour',
  fiveMinutes: '5 minutes',
  assumed: ', assumed',
  tokens: (count: string) => `${count} tokens`,
  of: (count: number, of: number) => `${count} of ${of}`,
  waitsTurn: 'waits for the next turn',
  on: 'on',
  // The mod's own band, without ak-mods.
  ownWarm: (left: string) => `● cache warm ${left}`,
  ownCools: (left: string) => `◐ cache cools in ${left}`,
  ownCold: (span: string) => `○ cache cold ${span}`,
}

const DE: typeof EN = {
  title: 'Warmhalten',
  summary: 'Hält den Prompt-Cache warm, damit die nächste Antwort nach einer Pause schnell und günstig bleibt.',
  details:
    'Ohne Aktivität verfällt der Cache nach 5 Minuten oder einer Stunde, und die nächste Anfrage ' +
    'muss den ganzen Kontext neu schreiben. Das kostet. Warmhalten schickt kurz vorher einen ' +
    'kleinen Ping, standardmäßig 4 Stunden lang. Über der Eingabe siehst du, wie lange der Cache ' +
    'noch warm bleibt. /keepwarm 90m, 2h30m oder eine Stundenzahl wählt die Dauer; always hält ' +
    'jeden Chat bis 6 Stunden nach seiner letzten Antwort warm; off schaltet ab. Findet ein Ping ' +
    'den Cache schon verloren vor, schaltet sich Warmhalten ab. Diese Karte zeigt Pings und ' +
    'Neuschreibungen mit ihren Kosten. Nach einem Neustart läuft es mit der nächsten Antwort ' +
    'weiter.',
  command: 'Den Prompt-Cache dieser Session warm halten (standardmäßig 4 Stunden), oder /keepwarm off',
  // `23:10`
  clock: (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  started: (until: string) => `Halte diesen Cache bis ${until} warm. Ein Ping liest den Cache, bevor er abläuft.`,
  startedAlways: (span: string) => `Halte jeden Chat bis ${span} nach seiner letzten Antwort warm. /keepwarm off beendet es.`,
  stopped: (why: string, pings: number, cost: string) => `Warmhalten aus (${why}). ${pings} Ping(s), ${cost}.`,
  badSpan: (arg: string) => `/keepwarm nimmt eine Dauer (90m, 2h30m, 6h, bis 24h), always oder off; nicht "${arg}".`,
  why: {
    limit: 'Zeitlimit erreicht',
    expired: 'der Cache lief vor dem Ping ab',
    busy: 'die API blieb überlastet, der Cache kann kalt werden',
    unanswered: 'der Ping bekam keine Antwort, der Cache ist vielleicht schon kalt',
    unread: 'der Ping las nichts aus dem Cache',
    wrote: (count: string) => `der Ping schrieb ${count} Tokens, statt den Cache zu lesen`,
    modOff: 'der Mod ist aus',
    byHand: 'ausgeschaltet',
  },
  keep: 'warm halten',
  stop: 'stopp',
  pings: (count: number, cost: string) => `${count} Ping${count === 1 ? '' : 's'} ${cost}`,
  rewrites: (count: number, cost: string) => `${count}× neu geschrieben ${cost}`,
  retry: (count: number, of: number) => `Ping-Wiederholung ${count} von ${of}`,
  waiting: 'wartet auf die nächste Antwort',
  always: 'immer',
  keptWarm: 'warm gehalten',
  warmShort: 'warm',
  cacheWord: 'Cache',
  cold: 'kalt',
  rewrite: 'Neuschreiben',
  ringLeft: (left: string) => `Cache noch ${left}`,
  ringKept: 'Cache warm gehalten',
  ringCold: 'Cache kalt',
  drops: (left: string) => `Cache läuft in ${left} ab`,
  nextRewrites: 'nächste Nachricht schreibt neu:',
  tokensAt: (count: string, cost: string) => `${count} Tokens ${cost}`,
  card: {
    cache: 'Cache',
    lifetime: 'Lebensdauer',
    context: 'Kontext',
    rewrite: 'Neuschreiben',
    pings: 'Pings',
    rewrites: 'Neu geschrieben',
    retry: 'Wiederholung',
    ping: 'Ping',
    always: 'Immer',
  },
  keptUntil: (until: string) => `warm bis ${until}`,
  coldFor: (span: string) => `seit ${span} kalt`,
  left: (span: string) => `noch ${span}`,
  hour: '1 Stunde',
  fiveMinutes: '5 Minuten',
  assumed: ', angenommen',
  tokens: (count: string) => `${count} Tokens`,
  of: (count: number, of: number) => `${count} von ${of}`,
  waitsTurn: 'wartet auf die nächste Antwort',
  on: 'an',
  ownWarm: (left: string) => `● Cache warm ${left}`,
  ownCools: (left: string) => `◐ Cache kühlt in ${left} ab`,
  ownCold: (span: string) => `○ Cache kalt ${span}`,
}

/** The texts of ak-keepwarm in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
