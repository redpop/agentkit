# ak-js

JavaScript project configuration doctor for Claude Code. Validates `package.json`,
`tsconfig.json`, framework configs, and enforces cross-file best practices. Produces a
scored, actionable report.

## Features

- **JSON Schema validation** for the 10 most common JS config files (package.json, tsconfig,
  biome, vercel, turbo, nx, prettierrc, manifest, eslintrc, pnpm-workspace) — bundled locally,
  always available
- **SchemaStore fallback** for extended file coverage (commitlint, stylelint, renovate,
  dependabot, …)
- **`.npmrc` validation** — INI parsing, npm config key whitelist, plaintext credential
  detection
- **11 cross-file custom rules** — catches mismatches that no single-file tool sees: missing
  script deps, incompatible `engines.node` vs `tsconfig.target`, multiple lockfiles, workspace
  dependency drift, and more
- **Framework config analysis** via Phase-2 agent (`framework-config-analyzer`) — covers
  Next.js, Vite, Astro, Nuxt, SvelteKit, Tailwind, ESLint Flat Config, PostCSS
- **Monorepo-aware** — auto-detects workspaces (npm, pnpm, yarn, bun, lerna, turbo, nx) and
  reports per-package plus workspace-wide findings
- **Doctor-pattern output** — 0-100 score, A-F grade, severity-grouped findings with
  actionable fixes (matches `react-doctor` and `agents-md-improver` precedent)
- **Zero-config** — one command, no flags, no environment setup
- **Read-only** — never modifies files; ask Claude in the same conversation to apply specific
  fixes

## Skills

| Command | Description |
|---------|-------------|
| [`/ak-js:config-doctor`](./skills/config-doctor/SKILL.md) | Scan the current project and produce a config health report |

## Agents

| Name | Purpose |
|------|---------|
| [`framework-config-analyzer`](./agents/framework-config-analyzer.md) | Phase-2 worker that analyzes JS/TS framework configs dispatched by `config-doctor` |

## Usage

From any JavaScript project directory:

```text
/ak-js:config-doctor
```

The skill will detect whether the project is a single package or a monorepo, scan all relevant
config files, and produce a scored report with grouped findings. To apply fixes, ask Claude to
edit specific files (e.g., "add `eslint` to devDependencies" or "add a `license` field").

## Example Output

```markdown
## Config Doctor Report

**Project**: my-app
**Type**: Single package (npm)
**Score**: 78/100 (Grade: B)
**Files scanned**: 4 (package.json, tsconfig.json, .npmrc, vite.config.ts)

### 🔴 Critical (1)

**1. `.npmrc:3` — Plaintext auth token detected**
- Found: `_authToken=npm_xxxxxxxxxxxx`
- Fix: Use `${NPM_TOKEN}` env variable

(…continues with High, Medium, Suggestion sections…)

### Summary
- 4 files validated • 1 critical, 2 high, 3 medium, 1 suggestion
- Score: 78/100 (B — Good)
```

## Architecture

`config-doctor` is a **hybrid skill + agent** design:

- The **skill** (Entry point, Read/Bash/Glob tools) handles fast, deterministic Phase 1: JSON
  Schema validation, `.npmrc` parsing, and the 11 cross-file custom rules
- The **agent** (`framework-config-analyzer`, Read/Grep/Glob/Bash tools) handles Phase 2:
  regex/heuristic analysis of JS/TS framework configs. Dispatched only if framework config
  files are detected.

All validation is **read-only**. All knowledge (schemas, rules, philosophy) lives in
`${CLAUDE_PLUGIN_ROOT}/knowledge/` for transparency and easy updating.

## Non-MVP

The following features are explicitly **not** in the MVP and have separate future skills
planned:

- Auto-fix — planned as `/ak-js:config-fix`
- `npm audit` integration — planned as `/ak-js:security-doctor`
- `npm outdated` — planned as `/ak-js:dependency-doctor`
- Bundle size analysis — planned as `/ak-js:bundle-doctor`

See `.docs/plans/2026-04-07-ak-js-config-doctor-design.md` for the full design rationale.

## License

MIT
