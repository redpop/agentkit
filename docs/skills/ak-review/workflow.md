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

Scans the project tooling and generates a tailored `## Task completion workflow` section, then writes it to
`AGENTS.md` after you approve — the default Generate mode.

```text
/ak-review:workflow --audit
```

Audits the existing workflow against the project's current tooling and reports drift (removed commands, renamed
scripts, missing steps); `--audit` switches from generating to checking.

## Purpose

Generate a project-specific Task Completion Workflow for AGENTS.md, or audit an existing one against the current project tooling. Detects build tools, test runners, linters, formatters, and type checkers to produce a tailored 6-step workflow.

## Modes

### Generate (default)

1. Locate project instruction file (AGENTS.md / CLAUDE.md)
2. Check for existing workflow section — warn if found
3. Detect project tooling (package.json, composer.json, Cargo.toml, pyproject.toml, Makefile, etc.)
4. Build a 6-step workflow: Validate, Tests, Format, Simplify, Review, Re-validate
5. Present for review, write to instruction file after approval

### Audit (`--audit`)

1. Find existing workflow in instruction files
2. Detect current project tooling
3. Compare: missing tools, removed commands, renamed scripts, structural gaps
4. Report findings by severity
5. Offer to apply corrections

## Related

- [finalize](./finalize.md) -- Executes the workflow that this skill creates
- [coderabbit](./coderabbit.md) -- Review step referenced in generated workflows
