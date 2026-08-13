# workflow

| Field | Value |
|-------|-------|
| Plugin | ak-review |
| Invoke | `/ak-review:workflow [--audit]` |

## Usage

```text
/ak-review:workflow [--audit]
```

**Flags:** `--audit` (audit an existing workflow against current tooling). With no flag, runs in Generate mode.

## Examples

```text
/ak-review:workflow
```

Scans the project tooling and generates a tailored workflow, then — after you approve — writes the full step list
to `.claude/skills/task-completion/SKILL.md` and a short pointer line to `AGENTS.md` — the default Generate mode.
Splitting it this way keeps AGENTS.md/CLAUDE.md lean, since that file is resent in full on every prompt while the
skill file is only loaded when invoked.

```text
/ak-review:workflow --audit
```

Audits the existing workflow against the project's current tooling and reports drift (removed commands, renamed
scripts, missing steps); `--audit` switches from generating to checking.

## Purpose

Generate a project-specific Task Completion Workflow, split into a lazy-loaded skill file and a short AGENTS.md pointer, or audit an existing one against the current project tooling. Detects build tools, test runners, linters, formatters, and type checkers to produce a tailored 6-step workflow.

## Pointer form

The workflow is never inlined into AGENTS.md/CLAUDE.md. Generate mode writes the full step list to
`.claude/skills/task-completion/SKILL.md` (with `name`/`description` frontmatter) and leaves only a pointer line —
`After implementing changes, follow the task-completion skill (.claude/skills/task-completion/SKILL.md): validate →
… → version & changelog` — in the instruction file. `/ak-review:finalize` resolves the pointer automatically. An
older, fully inline workflow (steps written directly into AGENTS.md) is still recognized by Audit mode and can be
migrated to this form.

## Modes

### Generate (default)

1. Locate project instruction file (AGENTS.md / CLAUDE.md)
2. Check for an existing workflow section (inline or pointer form) — warn if found
3. Detect project tooling (package.json, composer.json, Cargo.toml, pyproject.toml, Makefile, etc.)
4. Build a 6-step workflow: Validate, Tests, Format, Simplify, Review, Re-validate
5. Present for review; after approval, write the steps to `.claude/skills/task-completion/SKILL.md` and the pointer to the instruction file

### Audit (`--audit`)

1. Find existing workflow in instruction files, resolving the pointer to its skill file if present
2. Detect current project tooling
3. Compare: missing tools, removed commands, renamed scripts, structural gaps, pointer/skill-file drift, inline form still in use
4. Report findings by severity
5. Offer to apply corrections, including migrating an inline workflow to pointer form

## Related

- [finalize](./finalize.md) -- Executes the workflow that this skill creates
- [coderabbit](./coderabbit.md) -- Review step referenced in generated workflows
