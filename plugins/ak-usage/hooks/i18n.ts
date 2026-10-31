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
  title: 'Usage',
  summary: "Shows how full this session's context is and how much of your 5-hour limit is used.",
  details:
    'Above the prompt you see the context of this session and the 5-hour limit of your account, ' +
    'all sessions together; from 75 % the 7-day limit joins them. From 75 % a figure turns the ' +
    'warning colour, from 90 % the error colour; a limit then also shows when it resets, and a ' +
    "toast says so once. The figures come from this session's last response.",
  context: 'Context',
  ofTokens: (used: string, window: string) => `${used} of ${window} tokens`,
  windows: { five_hour: '5-hour limit', seven_day: '7-day limit' } as Record<string, string>,
  days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  // `11:10pm`
  time: (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`,
  resets: (when: string) => `resets ${when}`,
  alert: (title: string, percent: number, reset: string) => `${title} at ${percent} %${reset ? `, ${reset}` : ''}`,
}

const DE: typeof EN = {
  title: 'Nutzung',
  summary: 'Zeigt, wie voll der Kontext dieser Session ist und wie viel deines 5-Stunden-Limits verbraucht ist.',
  details:
    'Über der Eingabe siehst du den Kontext dieser Session und das 5-Stunden-Limit deines Kontos ' +
    'über alle Sessions; ab 75 % kommt das 7-Tage-Limit dazu. Ab 75 % steht ein Wert in der ' +
    'Warnfarbe, ab 90 % in der Fehlerfarbe; ein Limit nennt dann auch, wann es zurückgesetzt ' +
    'wird, und ein Toast meldet es einmal. Die Werte stammen aus der letzten Antwort dieser ' +
    'Session.',
  context: 'Kontext',
  ofTokens: (used: string, window: string) => `${used} von ${window} Tokens`,
  windows: { five_hour: '5-Stunden-Limit', seven_day: '7-Tage-Limit' },
  days: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  // `23:10`
  time: (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  resets: (when: string) => `Reset ${when}`,
  alert: (title: string, percent: number, reset: string) => `${title} bei ${percent} %${reset ? `, ${reset}` : ''}`,
}

/** The texts of ak-usage in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
