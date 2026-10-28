# AGENTS.md

> `CLAUDE.md` is a symlink pointing to this file.

This file provides guidance to AI agents (Claude Code, Warp AI, etc.) when working with the AgentKit repository.

## Project overview

Claude Code plugin marketplace (`ak-marketplace`) with 14 independently installable plugins, 25 skills, 8 agents, a mod switcher with three mods,
and domain knowledge bases. Built on the official Claude Code Plugin Architecture.

## Dev environment

No build step required — the codebase is Markdown, JSON, and shell scripts, plus four TSX
hooks modules (`ak-mods`, `ak-keepwarm`, `ak-session-id`, `ak-usage`) that Claude Code loads directly.

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

**Validate and test the hooks modules (`ak-mods` and its mods):**

```bash
claude plugin validate plugins/ak-mods
claude plugin test plugins/ak-mods
claude plugin test plugins/ak-mods/tests/fixture
claude plugin validate plugins/ak-keepwarm
claude plugin test plugins/ak-keepwarm
claude plugin validate plugins/ak-session-id
claude plugin test plugins/ak-session-id
claude plugin validate plugins/ak-usage
claude plugin test plugins/ak-usage
```

The third command loads the test-only fixture mod with `ak-mods` absent and proves it fails
open. `tests/fixture/` is a harness (version 0.0.0), not a plugin: it gets no marketplace entry.

Type-check (zero errors expected). `claude -p` never lays `.claude-plugin/types/`, so build a
tsconfig outside the repo from the API declarations the plugin-authoring skill ships
(`$DTS` = its `types/claude-code.d.ts`; the fixture and the mods also need the `ak-mods`
contract). The file
exists once a Claude Code session has loaded the `plugin-authoring` skill, which names its folder;
the path varies per machine and Claude Code version; with several, the recipe takes the newest
version. It runs in a subshell and stops there if `$DTS` is empty, leaving your shell open.

```bash
(
T=$(mktemp -d); R=$(git rev-parse --show-toplevel)
DTS=$(find /private/tmp -path '*plugin-authoring/types/claude-code.d.ts' 2>/dev/null | sort -V | tail -n 1)
[ -n "$DTS" ] || { echo "claude-code.d.ts not found: load the plugin-authoring skill first" >&2; exit 1; }
mkdir -p "$T/types/claude-code" "$T/fx/claude-code" "$T/fx/ak-mods"
cp "$DTS" "$T/types/claude-code/index.d.ts"; cp "$DTS" "$T/fx/claude-code/index.d.ts"
cp "$R/plugins/ak-mods/types/index.d.ts" "$T/fx/ak-mods/"
O='"target":"es2023","lib":["es2023"],"types":[],"module":"esnext","moduleResolution":"bundler","strict":true,"noUncheckedIndexedAccess":true,"noEmit":true,"skipLibCheck":true,"jsx":"react","jsxFactory":"h","jsxFragmentFactory":"Fragment"'
F=$R/plugins/ak-mods
echo "{\"compilerOptions\":{$O},\"include\":[\"$T/types\",\"$F/hooks\",\"$F/types\",\"$F/tests\"]}" > "$T/mods.json"
echo "{\"compilerOptions\":{$O},\"include\":[\"$T/fx\",\"$F/tests/fixture\"]}" > "$T/fixture.json"
K=$R/plugins/ak-keepwarm
echo "{\"compilerOptions\":{$O},\"include\":[\"$T/fx\",\"$K/hooks\",\"$K/tests\"]}" > "$T/keepwarm.json"
S=$R/plugins/ak-session-id
echo "{\"compilerOptions\":{$O},\"include\":[\"$T/fx\",\"$S/hooks\",\"$S/tests\"]}" > "$T/session-id.json"
U=$R/plugins/ak-usage
echo "{\"compilerOptions\":{$O},\"include\":[\"$T/fx\",\"$U/hooks\",\"$U/tests\"]}" > "$T/usage.json"
npx -y -p typescript@5 tsc -p "$T/mods.json" && npx -y -p typescript@5 tsc -p "$T/fixture.json" &&
  npx -y -p typescript@5 tsc -p "$T/keepwarm.json" && npx -y -p typescript@5 tsc -p "$T/session-id.json" &&
  npx -y -p typescript@5 tsc -p "$T/usage.json"
)
```

**Validate the CodeRabbit config:**

```bash
coderabbit config validate
```

`.coderabbit.yaml` holds review scope and path-specific instructions. It deliberately does not
repeat the conventions in this file — CodeRabbit discovers `AGENTS.md` on its own.

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
├── hooks/register.tsx             ← Hooks modules (TSX, optional; ak-mods and its mods)
├── types/index.d.ts               ← Types a plugin adds to `$` (optional; ak-mods)
└── README.md
```

| Plugin | Skills | Agents | Extras |
| -------- | -------- | -------- | -------- |
| `ak-review` | 9 | - | hooks, markdownlint config, knowledge/ (4 files), own AGENTS.md |
| `ak-git` | 1 | 2 | |
| `ak-meta` | 4 | 2 | |
| `ak-improve` | - | 2 | knowledge/ (1 file) |
| `ak-knowledge` | 4 | 1 | |
| `ak-mods` | - | - | hooks module (TSX), types/ |
| `ak-keepwarm` | - | - | hooks module (TSX), tests/, LICENSE (upstream MIT) |
| `ak-session-id` | - | - | hooks module (TSX), tests/ |
| `ak-usage` | - | - | hooks module (TSX), tests/ |
| `ak-notifications` | - | - | hooks |
| `ak-react` | 2 | - | knowledge/ (1 file) |
| `ak-security` | 3 | - | knowledge/ (43 files) |
| `ak-js` | 1 | 1 | knowledge/ (13 files) |
| `ak-writing` | 1 | - | knowledge/ (2 files), evals/ |

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

Required: `name`, `description`, `version`. Optional: `hooks` (path to hooks.json), `mcpServers`
(path to .mcp.json), `types` (path to the `.d.ts` contract a hooks module adds to `$`),
`dependencies` (plugins installed with it, such as `["ak-mods"]` for a mod).

### marketplace.json

Each plugin entry needs `name`, `source` (relative path), `version`, `category`.

### Skill arguments

All skill arguments use `--` prefix for consistency: `--commit`, `--push`, `--ship`. The `$ARGUMENTS` placeholder receives the raw user input; the skill parses flags from it.

### Hooks (hooks.json)

Two forms. Shell hooks use the wrapper `{"description": "...", "hooks": {...}}`; the
`${CLAUDE_PLUGIN_ROOT}` variable resolves to the plugin's absolute directory at runtime, and hook
scripts must always `exit 0`. A hooks module (`ak-mods` and its mods) names TypeScript files
instead: `{ "modules": ["./register.tsx"] }`.

## Commit and PR guidelines

Rules for `git log`, not review criteria for diffs.

- Subject: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`), scoped by plugin where one
  applies — `feat(ak-react): add hydration mismatch rule`. Imperative, **72 characters max**, which
  is about 55 after a `feat(ak-knowledge):` prefix. Readable on its own — `git log --oneline`
  shows nothing else.
- Body: blank line, wrapped at 72, answers **why**; the diff is the what. A mechanical change gets
  no body at all.
- **Never in a body**: measurements, test output, rebase archaeology, rejected alternatives,
  session narration ("as requested"). Correcting an earlier commit's claim is why, and stays.
- One reason per paragraph, about 15 lines. More belongs in `docs/solutions/`, linked from one line
  in the body.

Versions stay synchronized across `marketplace.json` and all `plugin.json` files (currently
`1.50.0`) — that one **is** checkable in a diff. The one exception is the test-only harness
`plugins/ak-mods/tests/fixture`, which stays at `0.0.0`.

## Task completion workflow

After implementing changes, follow the task-completion skill
(`.claude/skills/task-completion/SKILL.md`): validate → simplify → review →
docs → re-validate → version & changelog.

## Important conventions

- Agents can analyze code and implement changes directly (Edit/Write tools enabled)
- Knowledge files are referenced explicitly in agents via `${CLAUDE_PLUGIN_ROOT}/knowledge/path`
- The `$ARGUMENTS` placeholder receives user input in skills
- Documentation is written in English
- **This repository is public: nothing in it may point to a real project.** No client or project
  name, real ticket key, person or local path in a skill, doc, example, test or changelog. Ticket
  examples are `ABC-123` or `ABC-XXXX`, paths are `/Users/you/…`. A finding from a real project is
  described by what was measured, never by where. Session handoffs (`docs/handoffs/`) are
  gitignored for this reason
- When adding, removing, or modifying plugins, skills, agents, or hooks, update the corresponding documentation in `docs/` (detail files and index READMEs) and the root `README.md` plugin table
- The `markdown-format.sh` hook requires `markdownlint-cli2` (Homebrew preferred, npx fallback)
- Before debugging from scratch, check `docs/solutions/` for previously documented fixes and reusable patterns — the project knowledge base grows via `/ak-knowledge:log` and is organized by track (bug fixes and knowledge/best-practices)
- **When you add a case to something, hunt down every sentence that still describes only the old one.** A behaviour
  that gains a second case leaves stale claims behind — in the same file, in a contract table above it, on a doc
  page, in a test's name. This is the most frequent defect in this repo's own history: it occurred five times while
  building the `setup` skill for 1.21.0, every time caught by a review and never by the author, and the fifth was
  created by the fix for the fourth. Adding the branch is the easy half; the search afterwards is the work. Grep for
  the _old case's wording_ across the plugin and `docs/`, not just the line you edited
