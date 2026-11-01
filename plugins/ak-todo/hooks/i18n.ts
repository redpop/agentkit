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
  added: (ref: string, text: string) => `Added: ${ref} ${text}`,
  done: (ref: string, text: string) => `Done: ${ref} ${text}`,
  undone: (ref: string, text: string) => `Open again: ${ref} ${text}`,
  removedEntry: (ref: string, text: string) => `Removed: ${ref} ${text}`,
  later: (ref: string, text: string) => `Later: ${ref} ${text}`,
  back: (ref: string, text: string) => `Back: ${ref} ${text}`,
  moved: (ref: string, text: string) => `Moved: ${ref} ${text}`,
  edited: (ref: string, text: string) => `Changed: ${ref} ${text}`,
  restored: (ref: string, text: string) => `Restored: ${ref} ${text}`,
  cleared: (n: number) => (n === 0 ? 'No done tasks to clear.' : `Moved ${n} done to the trash.`),
  notFound: (ref: string) => `No entry ${ref}.`,
  notInTrash: (n: number) => `No entry ${n} in the trash.`,
  empty: 'Nothing to add: the text is empty.',
  full: 'The list is full (100 entries). Remove some first.',
  notATask: (ref: string) => `${ref} is a note, not a task.`,
  open: (n: number) => `${n} open`,
  notes: (n: number) => (n === 1 ? '1 note' : `${n} notes`),
  allDone: 'all done',
  show: 'Todo',
  nothingSelected: 'Nothing selected.',
  storeFull: 'List is full: nothing saved.',
  emptyList: 'The list is empty. Add with /todo <text> or /note <text>.',
  trashEmpty: 'The trash is empty.',
  trashHeader: 'Trash (restore with /todo restore <n>):',
  detectOn: 'Detection on: open items in answers become tasks.',
  detectOff: 'Detection off.',
  asked: (ref: string) => `Sent with ${ref}.`,
  isOff: 'ak-todo is off in this chat. Turn it on with /ak-mods or /todo.',
}

const DE: typeof EN = {
  title: 'Todo',
  summary: 'Aufgaben und Notizen für diese Session, die du und Claude gemeinsam führen.',
  details:
    'Hinzufügen mit /todo <Text> oder /note <Text>, im Pane oder aus markiertem Chat-Text, auch ' +
    'während Claude arbeitet. Claude liest die Liste in jeder Runde, darf Einträge anlegen und ändern, ' +
    'löscht nur eigene und fragt, bevor es eine Aufgabe angeht. Die Liste kommt beim Wiederöffnen der ' +
    'Session zurück.',
  added: (ref: string, text: string) => `Hinzugefügt: ${ref} ${text}`,
  done: (ref: string, text: string) => `Erledigt: ${ref} ${text}`,
  undone: (ref: string, text: string) => `Wieder offen: ${ref} ${text}`,
  removedEntry: (ref: string, text: string) => `Entfernt: ${ref} ${text}`,
  later: (ref: string, text: string) => `Später: ${ref} ${text}`,
  back: (ref: string, text: string) => `Zurück: ${ref} ${text}`,
  moved: (ref: string, text: string) => `Verschoben: ${ref} ${text}`,
  edited: (ref: string, text: string) => `Geändert: ${ref} ${text}`,
  restored: (ref: string, text: string) => `Wiederhergestellt: ${ref} ${text}`,
  cleared: (n: number) => (n === 0 ? 'Keine erledigten Aufgaben zum Aufräumen.' : `${n} erledigte in den Papierkorb gelegt.`),
  notFound: (ref: string) => `Kein Eintrag ${ref}.`,
  notInTrash: (n: number) => `Kein Eintrag ${n} im Papierkorb.`,
  empty: 'Nichts hinzuzufügen: der Text ist leer.',
  full: 'Die Liste ist voll (100 Einträge). Entferne erst welche.',
  notATask: (ref: string) => `${ref} ist eine Notiz, keine Aufgabe.`,
  open: (n: number) => `${n} offen`,
  notes: (n: number) => (n === 1 ? '1 Notiz' : `${n} Notizen`),
  allDone: 'alles erledigt',
  show: 'Todo',
  nothingSelected: 'Nichts markiert.',
  storeFull: 'Liste voll: nichts gespeichert.',
  emptyList: 'Die Liste ist leer. Hinzufügen mit /todo <Text> oder /note <Text>.',
  trashEmpty: 'Der Papierkorb ist leer.',
  trashHeader: 'Papierkorb (zurückholen mit /todo restore <n>):',
  detectOn: 'Erkennung an: offene Punkte in Antworten werden Aufgaben.',
  detectOff: 'Erkennung aus.',
  asked: (ref: string) => `Mit ${ref} gesendet.`,
  isOff: 'ak-todo ist in diesem Chat aus. Einschalten mit /ak-mods oder /todo.',
}

/** The texts of ak-todo in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
