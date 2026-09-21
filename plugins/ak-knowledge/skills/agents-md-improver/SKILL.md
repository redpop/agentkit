---
name: agents-md-improver
description: >
  Audit and improve AGENTS.md project instruction files. Use when the user asks to check, audit,
  update, improve, or fix AGENTS.md or CLAUDE.md files, or mentions project instruction maintenance.
---

# AGENTS.md Improver

Audit, evaluate, and improve AGENTS.md (or CLAUDE.md) project instruction files to ensure coding agents have optimal project context.

**This skill can write to AGENTS.md files.** After presenting a quality report and getting user approval, it updates files with targeted improvements.

## Phase 1: Discovery

Find all project instruction files in the repository:

- `AGENTS.md` (preferred, universal across coding agents)
- `CLAUDE.md` (Claude Code specific)
- `.claude/CLAUDE.md` (Claude Code subdirectory)

Also check for package-specific files in monorepo setups (e.g., `packages/*/AGENTS.md`).

If both `AGENTS.md` and `CLAUDE.md` exist at the same level, note this — ideally only one should be used.

**Then look for the other files that are read as instructions**, because a code reviewer may apply
all of them at once: `.cursorrules`, `.github/copilot-instructions.md`,
`.github/instructions/*.instructions.md`, `GEMINI.md`, `.cursor/rules/*`, `.windsurfrules`,
`.clinerules/*`, `.rules/*`. They are usually left over from a tool the project no longer uses, and
nobody updates them — see _Instruction files are review criteria_ below for why that now matters.

## Phase 2: Quality Assessment

For each file found, evaluate against these criteria:

| Criterion | Weight | Check |
|-----------|--------|-------|
| Commands/workflows documented | 20 pts | Are build/test/dev commands present and copy-paste ready? |
| Architecture clarity | 20 pts | Can a coding agent understand the codebase structure? |
| Non-obvious patterns | 15 pts | Are gotchas, quirks, and "why we do it this way" documented? |
| Conciseness | 15 pts | No verbose explanations or obvious info? Each line earns its place? |
| Currency | 15 pts | Does it reflect the current codebase state? Are referenced files/commands valid? |
| Actionability | 15 pts | Are instructions executable, not vague? Paths real, commands working? |
| Reviewability | — | Would a code reviewer applying this file produce useful findings, or noise? See below |
| Commit-message convention | — | Does the file bound what an agent writes into `git log`? See below |

**Validation steps:**

- Verify documented commands exist in `package.json`, `Makefile`, `composer.json`, etc.
- Check that referenced file paths actually exist
- Confirm architecture descriptions match the current directory structure
- Look for TODO items that were never completed

### Instruction Files Are Review Criteria

**This file is no longer read only by an agent that can ask questions.** CodeRabbit's knowledge base
discovers `**/AGENTS.md` and `**/CLAUDE.md` by default and applies them as review criteria, and the
`ak-review:coderabbit` skill hands the same file to a CLI review with `-c`. Every line in it becomes
something a reviewer acts on, silently, on every change.

That raises the bar on what belongs in the file, and it is a different bar from readability:

- **A vague line produces vague findings.** "Keep the code clean" is harmless as advice and useless
  as a criterion — it yields a comment on every merge request and teaches the team to ignore the
  reviewer. Flag aspirational lines that state no checkable condition.
- **A rule a linter already enforces produces duplicate findings.** If `biome`, `ruff` or
  `shellcheck` already fails the build on it, the file should not repeat it.
- **Contradictions between instruction files reach the reviewer as contradictions.** A stale
  `.cursorrules` next to a current `AGENTS.md` means both sets of criteria are applied. Compare the
  files found in Phase 1 against each other and flag disagreements; recommend deleting what the
  project no longer uses rather than keeping it "just in case".

**In a monorepo, placement is now a decision with consequences.** A file at `packages/x/AGENTS.md`
is discovered by the same `**/AGENTS.md` pattern and scopes its criteria to that package — the
portable equivalent of a reviewer configuration's per-path instructions, except that it also reaches
every coding agent working in that directory. Where the root file carries a rule that only holds for
one package, recommend moving it there rather than qualifying it in place.

### Task Completion Workflow Check

**Always verify the file contains a "Task completion workflow" section** (typically near the end). Every project benefits from documented post-implementation steps so coding agents know what to run after changes.

**If the section is missing:** flag as a high-priority gap. The fix is `/ak-review:workflow`, which analyzes project tooling (build, test, lint, format, review, changelog) and generates an appropriate workflow tailored to the detected stack, in pointer form (see below) — **but only if that skill is actually installed**; see _Every `/ak-review:workflow` invocation is conditional_ below.

**If the section exists, first check its shape:**

- **Pointer form** — the section is a short paragraph referencing `.claude/skills/task-completion/SKILL.md`. This passes the presence check on its own merits (it keeps AGENTS.md/CLAUDE.md lean, which the Conciseness criterion rewards); audit the referenced file's content as described below.
- **Inline form** — the full numbered step list is written directly into the instruction file. This is a **Conciseness** finding: the file is resent in full on every prompt, so the steps belong in `.claude/skills/task-completion/SKILL.md` (lazy-loaded, only read when the skill is invoked) with a single pointer line left in its place. The fix is `/ak-review:workflow --audit`, which now offers this exact migration — subject to the same installation check.

**Then audit the content** (the skill file's body in pointer form, or the section body in inline form):

- Are all referenced commands/scripts still present (e.g., `pnpm test`, `cargo build`, `composer test`)?
- Are referenced skills/agents still installed (e.g., `/ak-review:coderabbit`, `/simplify`, `refactoring-expert`)?
- Have tools been renamed or replaced (e.g., `prettier` → `biome`, `eslint` → `oxlint`)?
- Have new tools been added that should be incorporated (e.g., a type checker, new formatter, additional review skill)?
- Are any steps redundant, duplicated, or no longer applicable to the current project?
- **If `/ak-review:workflow` is installed, always invoke `/ak-review:workflow --audit`** — it detects template drift (e.g., new optional steps, changed bullet structure, pointer/skill-file mismatch) that manual command checks cannot catch, including pointer-vs-skill-file step-name drift. Do not rely on reading commands alone or re-deriving checks it already performs.
- **If it is not installed, the bullets above are the whole audit** — and the report has to say
  so: the section was verified for stale commands only, its structure not at all.

#### Every `/ak-review:workflow` Invocation Is Conditional

**Check the available-skills listing before recommending or invoking it; do not invoke it on the
assumption that it is there.** That skill ships in the `ak-review` plugin and this one in
`ak-knowledge` — the two are installed independently, so a session that has this audit available
frequently does not have the skill it delegates to. The failure is invisible to whoever writes this
file, because a marketplace developer has every plugin installed.

Where it is absent, the recommendation becomes _install `ak-review`, then run it_, and the report
names template drift as the coverage that is missing rather than implying the manual checks are
equivalent — they are not, which is the whole reason the delegation exists. Writing a workflow
section by hand here is the last resort, taken only if the user asks for it after hearing that, and
it is reported as not validated against the template.

This is the same discipline the bullet above applies to the audited project's own file: a skill
reference is only worth something if the skill is there.

### Commit Message Convention Check

**Always verify the file bounds what an agent writes into `git log`.** A coding agent writes a commit message in nearly every session, has no reader in front of it, and will spend everything it knows — measurements, test output, rebase history, rejected options. The result is accurate, unreadable and permanent. No linter catches it and no reviewer sees it before it lands, so the instruction file is the only place the bound can live.

**If the section is missing:** flag it as a high-priority gap and propose the template below.

**This section stays inline, and that is deliberate.** Unlike the task completion workflow, it does not move into a lazy-loaded skill file: it has to be in context at the moment the message is written, which is usually not a moment when a git skill was invoked. That is affordable only because the block is kept to four bullets — **the reasoning behind each one lives here, in this skill, and is never copied into the project file.** The instruction file is resent on every prompt, so a rule that argues its own case there costs the project a paragraph per session forever. Do not raise the block as a Conciseness finding on a later audit, and do not let it grow either.

**It is not a review criterion.** CodeRabbit and the CLI reviews apply every line of this file to diffs, and a commit-message rule gives them nothing to decide on — exactly the case _Instruction Files Are Review Criteria_ warns about. The scoping line at the top of the template exists for that reason; keep it.

**Derive the project's own numbers before proposing anything:**

```bash
# Ticket prefix in use?
git log -200 --pretty=format:'%s' | grep -oE '^[A-Z][A-Z0-9]+-[0-9]+ ' | sort -u | head
# Subjects over the 72-character cap
git log -200 --pretty=format:'%s' | awk 'length($0) > 72 { print length($0)"  "$0 }'
# Body length: median and maximum in words
git log -100 --pretty=format:'%H' | while read h; do git log -1 --pretty=format:'%b' "$h" | wc -w; done \
  | sort -n | awk '{a[NR]=$1} END { print "median", a[int(NR/2)], "max", a[NR] }'
```

- A ticket prefix shortens the subject: `<BUDGET>` is `72 − length(prefix)` as a number, `<PREFIX>` the pattern as a reader recognises it (`SKP-XXXX `). Name both instead of the generic 72.
- If no prefix pattern appears, drop the prefix from the template and use the plain 72.
- Report the measured median, the maximum and the subjects over 72 as concrete findings. They make the case for the section far better than the rule itself does.

**Reconcile before appending.** The convention is often already stated elsewhere: a git or commit skill under `.claude/skills/`, a `.gitmessage` template, a `commit-msg` hook, `CONTRIBUTING.md`. Read those first and keep a single authority — the instruction file, with the other places pointing at it. Two versions of the rule reach both the agent and the reviewer as a contradiction.

**Template.** Fill the placeholders from the measurements, keep the wording and the length, and write it in the language of the surrounding file. Resist adding examples or justifications to it — everything a reader might want explained is in this file instead:

```markdown
## Commit Messages

A rule for `git log`, not a review criterion for diffs.

- Subject: `<TICKET> Capitalized description`, imperative, **72 characters max** (`<BUDGET>` after
  the prefix), readable on its own — `git log --oneline` shows nothing else.
- Body: blank line, wrapped at 72, answers **why**; the diff is the what. A mechanical change gets
  no body at all.
- **Never in a body**: measurements, test output, rebase archaeology, rejected alternatives, notes
  to another ticket, session narration ("as requested"). Correcting an earlier commit's claim is
  why, and stays.
- One reason per paragraph, about 15 lines. More belongs in `<DOCS-LOCATION>` or the ticket, linked
  from one line in the body.
```

**The ceiling is calibrated, not guessed.** Applying the exclusion list to the two worst messages in
the MOP-S history this template came from took 411 words down to 161 and 401 down to 148 — four
paragraphs and about 15 lines each, with every load-bearing reason intact. A tighter ceiling would
have cut reasoning rather than noise, which is why the escape clause is in the rule. Recalibrate the
same way in a project whose commits look different: cut a real example, then count.

The exclusion list is the operative rule, not the line ceiling. The ceiling is a backstop that makes the rule checkable; the exclusions are what a message actually has to be cut by, and stripping them usually brings an overlong message inside the ceiling without losing anything a reader needs.

**Quality grades:**

- **A (90-100)**: Comprehensive, current, actionable
- **B (70-89)**: Good coverage, minor gaps
- **C (50-69)**: Basic info, missing key sections
- **D (30-49)**: Sparse or outdated
- **F (0-29)**: Missing or severely outdated

## Phase 3: Quality Report

**ALWAYS output the quality report BEFORE making any changes.**

```text
## AGENTS.md Quality Report

### Summary
- Files found: X
- Average score: X/100
- Files needing update: X

### File-by-File Assessment

#### 1. ./AGENTS.md (Project Root)
**Score: XX/100 (Grade: X)**

| Criterion | Score | Notes |
|-----------|-------|-------|
| Commands/workflows | X/20 | ... |
| Architecture clarity | X/20 | ... |
| Non-obvious patterns | X/15 | ... |
| Conciseness | X/15 | ... |
| Currency | X/15 | ... |
| Actionability | X/15 | ... |

**Issues:**
- [List specific problems]

**Recommended additions:**
- [List what should be added]
```

## Phase 4: Propose Updates

After presenting the report, ask the user for confirmation before making changes.

### What TO add

- **Commands/workflows** discovered during analysis (build, test, dev, deploy)
- **Gotchas** and non-obvious patterns found in the codebase
- **Package relationships** not obvious from the code
- **Testing approaches** that work for this project
- **Configuration quirks** (env vars, build-time vs. runtime, etc.)

### What NOT to add

- Obvious info derivable from code (e.g., "UserService handles users")
- Generic best practices not specific to the project
- One-off fixes unlikely to recur
- Verbose explanations — prefer one-liners over paragraphs

### Task completion workflow updates

The "Task completion workflow" section gets special handling because the `/ak-review:workflow` skill can generate or audit it intelligently:

- **Missing section** → recommend `/ak-review:workflow` (generate mode) and offer to invoke it as a follow-up
- **Stale section** (broken commands, removed skills, renamed tools) → recommend `/ak-review:workflow --audit` and offer to invoke it

For both cases, **always delegate to that skill when it is installed** rather than manually patching the workflow section. Do not invent workflow steps inside this skill — let `/ak-review:workflow` analyze the project tooling and propose the structure. Manual inspection of commands cannot detect template drift (new optional steps, changed bullet structure, renamed sub-bullets). When it is not installed, follow _Every `/ak-review:workflow` invocation is conditional_ in Phase 2 instead: recommend the `ak-review` plugin and report the structural check as not performed.

**Dogfooding check:** If the project being audited _is_ AgentKit itself (or another project that maintains workflow templates for third parties), also verify that the project's own `AGENTS.md` workflow reflects the latest template it publishes. Improvements made to a project's own workflow (e.g., new skip clauses, corrected agent invocations, additional release-cycle rules) should be back-ported into the templates that project ships to others — otherwise the project recommends practices it no longer follows itself.

### Update format

For each proposed change, show:

```text
### Update: ./AGENTS.md

**Why:** [one-line reason why this helps future sessions]

[diff showing the specific addition]
```

## Phase 5: Apply Updates

After user approval, apply changes. Preserve existing content structure.

**Recommended sections** (use only what is relevant to the project):

- **Commands** — build, test, dev, lint (table format preferred)
- **Architecture** — directory structure with purpose annotations
- **Key Files** — entry points, config files
- **Code Style** — project-specific conventions (not generic advice)
- **Environment** — required vars, setup steps
- **Testing** — commands, patterns, conventions
- **Gotchas** — quirks, common mistakes, ordering dependencies
- **Commit messages** — subject format, body budget, what never belongs in one
- **Task completion workflow** — post-implementation validation steps

## Common Issues to Flag

1. **Stale commands** — build/test commands that no longer work
2. **Missing dependencies** — required tools not mentioned
3. **Outdated architecture** — file structure that has changed
4. **Missing environment setup** — required env vars or config
5. **Broken file references** — paths to files that no longer exist
6. **Undocumented gotchas** — non-obvious patterns not captured
7. **Duplicate CLAUDE.md + AGENTS.md** — should be consolidated
8. **Missing symlink notice** — if `CLAUDE.md` is a symlink to `AGENTS.md`, the notice `> \`CLAUDE.md\` is a symlink pointing to this file.` must appear at the top of `AGENTS.md`
9. **Missing or outdated task completion workflow** — section absent entirely, or references commands/skills/agents that no longer exist (delegate to `/ak-review:workflow` or `/ak-review:workflow --audit` where the `ak-review` plugin is installed; otherwise report the gap and name the plugin)
10. **Leftover instruction files from unused tools** — a `.cursorrules`, `.windsurfrules` or
    `GEMINI.md` the project abandoned, still discovered and still applied as review criteria
    alongside the current file
11. **Aspirational lines that cannot be checked** — guidance that reads well and gives a reviewer
    nothing to decide on, producing a comment on every change
12. **A root-level rule that only holds for one package** — in a monorepo it belongs in that
    package's own instruction file, where it is scoped for both agents and reviewers
13. **No commit-message convention** — nothing bounds what an agent writes into `git log`, and
    nothing else in the toolchain will: no linter reads a commit message and no reviewer sees it
    before it lands
14. **The convention stated in more than one place** — an instruction file, a git skill, a
    `.gitmessage` and a `CONTRIBUTING.md` that drift apart; keep one authority and point the rest
    at it
