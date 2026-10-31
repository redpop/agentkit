import type { EngineInterface } from 'claude-code'

import type { ProviderName } from './model'

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

// The CLI each host is read through, as the texts name it.
const CLI: Record<ProviderName, string> = { gitlab: 'glab', github: 'gh' }

// How each host names the checks of a change, in either language.
const CHECKS: Record<ProviderName, string> = { gitlab: 'Pipeline', github: 'Checks' }

const EN = {
  title: 'CI',
  summary: "Shows how far the pipeline or the checks of your current branch's merge or pull request are.",
  details:
    'Above the prompt you see where the pipeline (GitLab) or the checks (GitHub) stand: none yet, ' +
    'running (with a progress ring, the time so far and an estimate from earlier green runs), ' +
    'failed (with the first failed job) or green (with the duration). A toast says when they are ' +
    'done. On GitHub a branch without a pull request shows the checks of its pushed tip. "open" ' +
    'opens the merge or pull request; "Copy link" in the card\'s menu copies its address. After a ' +
    'failure, "Get errors" puts an excerpt of the job\'s log in the prompt box, so Claude can look ' +
    'into it. Requires glab or gh, installed and logged in.',
  open: 'open',
  copyLink: 'Copy link',
  errors: 'Get errors',
  noChecks: { gitlab: 'no pipeline', github: 'no checks' } as Record<ProviderName, string>,
  canceled: 'canceled',
  of: (estimate: string) => `of ~${estimate} min`,
  checks: CHECKS,
  card: {
    change: 'Change',
    target: 'Target',
    draft: 'Draft',
    groups: { gitlab: 'Stages', github: 'Workflows' } as Record<ProviderName, string>,
    failed: 'Failed',
    started: 'Started',
    duration: 'Duration',
  },
  yes: 'yes',
  no: 'no',
  // `11:10pm`
  time: (h: number, m: number) => `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`,
  // A branch tip's checks are on the branch: `Checks on main`; a change's are its own: `Checks #12`.
  green: (provider: ProviderName, ref: string, isTip: boolean, duration: string) =>
    `${CHECKS[provider]} ${isTip ? `on ${ref}` : ref} green (${duration})`,
  failed: (provider: ProviderName, ref: string, isTip: boolean, job: string) =>
    `${CHECKS[provider]} ${isTip ? `on ${ref}` : ref} failed: ${job}`,
  waits: (provider: ProviderName, ref: string, isTip: boolean, job: string) =>
    `${CHECKS[provider]} ${isTip ? `on ${ref}` : ref} ${provider === 'github' ? 'wait' : 'waits'} for ${job}`,
  noAuth: (provider: ProviderName) => `${CLI[provider]} not logged in`,
  // The host may not be known yet when there is nothing to show.
  noChange: (provider: ProviderName | undefined): string =>
    provider === 'gitlab'
      ? 'No open merge request for this branch'
      : provider === 'github'
        ? 'No open pull request and no checks for this branch'
        : 'No open merge request or pull request for this branch',
  copied: 'Link copied',
  notCopied: (url: string, reason: string) => `${url} (not copied: ${reason})`,
  noBox: 'Prompt box not available, excerpt not inserted',
  noLog: 'Job log not readable',
  noLogFor: (name: string) => `${name} has no log to read`,
  cut: 'The log is longer than 4 MiB; its end is missing from the excerpt.',
  draft: (provider: ProviderName, ref: string, isTip: boolean, job: string, group: string) =>
    provider === 'gitlab'
      ? `The pipeline of ${ref} failed in job ${job} (stage ${group}). Excerpt from the log:`
      : `The checks ${isTip ? 'on' : 'of'} ${ref} failed in job ${job} (workflow ${group}). Excerpt from the log:`,
}

const DE: typeof EN = {
  title: 'CI',
  summary: 'Zeigt, wie weit die Pipeline oder die Checks zum Merge Request oder Pull Request deines aktuellen Branches sind.',
  details:
    'Über der Eingabe siehst du den Stand der Pipeline (GitLab) oder der Checks (GitHub): noch ' +
    'keine, läuft (mit Fortschrittsring, bisheriger Zeit und einer Schätzung aus früheren grünen ' +
    'Läufen), fehlgeschlagen (mit dem ersten roten Job) oder grün (mit Dauer). Sind sie fertig, ' +
    'meldet das ein Toast. Auf GitHub zeigt ein Branch ohne Pull Request die Checks seines ' +
    'gepushten Stands. „öffnen“ öffnet den Merge Request oder Pull Request; „Link kopieren“ im ' +
    'Menü der Karte kopiert seine Adresse. Nach einem Fehler legt „Fehler holen“ einen Auszug aus ' +
    'dem Job-Log ins Eingabefeld, damit Claude ihn auswerten kann. Voraussetzung: glab oder gh ist ' +
    'installiert und angemeldet.',
  open: 'öffnen',
  copyLink: 'Link kopieren',
  errors: 'Fehler holen',
  noChecks: { gitlab: 'keine Pipeline', github: 'keine Checks' },
  canceled: 'abgebrochen',
  of: (estimate: string) => `von ~${estimate} min`,
  checks: CHECKS,
  card: {
    change: 'Änderung',
    target: 'Ziel',
    draft: 'Draft',
    groups: { gitlab: 'Stages', github: 'Workflows' },
    failed: 'Fehlgeschlagen',
    started: 'Gestartet',
    duration: 'Dauer',
  },
  yes: 'ja',
  no: 'nein',
  // `23:10`
  time: (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  // The checks are plural, the pipeline singular: `Checks #12 warten`, `Pipeline !12 wartet`.
  green: (provider, ref, isTip, duration) => `${CHECKS[provider]} ${isTip ? `auf ${ref}` : ref} grün (${duration})`,
  failed: (provider, ref, isTip, job) => `${CHECKS[provider]} ${isTip ? `auf ${ref}` : ref} fehlgeschlagen: ${job}`,
  waits: (provider, ref, isTip, job) =>
    `${CHECKS[provider]} ${isTip ? `auf ${ref}` : ref} ${provider === 'github' ? 'warten' : 'wartet'} auf ${job}`,
  noAuth: (provider: ProviderName) => `${CLI[provider]} nicht angemeldet`,
  noChange: provider =>
    provider === 'gitlab'
      ? 'Kein offener Merge Request für diesen Branch'
      : provider === 'github'
        ? 'Kein offener Pull Request und keine Checks für diesen Branch'
        : 'Kein offener Merge Request oder Pull Request für diesen Branch',
  copied: 'Link kopiert',
  notCopied: (url, reason) => `${url} (nicht kopiert: ${reason})`,
  noBox: 'Eingabefeld nicht verfügbar, Auszug nicht eingefügt',
  noLog: 'Job-Log nicht lesbar',
  noLogFor: (name: string) => `${name} hat kein Log zum Lesen`,
  cut: 'Das Log ist länger als 4 MiB; sein Ende fehlt im Auszug.',
  draft: (provider, ref, isTip, job, group) =>
    provider === 'gitlab'
      ? `Die Pipeline von ${ref} ist im Job ${job} (Stage ${group}) fehlgeschlagen. Auszug aus dem Log:`
      : `Die Checks ${isTip ? 'auf' : 'von'} ${ref} sind im Job ${job} (Workflow ${group}) fehlgeschlagen. Auszug aus dem Log:`,
}

/** The texts of ak-ci in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)
