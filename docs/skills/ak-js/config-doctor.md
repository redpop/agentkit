# Config Doctor

> Validate JavaScript project configuration files and produce a scored report.

## Overview

`/ak-js:config-doctor` scans a JavaScript/Node project for configuration issues across 10+
config files and 11 custom cross-file rules. It produces a 0-100 score with A-F grade and
actionable findings grouped by severity (Critical / High / Medium / Suggestion).

## Usage

```text
/ak-js:config-doctor
```

No arguments. Runs on the current working directory and auto-detects monorepos (npm/pnpm/yarn workspaces, Lerna,
Turbo, Nx). The skill is read-only and never modifies files.

## Examples

```text
/ak-js:config-doctor
```

Audits every config file under the current directory and prints a scored report — no argument needed because the
skill always targets the working directory and discovers monorepo packages on its own.

## When to Use

- After major dependency changes (install, upgrade, removal)
- Before publishing a package (catches missing `license`, `repository`, `description`)
- When onboarding an existing project (quick health check)
- As part of a release checklist to catch config drift
- After migrating between package managers (catches multiple lockfiles, mismatched
  `packageManager` field)

## What Gets Checked

### Phase 1a: JSON Schema validation

The skill bundles 10 core schemas locally (no network required):

`package.json`, `tsconfig.json`, `biome.json`, `.prettierrc`, `vercel.json`, `turbo.json`,
`nx.json`, `manifest.json`, `.eslintrc.json`, `pnpm-workspace.yaml`.

For files outside this list, the skill falls back to
[SchemaStore](https://www.schemastore.org/json/) with a 3-second timeout — if unreachable,
extended validation is silently skipped.

### Phase 1b: `.npmrc` validation

- Parses INI format
- Checks keys against the official npm config whitelist
- **Detects plaintext credentials** (`_authToken`, `_password`, etc.) as Critical findings
  — use `${NPM_TOKEN}` env references instead
- Validates `registry=` URLs

### Phase 1c: 11 cross-file custom rules

Rules that distinguish `config-doctor` from a plain schema validator:

1. `scripts.lint` requires linter dep
2. `scripts.format` requires formatter dep
3. `scripts.test` requires test runner dep
4. `tsconfig.json` requires `typescript` dep
5. `packageManager` field consistency with lockfile
6. `engines.node` vs `tsconfig.target` compatibility
7. Publishable check (name/version/description/license/repository)
8. `type: module` consistency
9. Workspace globs must match actual packages
10. Single package manager (multiple lockfiles → warning)
11. Workspace dependency consistency (monorepo only, singleton libs get higher severity)

Full documentation: `plugins/ak-js/knowledge/cross-file-rules.md`.

### Phase 2: Framework config analysis

When `next.config.*`, `vite.config.*`, `astro.config.*`, `nuxt.config.*`, `svelte.config.*`,
`tailwind.config.*`, `eslint.config.*`, or `postcss.config.*` is detected, the skill
dispatches the `framework-config-analyzer` agent for regex/heuristic semantic analysis.

## Output

Doctor-pattern report: 0-100 score, A-F grade, findings grouped by 🔴 Critical / 🟠 High /
🟡 Medium / 🔵 Suggestion. Each finding has a file reference, explanation, and fix.

## Best Practices

- Run after major dependency changes to catch drift early
- Fix Critical findings first — they indicate broken or unsafe state
- For Medium/Suggestion items, batch them into a single "config polish" PR
- The skill is read-only — to apply fixes, tell Claude directly which findings to address

## Related

- [agents-md-improver](../ak-knowledge/agents-md-improver.md) — similar doctor pattern for
  AGENTS.md project instruction files
- [react-doctor](../ak-react/react-doctor.md) — sibling React-specific code quality scanner
