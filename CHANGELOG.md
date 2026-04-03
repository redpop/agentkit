# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
