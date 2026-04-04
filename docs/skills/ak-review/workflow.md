# workflow

| Field | Value |
|-------|-------|
| Plugin | ak-review |
| Invoke | `/ak-review:workflow [--audit]` |

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

## Examples

```bash
/ak-review:workflow                # Generate workflow for this project
/ak-review:workflow --audit        # Audit existing workflow
```

## Related

- [finalize](./finalize.md) -- Executes the workflow that this skill creates
- [coderabbit](./coderabbit.md) -- Review step referenced in generated workflows
