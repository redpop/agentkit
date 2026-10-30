# Schreibregeln mit Beispielen

Diese Regeln sind an ASD-STE100 angelehnt. ASD-STE100 (Simplified Technical English) ist eine
Spezifikation der ASD. Sie ist nur für Englisch definiert. Diese Datei überträgt einige ihrer
Grundgedanken frei auf Deutsch. Sie enthält keinen Text und kein Wörterbuch aus der Spezifikation.
Ein Text nach diesen Regeln ist deshalb nicht „STE-konform“.

## Begriffe in dieser Datei

| Begriff | Bedeutung |
| --- | --- |
| Anweisung | Ein Satz, der sagt, was jemand tun soll. Meist im Imperativ. |
| Beschreibung | Ein Satz, der erklärt, wie etwas ist oder funktioniert. |
| Begriffstabelle | Die Tabelle am Anfang eines Textes. Sie legt für jeden Fachbegriff eine Bedeutung fest. |
| Code-Span | Text in Backticks, zum Beispiel `npm run lint`. |

## 1. Satzlänge

- Eine Anweisung hat höchstens 20 Wörter.
- Eine Beschreibung hat höchstens 25 Wörter.
- Code-Spans zählen nicht mit.

Vorher (28 Wörter ohne Code-Spans):

```text
Nachdem die Konfiguration angepasst wurde, sollte im Ordner `site/` noch `npm run build` ausgeführt werden, damit die Dokumentationsseiten, der Index und die Tabellen im README neu erzeugt werden und alles wieder zusammenpasst.
```

Nachher:

```text
1. Passe die Konfiguration an.
2. Führe im Ordner `site/` den Befehl `npm run build` aus.

Der Befehl erzeugt die Doku-Seiten, den Index und die Tabellen im README neu.
```

## 2. Eine Aussage pro Satz

Ein Satz enthält eine Handlung oder eine Tatsache. Teile Sätze mit „und“, „wobei“, „sodass“ oder
„was“ in mehrere Sätze.

## 3. Absätze

Ein Absatz hat höchstens 6 Sätze. Ein Absatz behandelt ein Thema.

## 4. Aktiv statt Passiv

Nenne, wer handelt.

- Vorher: „Die Datei wird beim Installieren überschrieben.“
- Nachher: „Das Installationsskript überschreibt die Datei.“

Ist der Handelnde unbekannt, frag nach. Erfinde keinen Handelnden.

## 5. Verben statt Nominalstil

- Vorher: „Die Durchführung der Validierung erfolgt nach der Erstellung der Datei.“
- Nachher: „Validiere die Datei, nachdem du sie erstellt hast.“

Typische Signale sind „erfolgt“, „durchführen“, „vornehmen“ und Wörter auf -ung, -heit, -keit.

## 6. Zusammengesetzte Wörter

- Ein Wort hat höchstens 3 Teile.
- Gliedere lange Wörter mit Bindestrich: „Konfigurations-Datei“ statt „Konfigurationsdatei“, wenn es
  das Lesen erleichtert.
- Löse Wörter mit 4 oder mehr Teilen auf: „Liste der Zielpfade“ statt „Zielpfadlistendatei“.

## 7. Abläufe als nummerierte Liste

- Jeder Schritt ist eine eigene Zeile mit Nummer.
- Ein Schritt beginnt mit dem Verb im Imperativ oder nennt die Handlung zuerst.
- Bedingungen stehen vor der Handlung: „Wenn der Test fehlschlägt, lies die Ausgabe.“
- Warnungen stehen vor dem Schritt, für den sie gelten.

## 8. Abkürzungen und Jargon

- Schreibe Abkürzungen wie `ggf.`, `bzw.`, `vs.`, `u. a.` und `usw.` aus oder formuliere um.
  - `ggf.` → „wenn nötig“
  - `bzw.` → zwei Sätze oder „oder“
  - `vs.` → „im Vergleich zu“
- Erkläre Jargon und Akronyme wie `YAGNI` beim ersten Vorkommen oder in der Begriffstabelle.
- „z. B.“ und „d. h.“ sind bekannt und dürfen bleiben.

## 9. Ein Begriff, eine Bedeutung

- Lege jeden Fachbegriff in der Begriffstabelle fest.
- Verwende danach nur diesen Begriff. Wechsle nicht zu Synonymen.
- Hat ein Wort im Original zwei Bedeutungen, trenne sie. Beispiel:
  - „validieren“ heißt: ein Programm kontrolliert automatisch, zum Beispiel `npm run lint`.
  - „prüfen“ heißt: ein Mensch sieht sich etwas an und entscheidet.
- Übernimm Begriffe aus Diagrammen. Ein Begriff im Text muss zur Beschriftung im Diagramm passen.

## Was das Prüfskript kontrolliert

| Regel | Prüfung | Stufe |
| --- | --- | --- |
| Beschreibung höchstens 25 Wörter | jeder Satz | `FEHLER` |
| Anweisung höchstens 20 Wörter | Sätze in nummerierten Listen | `FEHLER` |
| Anweisung höchstens 20 Wörter | alle anderen Sätze mit 21 bis 25 Wörtern | `WARNUNG` |
| Absatz höchstens 6 Sätze | jeder Absatz | `WARNUNG` |
| Inhalt aus dem Original erhalten | Code-Spans, Codeblöcke, Diagramme, Bilder, Makro-Platzhalter, URLs, Daten, Versionen, Ticket-Nummern, Zahlen | `FEHLER` |
| Keine neuen Fakten | neue Daten, Versionen, Zahlen, URLs, Ticket-Nummern | `WARNUNG` |
| Passiv, Nominalstil, lange Wörter, Abkürzungen, unerklärte Akronyme, fehlende Begriffstabelle | Muster im Text | `HINWEIS` |

Das Skript erkennt die Satzart nicht sicher. Ob ein Satz eine Anweisung ist, entscheidest du.
Hinweise sind Vorschläge. Prüfe jeden Hinweis und entscheide selbst.
