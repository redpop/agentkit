# Validation Hooks

> Quality assurance hooks: file validation after edits.

## Overview

Runs automatic validation on files after every Write, Edit, or MultiEdit tool use. Checks
Markdown formatting, JSON syntax, and shell script quality.

## Hooks

### Markdown Format Check

- **Trigger:** `PostToolUse` on `Write|Edit|MultiEdit`
- **Action:** Runs `markdown-format.sh`, which passes `--fix` to markdownlint-cli2 — the hook
  rewrites the file, it does not only report. Set `"fix": false` in a project config to make it
  report-only
- **Requirements:** `markdownlint-cli2` (Homebrew preferred, npx fallback)
- **Rules:** project config if one exists, otherwise the plugin defaults — see
  [Customizing Markdown rules per project](#customizing-markdown-rules-per-project)

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

## Customizing Markdown rules per project

The Markdown hook walks up the directory tree from the edited file looking for a markdownlint config.
If it finds one, the plugin config is skipped entirely and `markdownlint-cli2` resolves the project
config itself. Only without a project config does the hook fall back to
`plugins/ak-review/hooks/config/.markdownlint-cli2.jsonc`.

To override the rules, drop a config in your project root — `.markdownlint-cli2.jsonc` / `.yaml` /
`.cjs` / `.mjs` (options wrapper, also accepts `fix` and `ignores`), or `.markdownlint.jsonc` /
`.json` / `.yaml` / `.yml` / `.cjs` / `.mjs` (rule config only):

```jsonc
// .markdownlint-cli2.jsonc
{
  "config": {
    "default": true,
    "MD013": { "line_length": 100, "code_blocks": false, "tables": false },
    "MD033": false
  },
  "fix": true,
  "ignores": ["**/node_modules/**", "**/vendor/**"]
}
```

Two things to know:

- A project config **replaces** the plugin config, it does not merge with it. Anything you leave out
  falls back to markdownlint's defaults, not AgentKit's. To keep them, copy the `config` object from
  the plugin config as a starting point — `extends` does not work, since it expects a flat rule
  config while the plugin file wraps its rules in `config`.
- The `-cli2` variants have no `.json` or `.yml` form — `markdownlint-cli2` reads neither, so a file
  named `.markdownlint-cli2.json` is silently ignored and the plugin defaults stay in effect. Use
  `.jsonc` / `.yaml` there; only the plain `.markdownlint.*` names accept `.json` and `.yml`.

### Using Prettier alongside the hook

Prettier formats Markdown too, so a project that runs it via an npm script can end up in a loop: the
hook rewrites what Prettier just wrote, and vice versa. In practice this comes down to a single rule
— the plugin config pins `MD049` to `asterisk` while Prettier emits `_italic_`. markdownlint's own
defaults are Prettier-compatible, since the style rules default to `consistent` and accept whatever
Prettier produces.

Let one tool format and the other only report:

```jsonc
// .markdownlint-cli2.jsonc
{
  "config": {
    "default": true,
    "MD013": { "line_length": 100, "code_blocks": false, "tables": false }
  },
  "fix": false
}
```

The project config drops the plugin's `MD049` pin, and `"fix": false` overrides the `--fix` the hook
always passes, so markdownlint reports but never writes. Note that Prettier does not wrap prose by
default (`proseWrap: "preserve"`), which MD013 cannot fix — either disable MD013 or set Prettier to
`"proseWrap": "always"` with `printWidth` equal to `line_length`.

If you would rather keep the hook as the Markdown formatter — say Prettier is only in the project for
JS and CSS — invert it instead: add `*.md` to `.prettierignore` and leave `"fix": true`. What matters
is that exactly one of the two writes to Markdown; `fix` is the switch that decides which.

## Best Practices

- Install `markdownlint-cli2` and `shellcheck` before using this plugin for full validation
- All hook scripts exit 0 to avoid blocking Claude Code even on validation failures
- Validation output appears in Claude's context so it can self-correct issues
