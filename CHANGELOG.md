# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.18.1] - 2026-07-08

### 🐛 Fixed

- `ak-review:explain` — Bare `/ak-review:explain` (no pasted snippet) failed with "no code
  was given" even when the user had text selected in a connected IDE (e.g. the VS Code
  extension), because the skill only checked `$ARGUMENTS` and never looked for the
  IDE-injected selection context. The skill now checks for an IDE selection first, falls
  back to typed/pasted input, and only asks the user to select or paste code when neither
  is present.

## [1.18.0] - 2026-07-03

### ✨ Added

- `ak-review:explain` — New skill that explains a code snippet to a developer: what it
  does, why it's built that way, and what's notable about it. Ported from the pt-ai
  `explain` skill. Explains the current editor selection, or whatever is passed as
  arguments (an optional introductory sentence before the snippet is ignored). Output
  follows a fixed structure — Purpose, How it works, and an optional Noteworthy section
  — capped at ~250 words, without improvement suggestions or assumptions beyond the
  visible code.

## [1.17.0] - 2026-06-06

### ✨ Added

- `ak-review:delegate` — New **Phase 2.5: Discover Requirements Context** automatically
  discovers and embeds requirements context in every generated review prompt — no flags
  needed. Three sources are checked in order:
  1. **Jira tickets** — searches branch name and commit messages for ticket IDs
     (pattern `[A-Z]{2,}-\d+`) and fetches details via Atlassian MCP (summary,
     type/status, description, acceptance criteria). Skipped if MCP is unavailable.
  2. **Spec / task Markdown files** — scans the working tree for files whose name or
     directory matches task/spec patterns (`TODO`, `TASK`, `SPEC`, `tasks/`, etc.)
     and any Markdown files modified in the current diff scope.
  3. **Fallback summary** — when neither source yields results, synthesizes a one-paragraph
     summary from commit messages so the review agent always has requirements context.

  Fetched content is always embedded directly in the generated prompt to keep it
  self-contained, regardless of whether the reviewing agent has its own Atlassian MCP
  access. The generated prompt uses composable sub-sections (Jira tickets, Specification
  documents, Summary) that are included or omitted based on what was discovered.

## [1.16.1] - 2026-06-06

### 🔄 Changed

- `ak-review:delegate` — Generated prompt now includes a dedicated **Approach** section
  (section 3) instructing the foreign agent to dispatch one sub-agent per review dimension
  (Security, Performance, Tests, …) and merge findings before producing the final report.
- `ak-review:advise` — Phase 2 now recommends dispatching one sub-agent per group of ≤8
  tightly related findings (for lists >5), replacing the previous "internal groups of ≈8"
  workaround. This avoids cross-issue context mixing and enables parallel validation.

## [1.16.0] - 2026-06-05

### ✨ Added

- `ak-knowledge:agents-md` — After creating a symlink (converted or consolidated), the skill
  now automatically inserts a notice `` > `CLAUDE.md` is a symlink pointing to this file. ``
  at the top of `AGENTS.md` (directly after the `# AGENTS.md` heading, skipped if already
  present).

### 🐛 Fixed

- `ak-review:workflow` + `AGENTS.md` — Review workflow bullet renamed from
  **"Optional delegated review"** to **"Delegated review"**: the "Optional" label caused
  agents to skip the entire bullet (including the mandatory user prompt) rather than just
  making the *execution* optional. Asking the user is now framed as a required step.
- `ak-knowledge:agents-md-improver` — Added Common Issues item 8: checks that `AGENTS.md`
  carries the symlink notice when `CLAUDE.md` is a symlink pointing to it. Removed a
  redundant prose block in Phase 1 that duplicated the same rule already expressed in
  the checklist.

## [1.15.2] - 2026-06-04

### 🐛 Fixed

- `ak-knowledge:agents-md-improver` — workflow audit is now mandatory: agents must always
  invoke `/ak-review:workflow --audit` when a workflow section exists, rather than relying
  on manual command checks that miss template drift (e.g., new optional steps, changed
  bullet structure). Both the skill and its docs were updated to enforce this.

### 🔄 Changed

- `README.md` — Semgrep MCP Server link updated to point to the GitHub source repository.

## [1.15.1] - 2026-06-04

### 🔄 Changed

- `ak-review` workflow step extended: local `/ak-review:coderabbit` review is now the explicit
  default, with an optional delegated review prompt via `/ak-review:delegate` for external
  agents (Kimi, Codex, etc.). Applied to both `AGENTS.md` and the `ak-review:workflow` skill
  template so generated workflows include this pattern automatically.

## [1.15.0] - 2026-06-04

### ✨ Added

- `ak-review:delegate` — Generates a self-contained, project-specific code-review prompt for
  any foreign coding agent (Kimi, Codex, etc.). Analyzes the current project (instructions,
  languages, test/lint commands, docs) and the requested scope, then emits a ready-to-paste
  prompt. Scope flags mirror CodeRabbit semantics (`--type all|committed|uncommitted`,
  `--base <ref>`) plus `--path`/`--all`; report-only by default, `--fix` opts into direct
  fixing, `--out <path>` writes the prompt to a file. The prompt forces a Markdown + JSON
  findings report consumable by `ak-review:advise`.
- `ak-review:advise` — Validates a foreign agent's code-review findings against the real code
  and returns a per-finding verdict (`confirmed`, `false_positive`, `needs_more_context`,
  `uncertain`) with confidence and a fix hint. Read-only: never modifies code and never
  invents new findings. Accepts findings via `--in <path>` or pasted content. Together with
  `delegate` this forms a two-agent review loop (foreign agent reviews → Claude validates →
  foreign agent fixes).

## [1.14.0] - 2026-05-17

### ✨ Added

- `ak-git:operations` — Auto-detects the commit-prefix style already used on the current
  branch and continues it consistently. If any prior commit on the branch matches
  `^\[<ticket-id>\]` (e.g., `[FOO-1] feat: ...`), new commits use bracket style
  (`[ABC-1234] type(scope): description`); otherwise plain style is used
  (`ABC-1234 type(scope): description`). Style detection uses `git merge-base` against
  `origin/HEAD`, `origin/main`, or `origin/master` — with a graceful fallback to the
  last 10 commits when no common ancestor is resolvable.

### 🔄 Changed

- `ak-git:operations` — Branch-name pattern matching now explicitly covers bare
  ticket refs with a description suffix (e.g., `FOO-123_description`) in addition to
  the existing `fix/ABC-1234` and `feature/FOO-99_description` patterns.
- `docs/skills/ak-git/operations.md` — Updated overview and best-practices to document
  the new bracket-vs-plain style auto-detection behavior.

## [1.13.4] - 2026-05-10

### 🗑️ Removed

- `ak-review` validation hooks — removed the **Skill Suggestion prompt hook** (`PostToolUse`
  on `Write|Edit|MultiEdit`) that asked Claude after every file edit whether an AgentKit
  skill would be a helpful next step. The hook interrupted mid-workflow executions, causing
  Claude to stop continuation instead of proceeding. The three command-based validation
  hooks (Markdown, JSON, ShellCheck) are unaffected.

## [1.13.3] - 2026-05-02

### 🔄 Changed

- `ak-review:workflow` — Significantly expanded optional-step detection: the skill now
  scans for a `docs/` directory (activates a Docs step) and for `CHANGELOG.md` /
  multi-file `version` field patterns (activates a Version & Changelog step with
  "release commit MUST be final" note). Template updated with `/bump-version` and
  `/ak-meta:changelog` as preferred/fallback invocations. Adaptation rules extended with
  `{typecheck_cmd}`, `{project_specific_validations}`, and step-number skip-clause
  guidance. Audit-mode checklist updated to verify optional steps and correct skill
  references (`/simplify` instead of `code-simplifier:code-simplifier`).
- `ak-review:finalize` — Removed the duplicated inline workflow template; the skill now
  delegates directly to `/ak-review:workflow` when a new workflow needs to be created,
  keeping the single source of truth in one place.
- `ak-knowledge:agents-md-improver` — Added a dogfooding-check reminder: when auditing
  a project that ships workflow templates to others (e.g., AgentKit itself), verify that
  the project's own `AGENTS.md` workflow reflects its latest published template.
- `docs/solutions/best-practices/skill-shell-absolute-paths-2026-04-07.md` — Added
  Rule 7: always run a live `zsh` test in the target shell before marking a skill as
  released, to catch shell-portability regressions that unit-style reviews miss.

## [1.13.2] - 2026-04-07

### 🐛 Fixed

- `ak-js:config-doctor` Phase 0 Step 2 — **exit-code propagation**. The workspace-type
  detection block ended with a chain of `test -f` commands (`lerna.json`, `turbo.json`,
  `nx.json`). When the last-checked file did not exist, the whole Bash tool call
  returned a non-zero exit status and was reported as a failure — even though the
  detection correctly printed the detected workspace kind. Each test is now wrapped in
  `|| true` and the block ends with a `true` terminator. Added an "exit-code
  discipline" note describing the rule for all future bash blocks.
- `ak-js:config-doctor` Phase 0 Step 3 — **shell glob / brace expansion rejected by
  zsh**. Patterns like `tsconfig.*.json` and `next.config.{js,mjs,ts}` are aborted by
  zsh (the macOS default) with `no matches found` **before** the command runs, because
  the `nomatch` option is on by default — which means `2>/dev/null` cannot suppress
  the error. Replaced all glob/brace patterns in Phase 0 Step 3 with `find -name … -o
  -name …` chains, which are POSIX-portable and treat "no match" as an empty result.
  Explicit path lists (fixed filenames) remain safe and are kept as-is.
- `ak-js:config-doctor` Phase 0 Step 3 monorepo scan — added `vitest.config.{js,ts}`
  to the framework config scan (discovered during the same live test).
- `docs/solutions/best-practices/skill-shell-absolute-paths-2026-04-07.md` — extended
  to 6 rules with the two new shell-portability lessons (Rule 5: use `find`, not shell
  globs; Rule 6: end conditional-detection blocks with `true`).

## [1.13.1] - 2026-04-07

### 🐛 Fixed

- `ak-js:config-doctor` Phase 0 Step 3 — **shell `cd` stacking bug** that produced broken
  paths like `packages/web/packages/web` on real-world monorepos. The inventory scanner
  now captures `PROJECT_ROOT` once and always uses absolute paths; monorepo package scans
  run inside subshells so `cd` state never leaks between packages.
- `ak-js:config-doctor` Phase 1a Parse Check — **JSONC false-positives** on
  `tsconfig.json`, `tsconfig.*.json`, `biome.jsonc`, and `*.jsonc` files. TypeScript
  officially allows `//` and `/* */` comments in tsconfig files, and several configs use
  the `.jsonc` extension by convention. Added a string-aware JSONC stripper that removes
  comments and trailing commas while preserving comment-like substrings inside string
  literals, and documented the list of JSONC-by-convention file patterns.
- `ak-js:config-doctor` inventory scanner now picks up `tsconfig.*.json` variants
  (`tsconfig.base.json`, `tsconfig.app.json`, etc.) via an explicit glob.

## [1.13.0] - 2026-04-07

### ✨ Added

- New plugin `ak-js` — JavaScript project configuration doctor
  - New skill `/ak-js:config-doctor` — zero-config audit of JS/Node project configuration files
    with a 0-100 scored report, A-F grade, and severity-grouped findings (Critical / High /
    Medium / Suggestion)
  - New agent `framework-config-analyzer` — Phase-2 worker for JS/TS framework config
    analysis (Next.js, Vite, Astro, Nuxt, SvelteKit, Tailwind, ESLint Flat Config, PostCSS)
  - 10 bundled JSON Schemas from SchemaStore / canonical upstreams (package.json,
    tsconfig.json, biome.json, vercel.json, turbo.json, nx.json, prettierrc, web-manifest,
    eslintrc, pnpm-workspace) with SchemaStore fallback for extended coverage
  - `.npmrc` INI-format validator with 145-entry npm config keys whitelist and plaintext
    credential detection (flags `_authToken`, `_password`, etc. as Critical)
  - 11 custom cross-file rules catching mismatches no single-file tool sees: missing script
    deps, incompatible `engines.node` vs `tsconfig.target`, `packageManager` lockfile drift,
    publishable-field checks, `type: module` consistency, workspace glob validity, multiple
    lockfile detection, and workspace dependency version drift for singleton libs
    (react/react-dom/vue/svelte/solid-js/rxjs/zustand)
  - Monorepo-aware from day 1 — auto-detects npm/pnpm/yarn/bun/lerna/turbo/nx workspaces
    and reports per-package + workspace-wide findings
  - Read-only by design — never modifies files; fixes are applied by Claude in the
    surrounding conversation
- Marketplace now lists 10 plugins (was 9); top-level description updated to reflect the
  new JavaScript plugin

## [1.12.0] - 2026-04-07

### 🔄 Changed

- Extended `agents-md-improver` skill (ak-knowledge) with Task Completion Workflow check
  - Phase 2: audits existing workflow sections for stale commands, removed skills, renamed tools, and redundant steps
  - Phase 4: delegates missing or stale workflow generation/audit to `/ak-review:workflow` (or `--audit` mode) instead of duplicating detection logic
  - Common Issues: new entry #8 for missing or outdated task completion workflow
- Overhauled Task completion workflow in `AGENTS.md` with explicit Validate, Re-validate, and Version & Changelog steps
  - Step 1 Validate: documents JSON/shellcheck/markdown validation explicitly
  - Step 2 Simplify: prefers `/simplify` skill over `refactoring-expert` agent fallback
  - Step 3 Review: adds critical CodeRabbit evaluation reminder
  - Step 6 Version & Changelog: delegates to `/bump-version` (full automation: 11 files + changelog + commit + tag) with `/ak-meta:changelog` as manual fallback

## [1.11.0] - 2026-04-05

### ✨ Added

- New skill `quality` in ak-meta for assessing plugin component quality across 8 weighted dimensions
  - Two-layer assessment: instant structural review (Layer 1) + expert agent scoring (Layer 2)
  - `--quick` mode for fast structural feedback during development
  - `--compare` mode for side-by-side component comparison with delta analysis
  - Tier ratings: Platinum (90+), Gold (80+), Silver (70+), Bronze (60+)
  - Detects 7 quality issues (RIGID_LANGUAGE, WEAK_DESCRIPTION, MISSING_ACTIVATION, etc.)
- New agent `quality-assessor` in ak-meta for expert scoring on 4 dimensions with anchored rubrics
- New agent `diagram-creator` in ak-meta for Mermaid diagram generation (flowcharts, sequences, ERDs, state diagrams, C4, and more)
- New knowledge file `hypothesis-debugging.md` in ak-improve with structured root cause analysis framework (6 failure mode categories, evidence standards, arbitration protocol)
- New knowledge file `review-dimensions.md` in ak-review with 5 structured review dimensions (Security, Performance, Architecture, Testing, Accessibility) and 58 checklist items
- New knowledge file `wcag-audit-patterns.md` in ak-review with comprehensive WCAG 2.2 coverage across all 4 POUR principles (60+ criteria, remediation patterns, automated testing)

## [1.10.1] - 2026-04-04

### 🔄 Changed

- Renamed `document` skill to `log` in ak-knowledge for clearer intent (`/ak-knowledge:log`)
- Removed `--compact` mode from `log` skill (ak-knowledge) — single execution mode only
- Removed all arguments from `handoff` skill (ak-meta) — simplified to zero-config usage
- Updated all cross-references, documentation, and agent paths for the skill rename

## [1.10.0] - 2026-04-04

### ✨ Added

- New skill `workflow` in ak-review for generating and auditing Task Completion Workflows
  - Default mode: scans project tooling and generates a tailored 6-step workflow for AGENTS.md
  - Audit mode (`--audit`): verifies existing workflow against current project state
  - Detects build tools, test runners, linters, formatters, type checkers, and review tools
  - Falls back to self-review when CodeRabbit CLI is not available

## [1.9.1] - 2026-04-04

### 🔄 Changed

- Rewrote `discover` skill (ak-meta) with fresh terminology and unique phrasing
- Rephrased `performance-optimizer` and `refactoring-expert` agents (ak-improve) with distinct wording
- Simplified root README and expanded AGENTS.md conventions
- Updated ak-git:operations skill documentation for `--` prefixed arguments
- Added hyperlinks to skills, agents, and hooks in README plugin tables
- Aligned discover skill documentation with new terminology

## [1.9.0] - 2026-04-03

### Added

- New plugin `ak-security` with 3 skills (code-security, llm-security, semgrep) and 43 knowledge files covering OWASP Top 10, LLM security, and Semgrep static analysis
- New plugin `ak-react` with 2 skills (react-best-practices, react-doctor) and Vercel Engineering performance guide
- New skill `discover` in ak-meta for divergent idea generation with adversarial filtering
- New skill `agents-md-improver` in ak-knowledge for auditing and improving AGENTS.md files
- New operation `pr` / `ship` in ak-git:operations for commit-push-PR in one step with adaptive PR descriptions
- Git provider auto-detection (GitHub `gh` / GitLab `glab`) in PR creation workflow
- Commit classification (feature vs fix-up) for cleaner PR descriptions

### Changed

- ak-git:operations now supports 5 operations: commit, review, resolve, pr, ship
- ak-meta now has 3 skills (added discover alongside changelog and handoff)
- ak-knowledge now has 4 skills (added agents-md-improver)
- Marketplace expanded from 7 to 9 plugins
- bump-version command updated from 7 to 11 files

## [1.8.0] - 2026-04-03

### Changed

- **BREAKING**: Dissolved `ak-core` plugin — components redistributed to focused plugins
- `ak-review` now includes `finalize` skill and file validation hooks (from ak-core)
- `ak-knowledge` now includes `agents-md` skill (from ak-core)
- Consolidated `validate-all` into `finalize` workflow

### Added

- New plugin `ak-improve` with refactoring-expert and performance-optimizer agents
- New plugin `ak-notifications` with macOS sound and banner notification hooks

### Removed

- Plugin `ak-core` (replaced by ak-review, ak-improve, ak-notifications)
- Standalone `validate-all` skill (consolidated into finalize)

### Migration

Users with ak-core installed should:

1. Uninstall ak-core
2. Install ak-review, ak-improve, ak-notifications

## [1.7.0] - 2026-03-03

### Added

- ✨ ak-git: Automatic ticket detection from branch names — extracts issue IDs (e.g., `ABC-1234`) and prefixes commit messages automatically

## [1.6.0] - 2026-02-27

### Added

- ✨ ak-git: `--force-push` flag for operations skill — uses `git push --force-with-lease` for safe force pushes

### Changed

- 🔄 ak-meta: Changelog skill now commits by default — replaced `--commit` with `--no-commit` opt-out, removed `--fast` and `--update-version` flags
- 📝 README: Added Superpowers Extended to recommended plugins

## [1.5.0] - 2026-02-24

### Added

- ✨ ak-core: agents-md skill now consolidates both CLAUDE.md and AGENTS.md when both exist — identifies the more comprehensive file as base and merges unique sections from the other

## [1.4.0] - 2026-02-22

### Added

- ✨ README: New "Recommended Plugins" section with Chrome DevTools MCP as first companion plugin

### Fixed

- 🐛 README: Corrected ak-core skill count from 1 to 3 (finalize, validate-all, agents-md)
- 🐛 README: Added language specifiers to fenced code blocks (MD040)
- 🐛 markdownlint: Disabled MD060 table column style rule — incompatible with standard Markdown table formatting

## [1.3.0] - 2026-02-22

### Added

- ✨ ak-core: Finalize skill now offers to create a task completion workflow when none exists — detects project tooling and generates project-specific steps

## [1.2.1] - 2026-02-22

### Fixed

- 🐛 ak-core: Removed `Read` from prompt hook matcher — prevents false security blocks when reading .env files

## [1.2.0] - 2026-02-22

### Added

- ✨ ak-core: New `/ak-core:agents-md` skill — converts CLAUDE.md files to AGENTS.md with backward-compatible symlinks
- ✨ Bump-version command now creates git tags after committing

### Changed

- 🔄 Skill count updated from 11 to 12 across the marketplace

## [1.1.3] - 2026-02-22

### Fixed

- 🐛 ak-core: Removed unreliable Stop hook that caused intermittent "JSON validation failed" errors

### Added

- ✨ Project-local `/bump-version` command for synchronized version management across all 7 files

## [1.1.1] - 2026-02-21

### Fixed

- 🐛 ak-core: Changed notification sound to Glass and lowered volume to 50%
- 🐛 ak-core: Strengthened Stop hook JSON response instruction for reliability

### Changed

- 🔄 ak-core: Simplified new hooks and validate-all skill after review

## [1.1.0] - 2026-02-21

### Added

- ✨ JSON syntax validation hook — blocks saving broken JSON files (PostToolUse)
- ✨ ShellCheck validation hook — lints shell scripts on save (PostToolUse)
- ✨ Notification hooks — sound on permission prompt, macOS notification on idle
- ✨ validate-all skill — bundles markdown, JSON, and shell script validation in one command
- ✨ GitHub MCP server recommended as user-global integration

### Changed

- 🔄 ak-core now provides 2 skills (finalize, validate-all) and 3 file validation hooks
- 🔄 Skill count updated from 10 to 11 across the marketplace

## [1.0.1] - 2026-02-21

### Fixed

- 🐛 README.md: Corrected plugin installation instructions (use `/plugin` commands, not CLI)
- 🐛 Stop hook: Fixed JSON validation error by adding required `{"ok": true/false}` response format for prompt-type hooks

## [1.0.0] - 2026-02-21

Initial release as AgentKit — a lean, audited plugin marketplace for Claude Code.

### Added

- ✨ 5 plugins: ak-core, ak-git, ak-meta, ak-review, ak-typo3
- ✨ 10 skills across all plugins
- ✨ 9 specialized agents with active Edit/Write capabilities
- ✨ Markdown formatting hook (markdownlint-cli2)
- ✨ Context-aware skill suggestion hook
- ✨ Quality gate hook for task completeness

### Changed

- 🔄 Rebranded from Claude Code Toolkit to AgentKit
- 🔄 All agents upgraded from read-only to active (Edit/Write tools enabled)
- 🔄 Finalize skill streamlined (removed unused flags and phases)
- 🔄 Skill suggestion prompt generalized (no longer hardcoded skill names)
- 🔄 CKEditor knowledge files referenced in sitepackage skill

### Removed

- 🗑️ ak-security plugin (secure skill, debugging/security agents, Semgrep MCP)
- 🗑️ ak-frontend plugin (frontend/tailwind agents, Alpine.js/Tailwind knowledge)
- 🗑️ ak-core: 4 skills (understand, improve, create, ship)
- 🗑️ ak-core: 10 agents (code-architect, project-planner, documentation-specialist, and others)
- 🗑️ ak-meta: mcp skill and manage-mcp.sh script
- 🗑️ ak-typo3: project-setup-context.md knowledge file
