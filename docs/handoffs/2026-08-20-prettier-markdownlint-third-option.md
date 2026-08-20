# Session Handoff — Prettier vs. markdownlint: Emphasis-Stil festnageln

**Date**: 2026-08-20
**Branch**: `main` (auf `origin/main` gezogen, `7949bc5 chore: release v1.23.0`)
**Status**: Complete — Analyse und Nachweise fertig; die Integration hier ist die Mission

## Mission for the Next Session

> Die im Projekt skp-modernisierungsratgeber eingesetzte dritte Lösung für den
> Prettier-vs-markdownlint-Konflikt soll dort in das ak-review-Plugin und dessen Doku integriert
> werden.

## Executive Summary

`docs/hooks/ak-review/validation-hooks.md`, Abschnitt „Using Prettier alongside the hook", nennt
zwei Wege aus dem Konflikt zwischen `markdown-format.sh` und Prettier: Hook zum Reporter machen
(`"fix": false`) oder Markdown in `.prettierignore` ausschließen. Beide geben eines der beiden
Werkzeuge auf. Der Abschnitt behauptet zusätzlich, markdownlints Defaults seien Prettier-kompatibel,
weil die Stil-Regeln auf `consistent` stehen.

Diese Session hat das gemessen. Die Aussage gilt **nur für Dateien mit einheitlichem
Emphasis-Stil**. Bei gemischtem Stil normalisiert `consistent` auf das *erste* Vorkommen — steht
dort ein Asterisk, schreibt markdownlint gegen Prettier, und Prettier dreht es beim nächsten Lauf
zurück. Das ist kein Endlos-Loop, aber eine gegenläufige Umformatierung pro Datei, also
Diff-Rauschen ohne Nutzen.

Das Projekt **skp-modernisierungsratgeber** löst das seit dem 2026-07-30 mit einer dritten Variante:
markdownlint wird auf Prettiers Output *geeicht*, statt ihm überlassen zu werden. Beide Werkzeuge
bleiben voll aktiv. Zu tun bleibt die Übernahme hierher — mindestens als dokumentierte dritte
Option, optional als geänderter Plugin-Default.

## Was die dritte Option ist

Eine `.markdownlint.jsonc` im Projekt-Root, die genau die Regeln fixiert, an denen sich die beiden
Werkzeuge widersprechen können:

```jsonc
{
  "MD049": { "style": "underscore" }, // italic: Prettier emits _text_
  "MD050": { "style": "asterisk" }, // bold: Prettier emits **text**

  // Line length is Prettier's concern (proseWrap: preserve), not a lint error.
  "MD013": false
}
```

Der Unterschied zu „Defaults reichen schon": `consistent` richtet sich nach dem Dateiinhalt,
`underscore` nach Prettier. Nur die zweite Variante ist richtungssicher.

## Belege

Alle Messungen mit `markdownlint-cli2 v0.23.2` (`markdownlint v0.41.1`) und Prettier aus dem
skp-modernisierungsratgeber. Ausgangszeile jeweils:
`Erst ein *asterisk-kursiv*, danach ein _underscore-kursiv_.`

**A — Defaults (`consistent`), isoliert ohne Projekt-Config:**

| Schritt | Ergebnis |
| ------- | -------- |
| `markdownlint-cli2 --fix` | `*asterisk-kursiv*, *underscore-kursiv*` — „Attempted: 2 fixes", auf **asterisk** |
| `prettier --write` | `_asterisk-kursiv_, _underscore-kursiv_` — dreht beides zurück |
| `markdownlint-cli2 --fix` | unverändert, konvergiert |

**B — dieselbe Datei mit `MD049: underscore`:**

| Schritt | Ergebnis |
| ------- | -------- |
| `markdownlint-cli2 --fix` | `_asterisk-kursiv_, _underscore-kursiv_` — sofort in Prettiers Richtung |
| `prettier --write` | unverändert, nichts zu tun |

**C — der Hook nimmt die Projekt-Config wirklich.** Im skp-modernisierungsratgeber wurde eine per
`Write` erzeugte Datei mit `*kursiver*` vom `PostToolUse`-Hook zu `_kursiver_` umgeschrieben, also
nach `MD049: underscore` aus dem Projekt und nicht nach `asterisk` aus der Plugin-Config. Trailing
Whitespace (`MD009`) und doppelte Leerzeilen (`MD012`) wurden im selben Durchgang gefixt. Grund:
`plugins/ak-review/hooks/markdown-format.sh` ab Zeile 37 sucht zuerst eine Projekt-Config im
Verzeichnisbaum und setzt `--config` nur, wenn keine existiert. Die dritte Option arbeitet also
**mit** dem Hook, nicht gegen ihn.

**D — Bestandsprüfung.** `AGENTS.md`, `README.md`, `tests/README.md` und `docs/**/*.md` im
skp-modernisierungsratgeber laufen mit 0 Issues durch, bei gleichzeitig aktivem Prettier über
`npm run check`. Die beiden Werkzeuge streiten sich dort nachweislich nicht.

## Was hier zu tun ist

**1. Doku umstellen (empfohlen, risikofrei).** Die dritte Option wird die **primäre Empfehlung**
des Abschnitts, die beiden bestehenden werden Alternativen für die Fälle, in denen sie tatsächlich
besser sind. Begründung der Rangfolge, die auch so in den Text gehört:

- **Empfehlung — Regeln eichen**, wenn Prettier im Projekt Markdown formatiert (der übliche Fall,
  sobald Prettier über einen npm-Script läuft): beide Werkzeuge behalten ihre volle Rolle, der Hook
  darf weiter `--fix` machen, und die Richtung ist deterministisch statt inhaltsabhängig (Beleg B).
- **Alternative A — `"fix": false`**, wenn man den Hook bewusst nur als Reporter will. Kostet den
  Auto-Fix für *alle* Regeln, nicht nur für die zwei strittigen.
- **Alternative B — `*.md` in `.prettierignore`**, wenn Prettier im Projekt nur für JS und CSS da
  ist. Dann ist der Hook zu Recht der Markdown-Formatter. Hat ein Projekt Prettier auch für
  Markdown, verliert es damit Tabellen-Ausrichtung und einheitliches `proseWrap`.

Dazu die `consistent`-Aussage präzisieren: sie hält nur für Dateien mit einheitlichem
Emphasis-Stil. Bei gemischtem Stil normalisiert `consistent` auf das erste Vorkommen und schreibt
damit womöglich gegen Prettier (Beleg A) — genau das, was die Eich-Variante ausschließt. Und der
Hinweis auf die Config-Priorisierung in `markdown-format.sh` gehört dazu, weil er erklärt, warum
eine Projekt-Config überhaupt gewinnt.

**2. Plugin-Default (bewusst entscheiden).** `MD049` in
`plugins/ak-review/hooks/config/.markdownlint-cli2.jsonc` von `asterisk` auf `underscore`
umstellen. Das entschärft den Konflikt für alle Projekte, die Prettier nutzen und keine eigene
Config haben — genau der Fall, in dem der Hook heute gegen Prettier schreibt.
**Gegenargument:** für Projekte ohne Prettier ist `asterisk` genauso gültig, und die Umstellung
formatiert deren Markdown beim nächsten Hook-Lauf um. Verhaltensändernd, also im `CHANGELOG.md`
als solches benennen.

**Nicht anfassen:** `plugins/ak-review/hooks/markdown-format.sh`. Die Priorisierung dort ist die
Voraussetzung dafür, dass die dritte Option überhaupt greift.

## Current State

### Git

- **AgentKit**: `main` == `origin/main` (`7949bc5`, v1.23.0) — der Pull ist erledigt, die 48
  Commits sind drin. Nur `docs/handoffs/` ist untracked (dieses Dokument). Der Abschnitt in
  `validation-hooks.md` **wurde** gegenüber dem vorherigen lokalen Stand verfeinert; die Fassung,
  auf die sich dieses Handoff bezieht, ist die aktuelle.
- **skp-modernisierungsratgeber**: Branch `SKP-2807-document-manual-staging-check`. Die drei
  Config-Dateien liegen dort auf `main`, sind also nicht Teil eines offenen Branches.

### Referenzdateien zum Abschauen

In `/Users/ry100/Workspace/Projects/skp-modernisierungsratgeber`:

- `.markdownlint.jsonc` — die dritte Option selbst, mit der Begründung im Kommentar.
- `.markdownlint-cli2.jsonc` — nur `ignores`, bewusst **ohne** `config`-Block, damit
  `.markdownlint.jsonc` greift. Erklärt auch, dass cli2 `.markdownlintignore` nicht liest.
- `.markdownlintignore` — nur noch für cli2-v1 und die VS-Code-Extension.

## Decisions & Assumptions

- **Decision**: Die dritte Option wird die primäre Empfehlung, die beiden bestehenden werden
  Alternativen — auf Wunsch des Auftraggebers und weil sie im Standardfall (Prettier formatiert
  Markdown) messbar besser ist. **Gelöscht wird keine davon:** Alternative B ist für Projekte
  richtig, in denen Prettier kein Markdown anfasst, und die Rangfolge muss diese Bedingung
  mitsagen, sonst empfiehlt der Abschnitt Unsinn für genau diese Projekte.
- **Decision**: `markdown-format.sh` bleibt unangetastet.
- **Befund, nicht Annahme**: Das AgentKit-Repo selbst hat **keine** `.markdownlint*`-Datei im Root.
  Es dogfoodet also keine der drei Optionen. Für die Doku-Änderung irrelevant, als Anschlussfrage
  aber naheliegend — zumal `README.md` 76 Zeilen über 80 Zeichen hat und damit gegen den
  `MD013`-Default verstößt (auch dieses Handoff tut das, wie der Bestand).
- **Assumption**: `markdownlint-cli2` merged Baum-Configs auch bei explizitem `--config`.
  Beobachtet — ein Aufruf mit der Plugin-Config auf eine Datei im skp-modernisierungsratgeber
  meldete 0 Issues und zeigte weiter die `ignores` des Projekts. **Nicht** in der cli2-Doku
  verifiziert; vor einer Doku-Aussage darüber belegen.
- **Assumption**: Prettier emittiert `_italic_` und `**bold**`. Für die hier eingesetzte Version
  gemessen (Beleg A und B); falls die Doku es allgemein behauptet, gegen die Prettier-Doku
  abgleichen.

## Suggested Next Steps

1. `docs/hooks/ak-review/validation-hooks.md` öffnen, Abschnitt „Using Prettier alongside the hook".
2. Abschnitt umstellen: Eich-Variante als Empfehlung voran, die zwei bestehenden als Alternativen
   mit ihrer jeweiligen Bedingung darunter. Dabei die `consistent`-Aussage um den Fall „gemischter
   Emphasis-Stil" präzisieren (Beleg A liefert die Zahlen: „Attempted: 2 fixes", Richtung
   asterisk).
3. Entscheiden, ob der Plugin-Default `MD049` mitgeht — mit dem Vorbehalt oben.
4. Falls ja: `CHANGELOG.md` und Version nach Repo-Konvention pflegen.
5. Optional, als eigener Vorgang: eine `.markdownlint.jsonc` für dieses Repo selbst, damit die
   Empfehlung hier auch gelebt wird.

## Environment & Constraints

- **Repo**: `/Users/ry100/Workspace/Projects/agentkit`, Remote `git@github.com:redpop/agentkit.git`.
- **Commit-Konvention**: Conventional Commits mit Plugin-Scope — `fix(ak-review): …`,
  `feat(ak-review): …`, `docs: …`, `chore: release vX.Y.Z`. **Achtung:** anders als im
  skp-modernisierungsratgeber, wo jeder Commit mit einem Jira-Ticket beginnt.
- **Zieldateien**: `docs/hooks/ak-review/validation-hooks.md` (Doku),
  `plugins/ak-review/hooks/config/.markdownlint-cli2.jsonc` (nur bei Ausbaustufe 2),
  `plugins/ak-review/hooks/markdown-format.sh` (nur lesen).
- **Dogfood-Falle**: Dieses Repo unterliegt demselben Hook, und hier gilt die Plugin-Config mit
  `MD049: asterisk`. Wer Markdown per `Write`/`Edit` anfasst, bekommt `_italic_` im Prosatext
  womöglich zu `*italic*` umgeschrieben. In Code-Fences ist das unkritisch — markdownlint fasst
  Fences nicht an, das Snippet oben ist also sicher.
- **Nachprüfen**: `npx -y markdownlint-cli2 "<datei>.md"`, plus eine Probe-Datei mit gemischtem
  Emphasis-Stil, um Beleg A und B selbst zu reproduzieren.
