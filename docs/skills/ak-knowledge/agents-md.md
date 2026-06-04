# AGENTS.md Converter

> Rename CLAUDE.md files to AGENTS.md and create backward-compatible symlinks.

## Overview

Finds all `CLAUDE.md` files in a project, renames them to `AGENTS.md`, and creates `CLAUDE.md` symlinks pointing back. When both files already exist as regular files, it consolidates their content into `AGENTS.md` before symlinking. This ensures compatibility across different AI coding assistants.

## Usage

```text
/ak-knowledge:agents-md
```

No arguments required. The skill operates on the current working directory (`pwd`) recursively, scanning for
every `CLAUDE.md` file (excluding `node_modules/` and `.git/`).

## Examples

```text
/ak-knowledge:agents-md
```

Run from a project root to convert all `CLAUDE.md` files in the tree to `AGENTS.md` plus `CLAUDE.md` symlinks;
there are no arguments, so the working directory determines the scope.

## When to Use

- Migrating a project from Claude-specific `CLAUDE.md` to universal `AGENTS.md`
- Ensuring backward compatibility after renaming instruction files
- Consolidating duplicate `CLAUDE.md` and `AGENTS.md` files in a monorepo

## Best Practices

- Run once per project -- the skill skips files already converted (symlinks)
- Review the consolidation output when both files existed as regular files
- Excludes `node_modules/` and `.git/` directories automatically
- Check version control after running to verify symlinks are tracked correctly

## Related

- [agents-md-improver](./agents-md-improver.md) -- audit and improve AGENTS.md content quality
