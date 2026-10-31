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
  title: 'Session id',
  summary: "Copies this session's id, so you can name it to another session.",
  details:
    'Above the prompt you see the end of the id. "copy" (key c) or /session-id puts the whole id ' +
    'on the clipboard. In the desktop app that is the local_… id sessions use to message each ' +
    'other, elsewhere the engine id; /session-id engine copies the engine id even in the app.',
  command: "Copy this session's id, or /session-id engine for the engine's",
  usage: 'Usage: /session-id [engine]',
  copy: 'copy',
  copiedShort: 'copied',
  desktopId: 'Desktop id',
  engineId: 'Engine id',
  copied: (id: string) => `Copied session id ${id}`,
  notCopied: (id: string, reason: string) => `Session id ${id} (not copied: ${reason})`,
}

const DE: typeof EN = {
  title: 'Session-ID',
  summary: 'Kopiert die ID dieser Session, damit du sie einer anderen Session nennen kannst.',
  details:
    'Über der Eingabe steht das Ende der ID. „kopieren“ (Taste c) oder /session-id legt die ganze ' +
    'ID in die Zwischenablage. In der Desktop-App ist das die local_…-ID, mit der sich Sessions ' +
    'gegenseitig Nachrichten schicken, sonst die Engine-ID; /session-id engine kopiert auch in ' +
    'der App die Engine-ID.',
  command: 'Die ID dieser Session kopieren, oder /session-id engine für die der Engine',
  usage: 'Aufruf: /session-id [engine]',
  copy: 'kopieren',
  copiedShort: 'kopiert',
  desktopId: 'Desktop-ID',
  engineId: 'Engine-ID',
  copied: (id: string) => `Session-ID ${id} kopiert`,
  notCopied: (id: string, reason: string) => `Session-ID ${id} (nicht kopiert: ${reason})`,
}

/** The texts of ak-session-id in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
