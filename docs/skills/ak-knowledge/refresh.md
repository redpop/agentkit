# Refresh Solution Docs

> Review and maintain `docs/solutions/` by updating, consolidating, replacing, or deleting stale entries.

## Overview

Cross-references existing solution documents against the current codebase to determine accuracy. Applies five possible outcomes per document: keep, update, consolidate, replace, or delete. Processes learning documents first, then pattern documents. Supports interactive mode (default) with user confirmation, and autofix mode for autonomous operation.

## Usage

```text
/ak-knowledge:refresh [scope hint]
/ak-knowledge:refresh mode:autofix [scope hint]
```

Without arguments, targets all documents under `docs/solutions/`. A scope hint narrows by subdirectory, frontmatter fields, filename, or content.

## When to Use

- After refactors, migrations, or dependency upgrades
- When a documented solution feels outdated
- Periodic maintenance of the knowledge base
- After creating new solution docs that may overlap with existing ones

## Best Practices

- Use `mode:autofix` for routine sweeps -- it applies safe changes and marks uncertain cases as stale
- Scope hints keep large knowledge bases manageable (e.g., `refresh build-errors`)
- Trust the tiered approach: focused (1-2 docs), batch (3-8), broad (9+)
- Do not treat age alone as a staleness signal -- evaluate against current code
- Combine with `/ak-knowledge:log` for a complete documentation lifecycle

## Related

- [log](./log.md) -- capture new solutions (the creation counterpart)
- [agents-md-improver](./agents-md-improver.md) -- maintain project instruction files
