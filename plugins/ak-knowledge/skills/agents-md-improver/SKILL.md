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

**Validation steps:**

- Verify documented commands exist in `package.json`, `Makefile`, `composer.json`, etc.
- Check that referenced file paths actually exist
- Confirm architecture descriptions match the current directory structure
- Look for TODO items that were never completed

### Task Completion Workflow Check

**Always verify the file contains a "Task completion workflow" section** (typically near the end). Every project benefits from documented post-implementation steps so coding agents know what to run after changes.

**If the section is missing:** flag as a high-priority gap. The fix is to invoke `/ak-review:workflow`, which analyzes project tooling (build, test, lint, format, review, changelog) and generates an appropriate workflow tailored to the detected stack, in pointer form (see below).

**If the section exists, first check its shape:**

- **Pointer form** — the section is a short paragraph referencing `.claude/skills/task-completion/SKILL.md`. This passes the presence check on its own merits (it keeps AGENTS.md/CLAUDE.md lean, which the Conciseness criterion rewards); audit the referenced file's content as described below.
- **Inline form** — the full numbered step list is written directly into the instruction file. This is a **Conciseness** finding: the file is resent in full on every prompt, so the steps belong in `.claude/skills/task-completion/SKILL.md` (lazy-loaded, only read when the skill is invoked) with a single pointer line left in its place. The fix is `/ak-review:workflow --audit`, which now offers this exact migration.

**Then audit the content** (the skill file's body in pointer form, or the section body in inline form):

- Are all referenced commands/scripts still present (e.g., `pnpm test`, `cargo build`, `composer test`)?
- Are referenced skills/agents still installed (e.g., `/ak-review:coderabbit`, `/simplify`, `refactoring-expert`)?
- Have tools been renamed or replaced (e.g., `prettier` → `biome`, `eslint` → `oxlint`)?
- Have new tools been added that should be incorporated (e.g., a type checker, new formatter, additional review skill)?
- Are any steps redundant, duplicated, or no longer applicable to the current project?
- **Always invoke `/ak-review:workflow --audit`** — it detects template drift (e.g., new optional steps, changed bullet structure, pointer/skill-file mismatch) that manual command checks cannot catch, including pointer-vs-skill-file step-name drift. Do not rely on reading commands alone or re-deriving checks it already performs.

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

For both cases, **always delegate to that skill** rather than manually patching the workflow section. Do not invent workflow steps inside this skill — let `/ak-review:workflow` analyze the project tooling and propose the structure. Manual inspection of commands cannot detect template drift (new optional steps, changed bullet structure, renamed sub-bullets).

**Dogfooding check:** If the project being audited *is* AgentKit itself (or another project that maintains workflow templates for third parties), also verify that the project's own `AGENTS.md` workflow reflects the latest template it publishes. Improvements made to a project's own workflow (e.g., new skip clauses, corrected agent invocations, additional release-cycle rules) should be back-ported into the templates that project ships to others — otherwise the project recommends practices it no longer follows itself.

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
9. **Missing or outdated task completion workflow** — section absent entirely, or references commands/skills/agents that no longer exist (delegate to `/ak-review:workflow` or `/ak-review:workflow --audit`)
