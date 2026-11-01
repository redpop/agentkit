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
    'its own, and asks before it works on a task. The list comes back when you reopen the session. ' +
    'Detect open items: after each of Claude\'s answers a small model adds what the answer set aside or ' +
    'left open as Claude\'s tasks; off by default, the model below.',
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
  emptySegment: 'No entries yet',
  openWord: 'open',
  laterWord: 'later',
  doneWord: 'done',
  noteWord: (n: number): string => (n === 1 ? 'note' : 'notes'),
  show: 'Todo',
  nothingSelected: 'Nothing selected.',
  storeFull: 'List is full: nothing saved.',
  emptyList: 'The list is empty. Add with /todo <text> or /note <text>.',
  trashEmpty: 'The trash is empty.',
  trashHeader: 'Trash (restore with /todo restore <n>):',
  detectOn: 'Detection on: open items in answers become tasks.',
  detectOff: 'Detection off.',
  modelSet: (alias: string) => `Detection uses ${alias}.`,
  models: 'Detection models: haiku, sonnet.',
  detectSetting: 'Detect open items',
  modelSetting: 'Detection model',
  on: 'on',
  off: 'off',
  asked: (ref: string) => `Sent with ${ref}.`,
  isOff: 'ak-todo is off in this chat. Turn it on with /ak-mods or /todo.',
  tasks: 'Tasks',
  notesHeader: 'Notes',
  doneFold: (n: number) => `Done (${n})`,
  laterFold: (n: number) => `Later (${n})`,
  trashFold: (n: number) => `Trash (${n})`,
  doNow: 'Do now',
  discuss: 'Discuss',
  laterLabel: 'Later',
  backLabel: 'Back',
  edit: 'Edit',
  remove: 'Delete',
  restore: 'Restore',
  emptyTrash: 'Empty trash',
  takeSelection: 'From selection',
  kindTask: 'Task',
  kindNote: 'Note',
  taskPlaceholder: 'A task for later…',
  notePlaceholder: 'Something Claude should keep in mind…',
  add: 'Add',
  save: 'Save',
  nothingYet: 'Nothing yet. What comes up on the side goes here, and Claude reads it.',
  workOn: (ref: string, text: string) => `Work on ${ref} now: ${text}`,
  draft: (ref: string, text: string) => `About item ${ref} (${text}): `,
}

const DE: typeof EN = {
  title: 'Todo',
  summary: 'Aufgaben und Notizen für diese Session, die du und Claude gemeinsam führen.',
  details:
    'Hinzufügen mit /todo <Text> oder /note <Text>, im Pane oder aus markiertem Chat-Text, auch ' +
    'während Claude arbeitet. Claude liest die Liste in jeder Runde, darf Einträge anlegen und ändern, ' +
    'löscht nur eigene und fragt, bevor es eine Aufgabe angeht. Die Liste kommt beim Wiederöffnen der ' +
    'Session zurück. Offene Punkte erkennen: Nach jeder Antwort von Claude trägt ein kleines Modell ' +
    'als Claudes Aufgaben ein, was die Antwort aufgeschoben oder offen gelassen hat; standardmäßig aus, ' +
    'das Modell darunter.',
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
  emptySegment: 'Noch keine Einträge',
  openWord: 'offen',
  laterWord: 'später',
  doneWord: 'erledigt',
  noteWord: (n: number) => (n === 1 ? 'Notiz' : 'Notizen'),
  show: 'Todo',
  nothingSelected: 'Nichts markiert.',
  storeFull: 'Liste voll: nichts gespeichert.',
  emptyList: 'Die Liste ist leer. Hinzufügen mit /todo <Text> oder /note <Text>.',
  trashEmpty: 'Der Papierkorb ist leer.',
  trashHeader: 'Papierkorb (zurückholen mit /todo restore <n>):',
  detectOn: 'Erkennung an: offene Punkte in Antworten werden Aufgaben.',
  detectOff: 'Erkennung aus.',
  modelSet: (alias: string) => `Die Erkennung nutzt ${alias}.`,
  models: 'Modelle der Erkennung: haiku, sonnet.',
  detectSetting: 'Offene Punkte erkennen',
  modelSetting: 'Modell der Erkennung',
  on: 'an',
  off: 'aus',
  asked: (ref: string) => `Mit ${ref} gesendet.`,
  isOff: 'ak-todo ist in diesem Chat aus. Einschalten mit /ak-mods oder /todo.',
  tasks: 'Aufgaben',
  notesHeader: 'Notizen',
  doneFold: (n: number) => `Erledigt (${n})`,
  laterFold: (n: number) => `Später (${n})`,
  trashFold: (n: number) => `Papierkorb (${n})`,
  doNow: 'Jetzt machen',
  discuss: 'Besprechen',
  laterLabel: 'Später',
  backLabel: 'Zurück',
  edit: 'Bearbeiten',
  remove: 'Löschen',
  restore: 'Zurückholen',
  emptyTrash: 'Papierkorb leeren',
  takeSelection: 'Aus Markierung',
  kindTask: 'Aufgabe',
  kindNote: 'Notiz',
  taskPlaceholder: 'Eine Aufgabe für später …',
  notePlaceholder: 'Etwas, das Claude im Kopf behalten soll …',
  add: 'Hinzufügen',
  save: 'Speichern',
  nothingYet: 'Noch nichts. Was nebenbei aufkommt, landet hier, und Claude liest es.',
  workOn: (ref: string, text: string) => `Arbeite jetzt an ${ref}: ${text}`,
  draft: (ref: string, text: string) => `Zu Punkt ${ref} (${text}): `,
}

/** The texts of ak-todo in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
