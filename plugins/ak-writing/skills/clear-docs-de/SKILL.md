---
name: clear-docs-de
description: 'Clear German technical documentation, loosely based on ASD-STE100 (Simplified Technical English). Use when a German README, guide, concept page or Confluence page should become shorter, plainer and unambiguous without changing its content, or when a new German doc should follow fixed writing rules: short sentences, active voice, verbs instead of nominal style, numbered procedures, a term table, no invented facts. Triggers on "verständlicher schreiben", "Klartext", "einfacher formulieren", "Doku umschreiben", "STE", "ASD-STE100", "Simplified Technical English" for German text. Not for English text, marketing copy, or proof of STE conformance.'
---

# Clear German Technical Docs (loosely based on ASD-STE100)

Writes German technical documentation that is short, clear and unambiguous. The rules and their
examples are German, because they describe German text: `${CLAUDE_PLUGIN_ROOT}/knowledge/clear-docs-rules-de.md`.

## Arguments

Parse `$ARGUMENTS` for a mode flag and a target:

- `--rewrite` – rewrite mode: an original exists, only its form changes
- `--write` – write mode: a new doc from sources the user names (code, tickets, notes)
- a file path, a Confluence page, or the topic of a new doc – the target

Without a flag, an existing file or page means rewrite mode and a topic means write mode. When the
mode is still unclear, ask.

## Basis and limits

- The rules are loosely based on ASD-STE100 (Simplified Technical English).
- ASD-STE100 is a protected specification of the ASD and is defined for English only.
- This skill carries a few of its ideas over to German, freely. Never quote text from the
  specification or a word from its dictionary.
- Call a result "angelehnt an ASD-STE100" (loosely based on ASD-STE100), never "STE-konform".
- If the text is English, tell the user: this skill covers German only.

## Terms

| Term | Meaning |
| --- | --- |
| original | The text the user wants rewritten. |
| source | Material for a new doc: code, tickets, notes, statements of the user. |
| term table | The table at the start of the text (Begriffstabelle). It fixes exactly one meaning per technical term. |
| fact | Everything that is not form: code, paths, dates, versions, numbers, decisions, diagram labels. |
| open question | A term or fact you do not understand for certain. |

## Procedure

1. Read the original or the sources completely.
2. Read the rules in `${CLAUDE_PLUGIN_ROOT}/knowledge/clear-docs-rules-de.md`.
3. Collect every technical term. Note what each one means in this text.
4. If a term has two meanings, split it into two terms.
5. Collect open questions. Ask them before you finish the text.
6. Write the term table.
7. Write the text by the rules.
8. Check the text with the check script.
9. Fix every `FEHLER`. Weigh every `WARNUNG` and `HINWEIS`.
10. Show the user the result and the list of open questions.

## Writing rules (short form)

- An instruction has at most 20 words. A description has at most 25 words.
- A sentence makes one statement.
- A paragraph has at most 6 sentences.
- Write in the active voice. Name who acts.
- Use verbs, not nominal style: „prüft die Datei“, not „führt eine Prüfung der Datei durch“.
- A compound word has at most 3 parts. Split long words with a hyphen.
- Write procedures as numbered lists. One step is one action.
- Replace abbreviations such as `ggf.`, `bzw.` and `vs.`. Explain jargon such as `YAGNI`.
- Use each term only in the meaning the term table gives it.

Example of split meanings: „validieren“ means a program checks; „prüfen“ means a person looks at it.

## Content stays unchanged

When rewriting, never change:

- code spans, code blocks, commands, paths and file names
- dates, versions, ticket numbers, numbers and URLs
- decisions and their reasons
- diagrams: the Mermaid source and the PNG show the same thing. Change no label unless the user asks
  for it, and then change both together.

Write numbers as digits where the original has digits.

## No invented facts

- What is open in the original stays open. Write it as open.
- Fill no gap with a guess. Add no actor, no reason and no number.
- When you do not understand a term for certain, collect it as an open question.
- Ask the user, or the experts the user names.
- If another Claude session knows the subject, send it the questions, for example with `SendMessage`.
- If a question is still open at the end, mark the spot in the text and name it to the user.

## Check script

`${CLAUDE_PLUGIN_ROOT}/skills/clear-docs-de/scripts/check_text.py` needs python3 only.

Write mode:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/clear-docs-de/scripts/check_text.py" text.md
```

Rewrite mode:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/clear-docs-de/scripts/check_text.py" text.md --original original.md
```

The script reports in German, as the text it checks:

- `FEHLER` – sentence too long, or a fact of the original is missing. Fix every one.
- `WARNUNG` – sentence too long if it is an instruction, paragraph too long, or a new fact. Decide.
- `HINWEIS` – passive, nominal style, long word, abbreviation, unexplained acronym. Decide.
- `--sentences` lists every sentence it found with its word count, to spot wrongly split sentences.
- `--no-hints` hides the hints.

The script cannot tell an instruction from a description for certain, and it does not count code
spans. Exit code 1 means at least one `FEHLER`.

## Without python3

The scripts need python3 3.9 or later. They do not run on Python 2.

1. Before the first call, check with `python3 --version` that python3 is there.
2. If python3 is missing or older, tell the user.
3. Install nothing without the user's explicit yes. On macOS the Xcode Command Line Tools ship a
   suitable python3.
4. Go on without the script. Count the words of long sentences yourself.
5. When rewriting, compare every code span, date, version and number with the original.
6. Call the result "checked by hand", never "checked by the script".
7. Upload nothing to Confluence without `confluence.py`: the macros would not be safe.

## Confluence (optional)

If the original is a Confluence page, follow
`${CLAUDE_PLUGIN_ROOT}/knowledge/clear-docs-confluence.md`. Its script
`${CLAUDE_PLUGIN_ROOT}/skills/clear-docs-de/scripts/confluence.py` saves macros and images with their
`macro-id` and puts them back unchanged.

Never upload to Confluence without the user's explicit yes in the chat. Show first what changes.

## Output

Give the user:

1. the finished text, or the path to the file
2. the list of open questions and marked spots
3. the check script's result in one line: number of errors, warnings and hints
4. when rewriting: the terms the term table changed
