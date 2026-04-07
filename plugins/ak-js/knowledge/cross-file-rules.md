# Cross-File Custom Rules (MVP)

These 11 rules distinguish `config-doctor` from a plain JSON Schema validator. They
cross file boundaries and encode project-aware best practice.

Rules 1-10 apply to single packages. Rule 11 applies only to monorepos.

## Rule 1: `scripts.lint` requires linter dep

**Severity:** 🟠 High

**Detection:** If `package.json` → `scripts.lint` exists and invokes `eslint` or
`biome`, then `eslint` or `@biomejs/biome` (respectively) must appear in
`devDependencies` (or `dependencies` in rare cases).

**Why:** After a fresh clone + install, `npm run lint` will fail with "command not
found".

**Fix:** `npm install -D eslint` (or `@biomejs/biome`).

**Example finding:**

> `package.json` → `scripts.lint` — Missing dependency
> Found: `"lint": "eslint ."` but `eslint` is not in `devDependencies`.
> Fix: `npm install -D eslint`

## Rule 2: `scripts.format` requires formatter dep

**Severity:** 🟠 High

**Detection:** If `scripts.format` invokes `prettier` or `biome`, that formatter must
be in devDependencies.

**Why:** Same as Rule 1 — script fails after fresh install.

**Fix:** `npm install -D prettier` (or `@biomejs/biome`).

## Rule 3: `scripts.test` requires test runner dep

**Severity:** 🟠 High

**Detection:** If `scripts.test` exists, at least one of `vitest`, `jest`, `mocha`,
`playwright`, `@playwright/test`, `cypress`, or `node --test` (native Node test
runner) must be present.

**Why:** Same as Rules 1-2.

**Fix:** Install the test runner that matches the script.

## Rule 4: `tsconfig.json` requires TypeScript dep

**Severity:** 🟠 High

**Detection:** If `tsconfig.json` exists in the package, `typescript` must be in
`devDependencies`.

**Why:** TS compilation will fail without the compiler.

**Fix:** `npm install -D typescript`.

## Rule 5: `packageManager` field consistency

**Severity:** 🟡 Medium

**Detection:** If `package.json` has a `packageManager` field (e.g.,
`"packageManager": "pnpm@9.0.0"`), the declared manager must match the lockfile
present in the repo:

| Lockfile present | Expected `packageManager` prefix |
|------------------|----------------------------------|
| `package-lock.json` | `npm@...` |
| `pnpm-lock.yaml` | `pnpm@...` |
| `yarn.lock` | `yarn@...` |
| `bun.lockb` / `bun.lock` | `bun@...` |

**Why:** Tools like Corepack will error if the declared manager doesn't match
reality.

**Fix:** Align the `packageManager` field with the actual lockfile.

## Rule 6: `engines.node` vs `tsconfig.target`

**Severity:** 🟠 High

**Detection:** If both `package.json` → `engines.node` and `tsconfig.json` →
`compilerOptions.target` are set, the TypeScript target must be compatible with the
Node version.

| Node major | Max TS target |
|------------|---------------|
| 14 | ES2020 |
| 16 | ES2021 |
| 18 | ES2022 |
| 20+ | ES2023 or ESNext |

**Why:** TypeScript will emit syntax that Node cannot run — the build passes but
runtime crashes.

**Fix:** Raise `engines.node` or lower `compilerOptions.target`.

## Rule 7: Publishable check

**Severity:** 🟡 Medium

**Detection:** If `package.json` → `private` is `false` or absent (default), all of
these fields must be present: `name`, `version`, `description`, `license`,
`repository`.

**Why:** A publishable package without these fields confuses registry users and
triggers npm warnings.

**Fix:** Add the missing fields, or set `"private": true` if publish isn't intended.

## Rule 8: `type: module` consistency

**Severity:** 🟡 Medium

**Detection:** If `package.json` → `type` is `"module"`, warn when any file
referenced in `bin` or `scripts` ends with `.js` — those files will be treated as
ES modules, which may conflict with CommonJS-only code (e.g., `require()` calls).

**Why:** Silent runtime errors when ES module loader meets CommonJS syntax.

**Fix:** Rename `.js` → `.cjs` for CommonJS files, or use `.mjs` explicitly for ES
module files.

## Rule 9: Workspace globs must match packages

**Severity:** 🟠 High

**Detection:** If `package.json` → `workspaces` is set (or `pnpm-workspace.yaml` has
`packages:`), the globs must resolve to at least one actual package directory
containing a `package.json`.

**Why:** Workspaces with empty globs silently disable monorepo features — installs
go into the wrong place, scripts don't propagate.

**Fix:** Correct the glob, or create the missing package directories.

## Rule 10: Single package manager

**Severity:** 🟡 Medium

**Detection:** Count lockfiles in the project root: `package-lock.json`,
`pnpm-lock.yaml`, `yarn.lock`, `bun.lockb` / `bun.lock`. If more than one is
present, report.

**Why:** Multiple lockfiles indicate a failed migration and cause inconsistent
dependency resolution depending on which tool the developer invokes.

**Fix:** Delete all lockfiles except the one matching the declared package manager.

## Rule 11: Workspace dependency consistency (monorepo only)

**Severity:** 🟠 High (for singleton libs) or 🟡 Medium (for others)

**Detection:** Across all workspace packages, build a map of `dependency_name → set
of declared versions`. Flag any dependency that appears with more than one distinct
version range.

Bump to 🟠 High for known singleton libraries that break when multiple copies load
simultaneously: `react`, `react-dom`, `vue`, `@vue/runtime-core`, `svelte`,
`solid-js`, `rxjs`, `zustand` (global stores).

**Why:** Duplicate copies of stateful libraries break hooks, context, and global
singletons. Even for non-singleton libs, drift is usually unintentional and should
be surfaced.

**Fix:** Align versions across packages, or hoist the dependency to the root
`package.json`.
