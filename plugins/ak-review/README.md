# ak-review

Quality assurance plugin for AgentKit. Combines automated code review,
task completion workflow, and file validation hooks.

## Skills

| Skill | Description |
|-------|-------------|
| `coderabbit` | CodeRabbit CLI integration for automated code review |
| `finalize` | Project-specific task completion workflow |

## Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| markdown-format | After Write/Edit | Auto-formats .md files via markdownlint-cli2 |
| json-validate | After Write/Edit | Validates JSON syntax |
| shellcheck-validate | After Write/Edit | Lints shell scripts via ShellCheck |
| skill-suggestions | After Write/Edit | Suggests relevant AgentKit skills |

## Usage

/ak-review:coderabbit
/ak-review:finalize

## Requirements

- CodeRabbit CLI (`npm install -g coderabbit`) for code review
- markdownlint-cli2 for markdown formatting (Homebrew or npx)
