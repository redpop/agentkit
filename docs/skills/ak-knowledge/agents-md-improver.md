# AGENTS.md Improver

> Audit, evaluate, and improve AGENTS.md project instruction files for optimal AI agent context.

## Overview

Performs a multi-phase quality assessment of `AGENTS.md` (or `CLAUDE.md`) files, scoring them against six weighted criteria. Presents a detailed quality report with grades (A through F), then proposes and applies targeted improvements with user approval. Can write directly to AGENTS.md files after confirmation.

## Usage

```text
/ak-knowledge:agents-md-improver
```

No arguments required. Discovers all instruction files automatically.

## When to Use

- Setting up a new project and want optimal AI agent instructions
- After major refactors that may have made instructions stale
- When AI sessions seem to miss important project context
- Periodic maintenance of project instruction quality

## Best Practices

- Review the quality report before approving changes -- the skill always shows it first
- Focus on commands/workflows (20 pts) and architecture clarity (20 pts) for maximum impact
- Avoid adding obvious information derivable from code -- each line should earn its place
- Keep instructions actionable with real paths and copy-paste ready commands
- Consolidate if both CLAUDE.md and AGENTS.md exist at the same level
- The skill always checks for a "Task completion workflow" section and delegates generation/audit to `/ak-review:workflow` (or `/ak-review:workflow --audit`) when it is missing or stale

## Related

- [agents-md](./agents-md.md) -- convert CLAUDE.md to AGENTS.md with symlinks
- [refresh](./refresh.md) -- maintain solution docs (complementary maintenance skill)
- [/ak-review:workflow](../ak-review/workflow.md) -- generate or audit the Task completion workflow section (this skill delegates to it)
