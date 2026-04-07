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

### Phase 1a: JSON Schema Validation

For each JSON file in the inventory, validate against a schema:

1. **Lookup strategy:**

   | File name | Schema |
   |-----------|--------|
   | `package.json` | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/package.schema.json` |
   | `tsconfig.json`, `tsconfig.*.json` | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/tsconfig.schema.json` |
   | `biome.json`, `biome.jsonc` | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/biome.schema.json` |
   | `.prettierrc`, `.prettierrc.json` | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/prettierrc.schema.json` |
   | `vercel.json` | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/vercel.schema.json` |
   | `turbo.json` | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/turbo.schema.json` |
   | `nx.json` | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/nx.schema.json` |
   | `manifest.json`, `web-app-manifest.json` | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/manifest.schema.json` |
   | `.eslintrc.json` | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/eslintrc.schema.json` |
   | `pnpm-workspace.yaml` | `${CLAUDE_PLUGIN_ROOT}/knowledge/schemas/pnpm-workspace.schema.json` |

2. **Parse check first** — before schema validation, ensure the file parses:

   ```bash
   python3 -m json.tool <file> > /dev/null 2>&1
   ```

   If parse fails: emit a 🔴 Critical finding (`"Broken JSON — file cannot be parsed"`) and
   skip schema validation for that file. Continue with other files.

3. **Schema validation** — use `python3` with `jsonschema` (widely available):

   ```bash
   python3 -c "
   import json, sys
   try:
       import jsonschema
   except ImportError:
       sys.exit(0)  # jsonschema not available — skip validation gracefully

   instance = json.load(open('<file>'))
   schema = json.load(open('<schema_path>'))
   try:
       jsonschema.validate(instance=instance, schema=schema)
       print('VALID')
   except jsonschema.ValidationError as e:
       print(f'INVALID: {e.message} (at {list(e.absolute_path)})')
   "
   ```

   If `jsonschema` is not available: emit a one-line notice in the report footer
   (`"Schema validation requires python3 -m pip install jsonschema"`) and skip this phase
   entirely. Do NOT fail the whole skill — continue to Phase 1b.

4. **Extended lookup (SchemaStore fallback)** — for JSON files not in the local table (e.g.,
   `commitlint.config.json`), try fetching from SchemaStore with a 3-second timeout:

   ```bash
   curl -sSL --max-time 3 \
     https://json.schemastore.org/<filename-stem>.json \
     -o /tmp/config-doctor-schema-$$
   ```

   If curl exits non-zero or the response is not valid JSON: skip the file, add note to the
   report footer: `"Extended schema validation skipped: SchemaStore unreachable or no schema
   for <file>"`.

5. **Convert validation errors to findings** — map `jsonschema.ValidationError` → one finding
   per error:

   ```text
   severity: High (for type mismatches, required-field-missing)
   severity: Medium (for other violations)
   file: <relative path>
   title: Schema violation
   found: <error message>
   why: Schema validation failed
   fix: Correct the value to match the schema
   ```
