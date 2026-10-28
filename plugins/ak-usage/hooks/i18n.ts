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
  summary: "Shows how full this session's context is and how much of the 5-hour limit is used.",
  details:
    'Its segment in the shared band above the prompt shows a bar of five cells a figure: the ' +
    'context of this session, and the 5-hour window of the account, every session counted. ' +
    'The 7-day window joins from 75 %. A figure from 75 % adds its percentage and turns the ' +
    'warning colour, from 90 % the error colour; a window then adds when it resets, and a ' +
    'toast says so once. Here every percentage and reset follows the bars. The windows are ' +
    'as the last response of this session reported them, and leave the band once they reset.',
  context: 'Context',
  windows: { five_hour: '5-hour limit', seven_day: '7-day limit' } as Record<string, string>,
  days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  // `11:10pm`
  time: (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`,
  resets: (when: string) => `resets ${when}`,
  alert: (title: string, percent: number, reset: string) => `${title} at ${percent} %${reset ? `, ${reset}` : ''}`,
}

const DE: typeof EN = {
  title: 'Nutzung',
  summary: 'Zeigt, wie voll der Kontext dieser Session ist und wie viel vom 5-Stunden-Limit verbraucht ist.',
  details:
    'Sein Segment im gemeinsamen Band über der Eingabe zeigt je Wert einen Balken aus fünf Zellen: ' +
    'den Kontext dieser Session und das 5-Stunden-Fenster des Kontos, alle Sessions zusammen. ' +
    'Das 7-Tage-Fenster kommt ab 75 % dazu. Ab 75 % zeigt ein Wert seine Prozentzahl in der ' +
    'Warnfarbe, ab 90 % in der Fehlerfarbe; ein Fenster nennt dann seinen Reset, und ein Toast ' +
    'meldet es einmal. Hier folgen jede Prozentzahl und jeder Reset den Balken. Die Fenster ' +
    'stehen so, wie die letzte Antwort dieser Session sie gemeldet hat, und verlassen das Band ' +
    'nach ihrem Reset.',
  context: 'Kontext',
  windows: { five_hour: '5-Stunden-Limit', seven_day: '7-Tage-Limit' },
  days: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  // `23:10`
  time: (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  resets: (when: string) => `Reset ${when}`,
  alert: (title: string, percent: number, reset: string) => `${title} bei ${percent} %${reset ? `, ${reset}` : ''}`,
}

/** The texts of ak-usage in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
