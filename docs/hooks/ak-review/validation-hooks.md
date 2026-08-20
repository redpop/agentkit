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

Prettier formats Markdown too, so a project that runs it via an npm script can end up fighting the
hook: the hook rewrites what Prettier just wrote, and vice versa. In practice this comes down to two
rules — the plugin config pins `MD049`/`MD050` to `asterisk` while Prettier emits `_italic_` and
`**bold**`.

markdownlint's own defaults leave the style rules on `consistent`, which is Prettier-compatible
**only for files with a uniform emphasis style**. On mixed style, `consistent` normalizes to
whichever marker appears first in the file — if that happens to be an asterisk, markdownlint fixes
toward it and Prettier reverts it on the next run. Not an infinite loop, but a one-shot
counter-format per file: diff noise, no benefit.

**Recommended — calibrate the rules to Prettier's output.** Pin only the two rules that can disagree
with Prettier, and drop what Prettier already owns:

```jsonc
// .markdownlint.jsonc
{
  "MD049": { "style": "underscore" }, // italic: Prettier emits _text_
  "MD050": { "style": "asterisk" }, // bold: Prettier emits **text**

  // Line length is Prettier's concern (proseWrap), not a lint error
  "MD013": false
}
```

Unlike `consistent`, this follows Prettier's output regardless of file content, so the direction is
deterministic instead of depending on what happens to appear first. Both tools stay fully active and
the hook can keep using `--fix`. Reach for this whenever Prettier formats Markdown in the project —
the common case once it runs via an npm script. Prettier does not wrap prose by default
(`proseWrap: "preserve"`), which MD013 cannot match — either disable MD013 as above, or set Prettier
to `"proseWrap": "always"` with `printWidth` equal to `line_length`.

**Alternative — make the hook report-only**, if you'd rather have Prettier own Markdown formatting
end to end:

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

This drops the plugin's `MD049`/`MD050` pins, and `"fix": false` overrides the `--fix` the hook
always passes, so markdownlint reports but never writes. The cost is auto-fix for every rule, not
just the two that can disagree with Prettier.

**Alternative — keep the hook as the Markdown formatter**, if Prettier in the project only handles JS
and CSS and never touches Markdown: add `*.md` to `.prettierignore` and leave `"fix": true`. If
Prettier does format Markdown in the project, this gives up table alignment and a consistent
`proseWrap` for no reason — calibrating the rules keeps both.

Whichever option you pick, exactly one of the two tools should hold the deciding vote on each rule;
`fix` and the rule pins are the switches that decide which.

## Best Practices

- Install `markdownlint-cli2` and `shellcheck` before using this plugin for full validation
- All hook scripts exit 0 to avoid blocking Claude Code even on validation failures
- Validation output appears in Claude's context so it can self-correct issues
