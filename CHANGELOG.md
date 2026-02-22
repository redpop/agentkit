# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
