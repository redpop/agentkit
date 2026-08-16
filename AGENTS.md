# AGENTS.md

> `CLAUDE.md` is a symlink pointing to this file.

This file provides guidance to AI agents (Claude Code, Warp AI, etc.) when working with the AgentKit repository.

## Project overview

Claude Code plugin marketplace (`ak-marketplace`) with 10 independently installable plugins, 28 skills, 13 agents, and domain knowledge bases. Built on the official Claude Code Plugin Architecture.

## Dev environment

No build step required — the codebase is pure Markdown, JSON, and shell scripts.

**Test a plugin locally:**

```bash
claude --plugin-dir ./plugins/ak-review
```

**Test full marketplace:**

```bash
claude plugin marketplace add .
```

**Validate markdown formatting:**

```bash
markdownlint-cli2 "plugins/**/*.md"
```

**Validate JSON files:**

```bash
python3 -m json.tool .claude-plugin/marketplace.json > /dev/null
python3 -m json.tool plugins/ak-review/.claude-plugin/plugin.json > /dev/null
```

**Validate shell scripts:**

```bash
shellcheck plugins/ak-review/hooks/markdown-format.sh
```

## Monorepo structure

This is a monorepo — each plugin directory can contain its own AGENTS.md for plugin-specific context. The closest AGENTS.md to the edited file takes precedence.

```
.claude-plugin/marketplace.json    ← Root marketplace config
plugins/{plugin-name}/
├── .claude-plugin/plugin.json     ← Plugin metadata
├── skills/{skill}/SKILL.md        ← Slash commands (/plugin:skill args)
├── agents/{name}.md               ← Sub-agents (via Task tool)
├── knowledge/                     ← Domain reference files (optional)
├── hooks/hooks.json               ← Hook definitions (optional)
└── README.md
```

| Plugin | Skills | Agents | Extras |
| -------- | -------- | -------- | -------- |
| `ak-review` | 8 | - | hooks, markdownlint config, knowledge/ (2 files) |
| `ak-git` | 1 | 2 | |
| `ak-meta` | 4 | 2 | |
| `ak-improve` | - | 2 | knowledge/ (1 file) |
| `ak-knowledge` | 4 | 1 | |
| `ak-notifications` | - | - | hooks |
| `ak-react` | 2 | - | knowledge/ (1 file) |
| `ak-security` | 3 | - | knowledge/ (43 files) |
| `ak-typo3` | 5 | 5 | knowledge/ (14 files) |
| `ak-js` | 1 | 1 | knowledge/ (13 files) |

## Code style guidelines

### SKILL.md format

```yaml
---
name: skill-name
description: When this skill should be used
---
```

Body: Arguments parsing (`$ARGUMENTS`), Execution workflow, Output format template. Skills route to agents via `Task tool with subagent_type="{agent-name}"`.

### Agent .md format

```yaml
---
name: agent-name-kebab-case
description: |
  When to invoke this agent.
  <example>Use when...</example>
---
```

Body: Identity statement, Core expertise, Knowledge references (`${CLAUDE_PLUGIN_ROOT}/knowledge/`), Methodology (numbered phases), Output format. Target 60-120 lines.

### plugin.json

Required: `name`, `description`, `version`. Optional: `hooks` (path to hooks.json), `mcpServers` (path to .mcp.json).

### marketplace.json

Each plugin entry needs `name`, `source` (relative path), `version`, `category`.

### Skill arguments

All skill arguments use `--` prefix for consistency: `--commit`, `--push`, `--ship`. The `$ARGUMENTS` placeholder receives the raw user input; the skill parses flags from it.

### Hooks (hooks.json)

Wrapper format: `{"description": "...", "hooks": {...}}`. The `${CLAUDE_PLUGIN_ROOT}` variable resolves to the plugin's absolute directory at runtime. Hook scripts must always `exit 0`.

## Commit and PR guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Scope by plugin when applicable: `feat(ak-typo3): add content block field type`
- Keep versions synchronized across `marketplace.json` and all `plugin.json` files (currently `1.21.1`)

## Task completion workflow

After implementing changes, follow the task-completion skill
(`.claude/skills/task-completion/SKILL.md`): validate → simplify → review →
docs → re-validate → version & changelog.

## Important conventions

- Agents can analyze code and implement changes directly (Edit/Write tools enabled)
- Knowledge files are referenced explicitly in agents via `${CLAUDE_PLUGIN_ROOT}/knowledge/path`
- The `$ARGUMENTS` placeholder receives user input in skills
- Documentation is written in English
- When adding, removing, or modifying plugins, skills, agents, or hooks, update the corresponding documentation in `docs/` (detail files and index READMEs) and the root `README.md` plugin table
- The `markdown-format.sh` hook requires `markdownlint-cli2` (Homebrew preferred, npx fallback)
- Before debugging from scratch, check `docs/solutions/` for previously documented fixes and reusable patterns — the project knowledge base grows via `/ak-knowledge:log` and is organized by track (bug fixes and knowledge/best-practices)
- **When you add a case to something, hunt down every sentence that still describes only the old one.** A behaviour
  that gains a second case leaves stale claims behind — in the same file, in a contract table above it, on a doc
  page, in a test's name. This is the most frequent defect in this repo's own history: it occurred five times while
  building the `setup` skill for 1.21.0, every time caught by a review and never by the author, and the fifth was
  created by the fix for the fourth. Adding the branch is the easy half; the search afterwards is the work. Grep for
  the *old case's wording* across the plugin and `docs/`, not just the line you edited
