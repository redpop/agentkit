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
