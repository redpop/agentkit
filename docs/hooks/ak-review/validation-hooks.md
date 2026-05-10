# Validation Hooks

> Quality assurance hooks: file validation after edits.

## Overview

Runs automatic validation on files after every Write, Edit, or MultiEdit tool use. Checks
Markdown formatting, JSON syntax, and shell script quality.

## Hooks

### Markdown Format Check

- **Trigger:** `PostToolUse` on `Write|Edit|MultiEdit`
- **Action:** Runs `markdown-format.sh` to validate and auto-fix Markdown files via markdownlint-cli2
- **Requirements:** `markdownlint-cli2` (Homebrew preferred, npx fallback)

### JSON Validation

- **Trigger:** `PostToolUse` on `Write|Edit|MultiEdit`
- **Action:** Runs `json-validate.sh` to check JSON syntax on written/edited JSON files
- **Requirements:** Python 3 (`python3 -m json.tool`)

### ShellCheck Validation

- **Trigger:** `PostToolUse` on `Write|Edit|MultiEdit`
- **Action:** Runs `shellcheck-validate.sh` to lint shell scripts for common issues
- **Requirements:** `shellcheck` (install via Homebrew or package manager)

## Configuration

Defined in `plugins/ak-review/hooks/hooks.json`. All command hooks reference scripts via
`${CLAUDE_PLUGIN_ROOT}/hooks/` which resolves to the plugin's install directory at runtime.

## Best Practices

- Install `markdownlint-cli2` and `shellcheck` before using this plugin for full validation
- All hook scripts exit 0 to avoid blocking Claude Code even on validation failures
- Validation output appears in Claude's context so it can self-correct issues
