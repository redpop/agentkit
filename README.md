# AgentKit

Modular plugin marketplace for [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
with skills, specialized agents, and domain knowledge bases.

## Plugins

| Plugin | Skills | Agents | Description |
|--------|--------|--------|-------------|
| **ak-core** | 3 | 2 | Task completion workflow, refactoring and performance agents, markdown formatting hooks |
| **ak-git** | 1 | 2 | Git operations, smart commits, conflict resolution |
| **ak-meta** | 2 | - | Changelog generation, AI context handoff |
| **ak-review** | 1 | - | CodeRabbit CLI integration |
| **ak-typo3** | 5 | 5 | TYPO3 v13.4 development (Content Blocks, SitePackage, extensions) |

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
/plugin install ak-core@ak-marketplace
/plugin install ak-git@ak-marketplace
/plugin install ak-meta@ak-marketplace
/plugin install ak-review@ak-marketplace
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
/ak-core:finalize

# Code review
/ak-review:coderabbit

# Generate changelog
/ak-meta:changelog

# TYPO3 sitepackage
/ak-typo3:sitepackage my-site
```

## Recommended Plugins

Companion plugins from the Claude Code marketplace that work well with AgentKit:

| Plugin | Description | Install |
|--------|-------------|---------|
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Browser automation, screenshots, and DevTools access | See below |

### Chrome DevTools MCP

```text
/plugin marketplace add ChromeDevTools/chrome-devtools-mcp
/plugin install chrome-devtools-mcp
```

Requires Node.js v20.19+ and Chrome.

## Previous Version

The pre-plugin architecture (v6.x, `install.sh`-based) is archived at [redpop/claude-code-toolkit-legacy](https://github.com/redpop/claude-code-toolkit-legacy).

## License

MIT
