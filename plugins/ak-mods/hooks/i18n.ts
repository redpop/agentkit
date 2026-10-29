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
  command: 'Open or close the Mods pane: turn AgentKit mods on or off for this chat',
  opened: 'Opened the Mods pane.',
  closed: 'Closed the Mods pane.',
  footer: 'Switches reset in a new chat or after /clear. Standard mods start on.',
  on: '● On',
  off: '○ Off',
  toggle: 'mods',
  dropped: (count: number, titles: string) => `${count} ${count === 1 ? 'mod does' : 'mods do'} not fit the band: ${titles}`,
}

const DE: typeof EN = {
  command: 'Mods-Fenster öffnen oder schließen: AgentKit-Mods für diesen Chat ein- oder ausschalten',
  opened: 'Mods-Fenster geöffnet.',
  closed: 'Mods-Fenster geschlossen.',
  footer: 'Die Schalter gelten pro Chat: ein neuer Chat oder /clear setzt sie zurück. Standard-Mods starten eingeschaltet.',
  on: '● An',
  off: '○ Aus',
  toggle: 'Mods',
  dropped: (count: number, titles: string) => `${count} ${count === 1 ? 'Mod passt' : 'Mods passen'} nicht ins Band: ${titles}`,
}

/** The texts of ak-mods in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
