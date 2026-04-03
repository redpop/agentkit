# AgentKit

Modular plugin marketplace for [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
with skills, specialized agents, and domain knowledge bases.

## Plugins

| Plugin | Skills | Agents | Description |
|--------|--------|--------|-------------|
| **ak-git** | 1 | 2 | Smart commits, change analysis, conflict resolution |
| **ak-improve** | — | 2 | Code refactoring and performance optimization agents |
| **ak-knowledge** | 3 | 1 | Solution docs, knowledge maintenance, AGENTS.md migration |
| **ak-meta** | 2 | — | Changelog generation, AI context handoff |
| **ak-notifications** | — | — | macOS sound and banner notifications |
| **ak-review** | 2 | — | CodeRabbit review, finalize workflow, validation hooks |
| **ak-typo3** | 5 | 5 | TYPO3 v13.4 Content Blocks, SitePackage, extensions |

See [Plugin Details](#plugin-details) for a full breakdown of every
skill and agent.

## Installation

Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code) v1.0.33 or later.

### Step 1: Add the marketplace

Open Claude Code and run:

```text
/plugin marketplace add redpop/agentkit
```

### Step 2: Install plugins

Install all plugins:

```text
/plugin install ak-review@ak-marketplace
/plugin install ak-git@ak-marketplace
/plugin install ak-meta@ak-marketplace
/plugin install ak-improve@ak-marketplace
/plugin install ak-knowledge@ak-marketplace
/plugin install ak-notifications@ak-marketplace
/plugin install ak-typo3@ak-marketplace
```

Or browse available plugins interactively with `/plugin` and go to the **Discover** tab.

### Install from a local clone

If you prefer to work from a local copy:

```bash
git clone https://github.com/redpop/agentkit.git
```

Then in Claude Code:

```text
/plugin marketplace add /path/to/agentkit
```

And install plugins as described above.

## Quick Start

```bash
# Smart git commit
/ak-git:operations commit --smart

# Run task completion workflow
/ak-review:finalize

# Code review
/ak-review:coderabbit

# Generate changelog
/ak-meta:changelog

# Document a solved problem
/ak-knowledge:document

# TYPO3 sitepackage
/ak-typo3:sitepackage my-site
```

## Plugin Details

### ak-git — Smart Git Operations

Intelligent Git workflow assistance with smart commit messages, change
analysis, and conflict resolution.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| `/ak-git:operations` | Smart commits, conflict resolution, change review | `/ak-git:operations commit --smart` |

#### Agents

| Agent | Purpose |
|-------|---------|
| git-conflict-specialist | Merge conflict analysis, resolution strategies, rebase issues |
| git-workflow-specialist | Commit message generation, branch management, atomic commit strategies |

### ak-improve — Code Improvement

Code improvement agents for refactoring and performance optimization.

#### Agents

| Agent | Purpose |
|-------|---------|
| performance-optimizer | Bottleneck identification, memory leak analysis, algorithmic optimization |
| refactoring-expert | Code refactoring with clean code principles and design patterns |

### ak-knowledge — Solution Documentation

Capture solved problems as structured, searchable solution documents
and keep them up to date.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| `/ak-knowledge:agents-md` | Convert CLAUDE.md files to AGENTS.md with symlinks | `/ak-knowledge:agents-md` |
| `/ak-knowledge:document` | Document a recently solved problem for team knowledge | `/ak-knowledge:document` |
| `/ak-knowledge:refresh` | Review and maintain solution docs against current codebase | `/ak-knowledge:refresh` |

#### Agents

| Agent | Purpose |
|-------|---------|
| solution-reviewer | Validate generated solution docs for completeness and clarity |

### ak-meta — Project Management Tools

Changelog generation with automatic version detection and AI context
handoff for cross-session collaboration.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| `/ak-meta:changelog` | Update CHANGELOG.md with automatic version detection | `/ak-meta:changelog` |
| `/ak-meta:handoff` | Create context handoff documents for other AI sessions | `/ak-meta:handoff` |

### ak-notifications — macOS Notifications

Platform-specific notification hooks for Claude Code.

#### Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| Sound alert | Permission prompt | Plays Glass.aiff sound |
| Desktop banner | Idle prompt | Shows macOS notification |

### ak-review — Quality Assurance

Automated code review, task completion workflow, and file validation
hooks with markdown formatting.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| `/ak-review:coderabbit` | Run CodeRabbit review on uncommitted or staged changes | `/ak-review:coderabbit` |
| `/ak-review:finalize` | Run the task completion workflow (format, simplify, review) | `/ak-review:finalize` |

#### Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| markdown-format | After Write/Edit | Auto-formats .md files via markdownlint-cli2 |
| json-validate | After Write/Edit | Validates JSON syntax |
| shellcheck-validate | After Write/Edit | Lints shell scripts via ShellCheck |
| skill-suggestions | After Write/Edit | Suggests relevant AgentKit skills |

### ak-typo3 — TYPO3 v13.4 Development

TYPO3 CMS development with Content Blocks, Fluid components, extension
scaffolding, and SitePackage generation.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| `/ak-typo3:content-blocks` | Generate Content Blocks v1.3 with modern field configs | `/ak-typo3:content-blocks Hero` |
| `/ak-typo3:extension-kickstarter` | Create extensions via ext-kickstarter or manual scaffolding | `/ak-typo3:extension-kickstarter` |
| `/ak-typo3:fluid-components` | Generate Fluid v4 Components with Atomic Design patterns | `/ak-typo3:fluid-components Button` |
| `/ak-typo3:make-content-block` | Wrapper for `make:content-block` with smart defaults | `/ak-typo3:make-content-block` |
| `/ak-typo3:sitepackage` | Create a TYPO3 v13.4 SitePackage with Site Sets | `/ak-typo3:sitepackage my-site` |

#### Agents

| Agent | Purpose |
|-------|---------|
| typo3-architect | Enterprise CMS architecture, extension design, performance optimization |
| typo3-content-blocks-specialist | Content Block creation, field configuration, backend previews |
| typo3-extension-developer | Extension development, Extbase controllers, service configuration |
| typo3-fluid-expert | Fluid template architecture, ViewHelper development, rendering optimization |
| typo3-typoscript-expert | TypoScript configuration, Site Sets, data processing chains |

## Recommended Plugins

Official Claude Code plugins that work well with AgentKit. Install
via `/plugin` in Claude Code:

| Plugin | Description |
|--------|-------------|
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Browser automation, screenshots, and DevTools access. Requires Node.js v20.19+ and Chrome. |
| [Superpowers Extended](https://github.com/obra/superpowers) | Agentic skills framework with task management and structured development methodology. |

## Previous Version

The pre-plugin architecture (v6.x, `install.sh`-based) is archived at [redpop/claude-code-toolkit-legacy](https://github.com/redpop/claude-code-toolkit-legacy).

## License

MIT
