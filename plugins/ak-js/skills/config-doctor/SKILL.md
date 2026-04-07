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
   python3 -c "
   import json
   try:
       d = json.load(open('package.json'))
       print('has_workspaces' if 'workspaces' in d else 'single')
   except json.JSONDecodeError:
       print('broken')
   "

   # separate workspace config files
   test -f pnpm-workspace.yaml && echo "pnpm_workspace"
   test -f lerna.json && echo "lerna"
   test -f turbo.json && echo "turbo"
   test -f nx.json && echo "nx"
   ```

   **If the result is `broken`:** skip monorepo detection for the root and mark the root
   `package.json` as unparseable. Phase 1a's parse check will emit the Critical "Broken JSON"
   finding. Phases 1c and beyond should skip any package whose `package.json` could not be
   parsed.

3. Build a file inventory. **Always use absolute paths.** Capture the project root once
   with `PROJECT_ROOT=$(pwd)` and use it for all subsequent file lookups. For workspace
   packages, build each package's absolute path (e.g., `$PROJECT_ROOT/packages/web`) and
   pass paths to `ls`/`find` directly — **never** use a bare `cd packages/foo` between scans,
   because successive `cd` calls stack on top of the current shell state and produce broken
   paths like `packages/web/packages/web`.

   For a single-package project (paths relative to `$PROJECT_ROOT`):

   ```bash
   PROJECT_ROOT=$(pwd)

   # JSON + config files in the root (pass explicit paths, not bare names)
   ls -1 "$PROJECT_ROOT"/package.json "$PROJECT_ROOT"/tsconfig.json \
         "$PROJECT_ROOT"/biome.json "$PROJECT_ROOT"/biome.jsonc \
         "$PROJECT_ROOT"/.prettierrc "$PROJECT_ROOT"/.prettierrc.json \
         "$PROJECT_ROOT"/vercel.json "$PROJECT_ROOT"/turbo.json \
         "$PROJECT_ROOT"/nx.json "$PROJECT_ROOT"/pnpm-workspace.yaml \
         "$PROJECT_ROOT"/manifest.json "$PROJECT_ROOT"/web-app-manifest.json \
         "$PROJECT_ROOT"/.eslintrc.json "$PROJECT_ROOT"/.npmrc \
         2>/dev/null

   # tsconfig variants (tsconfig.base.json, tsconfig.app.json, etc.)
   ls -1 "$PROJECT_ROOT"/tsconfig.*.json 2>/dev/null

   # Framework configs
   ls -1 "$PROJECT_ROOT"/next.config.{js,mjs,ts} \
         "$PROJECT_ROOT"/vite.config.{js,ts} \
         "$PROJECT_ROOT"/astro.config.{mjs,ts} \
         "$PROJECT_ROOT"/nuxt.config.{js,ts} \
         "$PROJECT_ROOT"/svelte.config.js \
         "$PROJECT_ROOT"/tailwind.config.{js,ts,mjs} \
         "$PROJECT_ROOT"/eslint.config.{js,mjs} \
         "$PROJECT_ROOT"/postcss.config.{js,cjs,mjs} \
         2>/dev/null
   ```

   **For a monorepo**, resolve the workspace globs (from `package.json.workspaces` or
   `pnpm-workspace.yaml`) into absolute paths, then scan each workspace package using the
   **same pattern** with its absolute path. Do this in a **subshell** (`(cd "$PKG_PATH" && ...)`)
   or by passing the absolute path to `ls`/`find` directly. **Never** let `cd` calls leak
   across scans — always return to `$PROJECT_ROOT` between packages, or use subshells so
   the parent shell's `pwd` is never mutated.

   Example monorepo scan:

   ```bash
   PROJECT_ROOT=$(pwd)

   # For each workspace package (resolved from workspaces globs)
   for PKG_PATH in "$PROJECT_ROOT"/packages/web "$PROJECT_ROOT"/packages/admin; do
     # Run each package scan in a subshell — no state leakage
     (
       cd "$PKG_PATH"
       ls -1 package.json tsconfig.json biome.json biome.jsonc \
             .prettierrc .prettierrc.json .npmrc \
             next.config.{js,mjs,ts} vite.config.{js,ts} \
             2>/dev/null
     )
   done
   ```

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

2. **Parse check first** — before schema validation, ensure the file parses.

   **JSONC-aware parsing is required** because several common config files officially
   allow comments and/or trailing commas:

   | Pattern | Format |
   |---------|--------|
   | `tsconfig.json`, `tsconfig.*.json` | JSONC (TypeScript officially supports `//` and `/* */` comments) |
   | `biome.jsonc` | JSONC (by extension) |
   | `*.jsonc` | JSONC (by extension) |
   | `.vscode/settings.json`, `.vscode/launch.json` | JSONC |
   | Everything else | strict JSON |

   For **strict JSON** files use the fast path:

   ```bash
   python3 -m json.tool "$ABSOLUTE_PATH" > /dev/null 2>&1
   ```

   For **JSONC** files (matched by the table above), strip `//` line comments, `/* ... */`
   block comments, and trailing commas before parsing. Do NOT touch comment-like strings
   inside string literals — use a regex that skips over quoted content:

   ```bash
   python3 -c '
   import json, re, sys

   src = open(sys.argv[1]).read()

   # Remove /* ... */ block comments and // line comments, while preserving
   # comment-like substrings that appear inside string literals.
   def strip_jsonc(text):
       out, i, n = [], 0, len(text)
       while i < n:
           c = text[i]
           if c == "\"":
               # copy string literal verbatim (handle escaped quotes)
               out.append(c); i += 1
               while i < n:
                   ch = text[i]
                   out.append(ch); i += 1
                   if ch == "\\" and i < n:
                       out.append(text[i]); i += 1
                   elif ch == "\"":
                       break
               continue
           if c == "/" and i + 1 < n and text[i+1] == "/":
               while i < n and text[i] != "\n":
                   i += 1
               continue
           if c == "/" and i + 1 < n and text[i+1] == "*":
               i += 2
               while i + 1 < n and not (text[i] == "*" and text[i+1] == "/"):
                   i += 1
               i += 2
               continue
           out.append(c); i += 1
       return "".join(out)

   cleaned = strip_jsonc(src)
   cleaned = re.sub(r",(\s*[}\]])", r"\1", cleaned)  # trailing commas

   try:
       json.loads(cleaned)
       print("OK")
   except json.JSONDecodeError as e:
       print(f"BROKEN: {e}")
   ' "$ABSOLUTE_PATH"
   ```

   If parse fails (for either strict JSON or JSONC after cleaning): emit a 🔴 Critical
   finding (`"Broken JSON — file cannot be parsed"`) and skip schema validation for that
   file. Continue with other files.

   **Important:** When running schema validation in Step 3 below against a JSONC file, pass
   the **cleaned JSON string** (comments/trailing commas stripped) to `jsonschema.validate`,
   not the raw file content — otherwise `json.load` inside the validator will re-raise the
   parse error.

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

### Phase 1b: `.npmrc` Validation

`.npmrc` uses INI format (`key=value` per line), not JSON. Load the keys whitelist from
`${CLAUDE_PLUGIN_ROOT}/knowledge/npmrc-keys.json`.

For each `.npmrc` in the inventory (there may be one per package in monorepos):

1. **Parse the file** — simple key=value line parser:

   ```bash
   python3 -c '
   import re, sys
   lines = open(sys.argv[1]).readlines()
   for i, line in enumerate(lines, start=1):
       stripped = line.strip()
       if not stripped or stripped.startswith("#") or stripped.startswith(";"):
           continue
       m = re.match(r"^([^=]+?)\s*=\s*(.*)$", stripped)
       if not m:
           print(f"{i}: MALFORMED: {stripped}")
           continue
       key, value = m.group(1).strip(), m.group(2).strip()
       print(f"{i}: {key}={value}")
   ' <file>
   ```

2. **Check each key:**

   - **Malformed line** → 🟡 Medium finding: `"Line <N>: malformed .npmrc entry"`
   - **Key not in whitelist AND not matching scoped registry pattern (`@scope:registry`)** →
     🔵 Suggestion: `"Line <N>: unknown npm config key '<key>' — may be tool-specific"`
   - **Key matches `sensitive_key_patterns` AND value is NOT `${...}` env reference** →
     🔴 Critical finding: `"Line <N>: plaintext credential detected in .npmrc"`
     - Example trigger: `_authToken=npm_xxxxxxxxxxxx`
     - Example OK: `_authToken=${NPM_TOKEN}`

3. **Check `registry=` value is a valid URL**:

   - If present and does NOT match `^https?://` → 🟠 High:
     `"Invalid registry URL: <value>"`

4. **Cross-reference with package.json**:

   - If `.npmrc` declares a custom registry (`registry=` or `@scope:registry=`), check whether
     `package.json` has a corresponding `publishConfig.registry`. If not, emit a 🔵 Suggestion:
     `"Custom registry declared in .npmrc but package.json lacks publishConfig.registry"`.

### Phase 1c: Cross-File Custom Rules

**Precondition:** For each package in the inventory, if its `package.json` failed to parse
(Phase 1a emitted a Critical "Broken JSON" finding), **skip all cross-file rules** for that
package. The rules below assume a parseable `package.json`. Rules that reference other
files (e.g., lockfiles for Rule 10) can still run if `package.json` is broken — use your
judgment per rule.

Load the full documentation from `${CLAUDE_PLUGIN_ROOT}/knowledge/cross-file-rules.md` and
apply each rule to the file inventory. Rules 1-10 run per package; rule 11 runs across
packages in monorepos only.

For each package in the inventory, run rules 1-10 in order. Each rule has the same output
shape:

```text
{
  rule_id: 1-11,
  rule_name: "scripts.lint requires linter dep",
  severity: "critical" | "high" | "medium" | "suggestion",
  file: "package.json" | ...,
  found: "...",
  why: "...",
  fix: "..."
}
```

**Rule 1 — scripts.lint requires linter dep:**

```bash
python3 -c "
import json
pkg = json.load(open('package.json'))
scripts = pkg.get('scripts', {})
lint_script = scripts.get('lint', '')
if 'eslint' in lint_script:
    deps = {**pkg.get('devDependencies', {}), **pkg.get('dependencies', {})}
    if 'eslint' not in deps:
        print('VIOLATION')
elif 'biome' in lint_script:
    deps = {**pkg.get('devDependencies', {}), **pkg.get('dependencies', {})}
    if '@biomejs/biome' not in deps:
        print('VIOLATION')
"
```

**Rule 2 — scripts.format requires formatter dep:** analogous to Rule 1 with `format` /
`prettier` / `biome`.

**Rule 3 — scripts.test requires test runner dep:** check for any of `vitest`, `jest`,
`mocha`, `playwright`, `@playwright/test`, `cypress` in deps when `scripts.test` exists.
Special case: if the script is `node --test`, no extra dep is required.

**Rule 4 — tsconfig.json requires TypeScript dep:** if any `tsconfig.json` exists in the
package, `typescript` must be in deps.

**Rule 5 — packageManager field consistency:** parse `pkg.packageManager` (e.g.,
`"pnpm@9.0.0"`). Scan for lockfiles. If mismatch, emit Medium.

**Rule 6 — engines.node vs tsconfig.target:** parse both, use the lookup table in
cross-file-rules.md, flag incompatibilities as High.

**Rule 7 — Publishable check:** if `pkg.private` is `false` or missing, verify `name`,
`version`, `description`, `license`, `repository` all present.

**Rule 8 — type: module consistency:** if `pkg.type === "module"`, scan `pkg.bin` and
`pkg.scripts` for `.js` files. The heuristic is simple — warn only, since determining
whether a file actually uses CommonJS would require reading each file.

**Rule 9 — Workspace globs must match packages:** if `pkg.workspaces` is set, expand the
globs via Bash (`ls packages/*/package.json 2>/dev/null`) and ensure at least one match.

**Rule 10 — Single package manager:** count lockfiles in the project root:

```bash
count=0
for f in package-lock.json pnpm-lock.yaml yarn.lock bun.lockb bun.lock; do
  [ -f "$f" ] && count=$((count + 1))
done
echo "$count"
```

If `count > 1`, emit Medium with the full list of found lockfiles.

**Rule 11 — Workspace dependency consistency (monorepo only):** only runs when
`project.type === "monorepo"`. Build a map:

```python
# pseudocode
drift_map = {}
for package in packages:
    for dep_type in ("dependencies", "devDependencies", "peerDependencies"):
        for name, version in package.package_json.get(dep_type, {}).items():
            drift_map.setdefault(name, {}).setdefault(version, []).append(package.path)

for name, versions in drift_map.items():
    if len(versions) > 1:
        severity = "high" if name in SINGLETON_LIBS else "medium"
        emit_finding(
            rule_id=11,
            severity=severity,
            file="<workspace>",
            found=f"{name} has {len(versions)} distinct versions",
            why="...",
            fix="Align versions or hoist to root"
        )
```

`SINGLETON_LIBS = {"react", "react-dom", "vue", "@vue/runtime-core", "svelte", "solid-js",
"rxjs", "zustand"}`.

### Phase 2: Framework Config Analysis (Agent Dispatch)

If the file inventory contains **any** framework config files (`next.config.*`,
`vite.config.*`, `astro.config.*`, `nuxt.config.*`, `svelte.config.*`, `tailwind.config.*`,
`eslint.config.*`, `postcss.config.*`), dispatch the analyzer agent.

Use the Task tool with `subagent_type="framework-config-analyzer"`. Pass the following in
the prompt:

1. The list of framework config file paths (absolute)
2. The contents of each package's `package.json` (so the agent can cross-reference deps)
3. The monorepo structure info (empty for single-package)

**Example dispatch:**

```text
Analyze the following framework configs for misconfigurations:

Files:
- /abs/path/next.config.ts
- /abs/path/tailwind.config.ts

Package.json content:
<paste package.json body>

Monorepo: false

Return findings as JSON matching the schema in your agent definition.
```

Parse the agent's JSON response. Extract `findings[]` and merge into the main finding list.
Extract `frameworks_detected[]` for the report summary.

If the agent fails or returns malformed JSON: emit a one-line note in the report footer
(`"Phase 2 analysis failed: <reason>"`) and continue to Phase 3 with only the Phase-1
findings.

**If no framework configs exist, skip Phase 2 entirely.** The report will show
"Phase 2: skipped (no framework configs detected)".

### Phase 3: Merge, Score, Render

1. **Merge findings** — combine Phase 1a, 1b, 1c, and Phase 2 findings into one list. Tag each
   finding with its source phase (for debugging in verbose mode).

2. **Calculate score:**

   ```python
   score_impact = {"critical": 10, "high": 5, "medium": 2, "suggestion": 0.5}
   penalty = sum(score_impact[f.severity] for f in findings)
   score = max(0, round(100 - penalty))
   ```

3. **Assign grade:**

   ```python
   grade = "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 40 else "F"
   ```

4. **Render report in this exact format:**

   ```markdown
   ## Config Doctor Report

   **Project**: <directory name>
   **Type**: Single package (<package_manager>) | <PM> workspace (<N> packages)
   **Score**: <score>/100 (Grade: <grade>)
   **Files scanned**: <count> (<comma-separated file list, max 10>)

   ---

   ### 🔴 Critical (<count>)

   **1. <file>[:<line>] — <title>**
   - Found: <quoted value>
   - Why: <explanation>
   - Fix: <actionable step>

   ### 🟠 High (<count>)
   ... (same format, numbered continuously)

   ### 🟡 Medium (<count>)
   ... (same format)

   ### 🔵 Suggestions (<count>)
   ... (same format)

   ### Phase 2 (Framework Configs)

   ✓ <file> — No issues detected (<framework_name>)

   ---

   ### Summary

   - <count> files validated • <C> critical, <H> high, <M> medium, <S> suggestion
   - **Action required**: <1-liner based on highest severity>
   - **Recommended**: <1-liner for second-most-severe batch>
   - Score: <score>/100 (<grade> — <short meaning>)
   ```

5. **Monorepo report variant** — if `project.type === "monorepo"`:

   - Start with `**Overall Score**: <score>/100 (<grade>)`
   - Section: `### Workspace-wide Findings (<count>)` — rule 11 findings go here
   - Section: `### Per-Package Reports` with `#### <package_path> — Score <N> (<grade>)`
     subsections

6. **Empty state** — if there are no findings at all:

   ```markdown
   ## Config Doctor Report

   **Project**: <name>
   **Score**: 100/100 (Grade: A)
   **Files scanned**: <count>

   ✓ No issues detected. Configuration looks healthy.
   ```

7. **Footer notes** — append any phase-level notes (e.g.,
   `"Extended schema validation skipped: SchemaStore unreachable"`) under `---` at the bottom
   of the report.

## Output to User

Print the rendered report as the final message of the skill's execution. Do not wrap it in
additional commentary — the report is self-contained.
