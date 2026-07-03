# ak-review

Quality assurance plugin for AgentKit. Combines automated code review,
task completion workflow, and file validation hooks.

## Skills

| Skill | Description |
|-------|-------------|
| `coderabbit` | CodeRabbit CLI integration for automated code review |
| `explain` | Explain a code snippet's purpose, mechanics, and notable patterns |
| `finalize` | Project-specific task completion workflow |

## Knowledge

| File | Content |
|------|---------|
| `review-dimensions.md` | 5 review dimensions (Security, Performance, Architecture, Testing, Accessibility) with checklists |
| `wcag-audit-patterns.md` | Comprehensive WCAG 2.2 audit checklist with 60+ criteria, remediation patterns, and automated testing |

## Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| markdown-format | After Write/Edit | Auto-formats .md files via markdownlint-cli2 |
| json-validate | After Write/Edit | Validates JSON syntax |
| shellcheck-validate | After Write/Edit | Lints shell scripts via ShellCheck |
| skill-suggestions | After Write/Edit | Suggests relevant AgentKit skills |

## Usage

/ak-review:coderabbit
/ak-review:explain
/ak-review:finalize

## Requirements

- CodeRabbit CLI (`npm install -g coderabbit`) for code review
- markdownlint-cli2 for markdown formatting (Homebrew or npx)
