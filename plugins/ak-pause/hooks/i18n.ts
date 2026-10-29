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
  title: 'Break',
  summary: 'Shows how long you have worked without a break.',
  details:
    'Counts across sessions. 10 minutes without input count as a break. Reminds you to drink and ' +
    'speaks up once an hour at a quiet moment.',
  straight: (duration: string) => `${duration} straight`,
  idle: 'Break',
  water: 'Water',
  late: 'Call it a day?',
  drank: 'Drank',
  toast: (duration: string) => `${duration} straight. A good moment for a break.`,
  notify: (duration: string) => `Claude is still working. ${duration} straight: a good moment for a break.`,
  since: 'Working since',
  lastBreak: 'Last break',
  breaks: 'Breaks today',
  longest: 'Longest block today',
  lastWater: 'Last water',
  // `11:10pm`
  time: (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`,
}

const DE: typeof EN = {
  title: 'Pause',
  summary: 'Zeigt, wie lange du ohne Pause arbeitest.',
  details:
    'Zählt über alle Sessions. 10 Minuten ohne Eingabe gelten als Pause. Erinnert an Wasser und ' +
    'meldet sich einmal pro Stunde in einem ruhigen Moment.',
  straight: (duration: string) => `${duration} am Stück`,
  idle: 'Pause',
  water: 'Wasser',
  late: 'Feierabend?',
  drank: 'Getrunken',
  toast: (duration: string) => `${duration} am Stück. Guter Moment für eine Pause.`,
  notify: (duration: string) => `Claude arbeitet noch. ${duration} am Stück: guter Moment für eine Pause.`,
  since: 'Am Stück seit',
  lastBreak: 'Letzte Pause',
  breaks: 'Pausen heute',
  longest: 'Längster Block heute',
  lastWater: 'Wasser zuletzt',
  // `23:10`
  time: (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
}

/** The texts of ak-pause in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
