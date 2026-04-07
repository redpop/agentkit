# framework-config-analyzer

> Phase-2 worker agent for `/ak-js:config-doctor`. Analyzes JS/TS framework configuration
> files.

## Overview

Receives a list of framework config file paths from the `config-doctor` skill, parses each
with `node --check` and regex heuristics, cross-references against `package.json`
dependencies, and returns structured findings as JSON. The agent does not attempt full AST
parsing — MVP uses regex-based semantic analysis.

## When Invoked

Dispatched by `/ak-js:config-doctor` when Phase 2 detects any of:

- `next.config.{js,mjs,ts}` (Next.js)
- `vite.config.{js,ts}` (Vite)
- `astro.config.{mjs,ts}` (Astro)
- `nuxt.config.{js,ts}` (Nuxt)
- `svelte.config.js` (SvelteKit)
- `tailwind.config.{js,ts,mjs}` (Tailwind)
- `eslint.config.{js,mjs}` (ESLint Flat Config)
- `postcss.config.{js,cjs,mjs}` (PostCSS)

## Methodology

1. **Detection** — identifies the framework by filename + import statements
2. **Syntactic check** — `node --check` for `.js`/`.mjs`; regex scan for `.ts`/`.cjs`
3. **Semantic analysis** — framework-specific regex patterns (e.g., deprecated Next.js
   `experimental` flags, Vite missing framework plugin, Tailwind empty `content` glob)
4. **Cross-reference** — verifies the framework's own package is in `dependencies` /
   `devDependencies`
5. **Output** — returns JSON with `findings[]` and `frameworks_detected[]` for the skill to
   merge

## Tools

- `Read` — reading config file contents
- `Grep` — pattern matching for semantic checks
- `Glob` — resolving file patterns
- `Bash` — running `node --check` for syntactic validation

## Constraints

- **Read-only** — never modifies files (no Edit/Write tools enabled)
- **No network** — stays offline, no npm/registry calls
- **No AST libraries** — regex heuristics only for MVP
- **JSON output only** — the skill parses the agent's response as structured data

## Example Output

```json
{
  "frameworks_detected": ["next", "tailwind"],
  "findings": [
    {
      "file": "next.config.ts",
      "severity": "high",
      "title": "Deprecated experimental flag",
      "found": "experimental.appDir: true",
      "why": "App Router is stable since Next.js 13.4 — the flag is a no-op",
      "fix": "Remove the experimental.appDir line"
    }
  ],
  "notes": []
}
```

## Related

- [`/ak-js:config-doctor`](../../skills/ak-js/config-doctor.md) — the parent skill that
  dispatches this agent
