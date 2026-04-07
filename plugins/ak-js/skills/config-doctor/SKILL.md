---
name: config-doctor
description: >
  Audit a JavaScript/Node project's configuration files and produce a scored report.
  Use when the user asks to "check package.json", "validate my tsconfig", "config doctor",
  "audit JS config", or after major dependency changes.
---

# Config Doctor

Scans all JavaScript project config files (package.json, tsconfig.json, biome.json, framework
configs, `.npmrc`, etc.) against JSON Schemas, npm config whitelists, and 11 custom cross-file
rules. Produces a 0-100 score with actionable findings grouped by severity.

**Zero-config:** `/ak-js:config-doctor`. No arguments. Runs on the current working directory.
Auto-detects monorepos.

**Read-only:** the skill never modifies files. To apply a fix, ask Claude in the same
conversation to edit the specific file.

## Support Files

| File | Purpose | Path |
|------|---------|------|
| **Philosophy** | Scoring formula, severity levels, grading scale | `${CLAUDE_PLUGIN_ROOT}/knowledge/config-doctor-philosophy.md` |
| **Cross-file rules** | Doc of the 11 MVP rules | `${CLAUDE_PLUGIN_ROOT}/knowledge/cross-file-rules.md` |
| **Schemas** | Local JSON Schemas for Phase-1 core files | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/*.schema.json` |
| **npmrc keys** | Whitelist of valid npm config keys | `${CLAUDE_PLUGIN_ROOT}/knowledge/npmrc-keys.json` |

Read support files on-demand as each phase needs them, not all at once.

## Workflow

### Phase 0: Project Detection

1. Use Bash to verify `package.json` exists in the current directory:

   ```bash
   test -f package.json && echo "OK" || echo "MISSING"
   ```

   If `MISSING`: exit with message
   `"No package.json found in $(pwd) — config-doctor is for JavaScript projects."`

2. Detect monorepo structure. Check all of:

   ```bash
   # workspaces field in root package.json
   python3 -c "import json; d = json.load(open('package.json')); print('has_workspaces' if 'workspaces' in d else 'single')"

   # separate workspace config files
   test -f pnpm-workspace.yaml && echo "pnpm_workspace"
   test -f lerna.json && echo "lerna"
   test -f turbo.json && echo "turbo"
   test -f nx.json && echo "nx"
   ```

3. Build a file inventory. If single-package:

   ```bash
   # Find all relevant config files in the root
   ls -1 package.json tsconfig.json biome.json biome.jsonc .prettierrc .prettierrc.json \
         vercel.json turbo.json nx.json pnpm-workspace.yaml manifest.json web-app-manifest.json \
         .eslintrc.json .npmrc 2>/dev/null

   # Framework configs
   ls -1 next.config.js next.config.mjs next.config.ts \
         vite.config.js vite.config.ts \
         astro.config.mjs astro.config.ts \
         nuxt.config.js nuxt.config.ts \
         svelte.config.js \
         tailwind.config.js tailwind.config.ts tailwind.config.mjs \
         eslint.config.js eslint.config.mjs \
         postcss.config.js postcss.config.cjs postcss.config.mjs 2>/dev/null
   ```

   If monorepo: resolve workspace globs (from `package.json.workspaces` or
   `pnpm-workspace.yaml`) and repeat the scan in each workspace package directory.

4. Internally maintain the file inventory as structured data per-package:

   ```text
   project = {
     type: 'single' | 'monorepo',
     packages: [
       {
         path: '.' | 'packages/web' | ...,
         package_json: { ...parsed... },
         json_configs: ['tsconfig.json', 'biome.json', ...],
         framework_configs: ['next.config.ts', ...],
         npmrc: '.npmrc' | null
       }
     ],
     root_lockfiles: ['pnpm-lock.yaml', ...]
   }
   ```

(Phase 1a, 1b, 1c, 2, and 3 are added in subsequent tasks.)
