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
  title: 'GitLab',
  summary: "Shows how far the pipeline of your current branch's merge request is.",
  details:
    'Above the prompt you see where the pipeline stands: none yet, running (with a progress ring, ' +
    'the time so far and an estimate from earlier green runs), failed (with the first failed job) ' +
    'or green (with its duration). A toast says when it is done. "open" opens the merge request. ' +
    'After a failure, "Get errors" puts an excerpt of the job\'s log in the prompt box, so Claude ' +
    'can look into it. Requires glab, installed and logged in.',
  open: 'open',
  errors: 'Get errors',
  noPipeline: 'no pipeline',
  canceled: 'canceled',
  of: (estimate: string) => `of ~${estimate} min`,
  card: {
    mr: 'MR',
    target: 'Target',
    draft: 'Draft',
    pipeline: 'Pipeline',
    stages: 'Stages',
    failed: 'Failed',
    started: 'Started',
    duration: 'Duration',
  },
  yes: 'yes',
  no: 'no',
  // `11:10pm`
  time: (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`,
  green: (iid: number, duration: string) => `Pipeline !${iid} green (${duration})`,
  failed: (iid: number, job: string) => `Pipeline !${iid} failed: ${job}`,
  waits: (iid: number, job: string) => `Pipeline !${iid} waits for ${job}`,
  noAuth: 'glab not logged in',
  noMr: 'No open merge request for this branch',
  noBox: 'Prompt box not available, excerpt not inserted',
  noLog: 'Job log not readable',
  cut: 'The log is longer than 4 MiB; its end is missing from the excerpt.',
  draft: (iid: number, job: string, stage: string) =>
    `The pipeline of !${iid} failed in job ${job} (stage ${stage}). Excerpt from the log:`,
}

const DE: typeof EN = {
  title: 'GitLab',
  summary: 'Zeigt, wie weit die Pipeline zum Merge Request deines aktuellen Branches ist.',
  details:
    'Über der Eingabe siehst du den Stand der Pipeline: noch keine, läuft (mit Fortschrittsring, ' +
    'bisheriger Zeit und einer Schätzung aus früheren grünen Läufen), fehlgeschlagen (mit dem ' +
    'ersten roten Job) oder grün (mit Dauer). Ist sie fertig, meldet das ein Toast. „öffnen“ ' +
    'öffnet den Merge Request. Nach einem Fehler legt „Fehler holen“ einen Auszug aus dem Job-Log ' +
    'ins Eingabefeld, damit Claude ihn auswerten kann. Voraussetzung: glab ist installiert und ' +
    'angemeldet.',
  open: 'öffnen',
  errors: 'Fehler holen',
  noPipeline: 'keine Pipeline',
  canceled: 'abgebrochen',
  of: (estimate: string) => `von ~${estimate} min`,
  card: {
    mr: 'MR',
    target: 'Ziel',
    draft: 'Draft',
    pipeline: 'Pipeline',
    stages: 'Stages',
    failed: 'Fehlgeschlagen',
    started: 'Gestartet',
    duration: 'Dauer',
  },
  yes: 'ja',
  no: 'nein',
  // `23:10`
  time: (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  green: (iid: number, duration: string) => `Pipeline !${iid} grün (${duration})`,
  failed: (iid: number, job: string) => `Pipeline !${iid} fehlgeschlagen: ${job}`,
  waits: (iid: number, job: string) => `Pipeline !${iid} wartet auf ${job}`,
  noAuth: 'glab nicht angemeldet',
  noMr: 'Kein offener Merge Request für diesen Branch',
  noBox: 'Eingabefeld nicht verfügbar, Auszug nicht eingefügt',
  noLog: 'Job-Log nicht lesbar',
  cut: 'Das Log ist länger als 4 MiB; sein Ende fehlt im Auszug.',
  draft: (iid: number, job: string, stage: string) =>
    `Die Pipeline von !${iid} ist im Job ${job} (Stage ${stage}) fehlgeschlagen. Auszug aus dem Log:`,
}

/** The texts of ak-gitlab in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
