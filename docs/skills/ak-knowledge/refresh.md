# Refresh Solution Docs

> Review and maintain `docs/solutions/` by updating, consolidating, replacing, or deleting stale entries.

## Overview

Cross-references existing solution documents against the current codebase to determine accuracy. Applies five possible outcomes per document: keep, update, consolidate, replace, or delete. Processes learning documents first, then pattern documents. Supports interactive mode (default) with user confirmation, and autofix mode for autonomous operation.

## Usage

```text
/ak-knowledge:refresh
/ak-knowledge:refresh [scope hint]
/ak-knowledge:refresh mode:autofix
/ak-knowledge:refresh mode:autofix [scope hint]
```

The skill parses `$ARGUMENTS` for one flag and a scope hint:

- `mode:autofix` -- run autonomously without prompts, applying safe actions and marking uncertain cases stale.
  Omit it for the default interactive mode, which confirms ambiguous decisions.
- Everything remaining after flag extraction is the scope hint. Without it, all documents under
  `docs/solutions/` are targeted; with it, the working set narrows by subdirectory, frontmatter field, filename,
  or content (matched in that priority order).

## Examples

```text
/ak-knowledge:refresh
```

Review every document under `docs/solutions/` interactively; with no arguments the full knowledge base is in
scope and ambiguous decisions are confirmed with you.

```text
/ak-knowledge:refresh build-errors
```

Limit the interactive review to one area; the scope hint `build-errors` matches the subdirectory, so only those
docs are cross-referenced against the codebase.

```text
/ak-knowledge:refresh webpack
```

Target documents about a topic; the hint `webpack` matches by frontmatter, filename, or content when no
subdirectory of that name exists.

```text
/ak-knowledge:refresh mode:autofix build-errors
```

Run a hands-off sweep of one area; `mode:autofix` applies safe Keep/Update/Delete actions without prompting,
marks uncertain docs as stale, and the trailing `build-errors` scopes it to that subdirectory.

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
