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
  title: 'Todo',
  summary: 'Tasks and notes for this session that you and Claude both keep.',
  details:
    'Add with /todo <text> or /note <text>, from the pane, or from text selected in the chat, also ' +
    'while Claude works. Claude reads the list every turn, may add and change entries, removes only ' +
    'its own, and asks before it works on a task. The list comes back when you reopen the session.',
}

const DE: typeof EN = {
  title: 'Todo',
  summary: 'Aufgaben und Notizen für diese Session, die du und Claude gemeinsam führen.',
  details:
    'Hinzufügen mit /todo <Text> oder /note <Text>, im Pane oder aus markiertem Chat-Text, auch ' +
    'während Claude arbeitet. Claude liest die Liste in jeder Runde, darf Einträge anlegen und ändern, ' +
    'löscht nur eigene und fragt, bevor es eine Aufgabe angeht. Die Liste kommt beim Wiederöffnen der ' +
    'Session zurück.',
}

/** The texts of ak-todo in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
