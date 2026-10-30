# AgentKit Documentation

Reference documentation for all AgentKit components — skills, agents, hooks, and mods.

## Overview

AgentKit provides 16 plugins with specialized skills, agents, hooks, and mods for Claude Code.

| Category | Count | Description |
|----------|-------|-------------|
| [Skills](skills/) | 26 | Slash commands invoked by the user |
| [Agents](agents/) | 8 | Specialized sub-agents for autonomous tasks |
| [Hooks](hooks/) | 8 plugins | Automated actions on tool events |
| [Mods](mods/) | 5 plugins | Interface changes that the Mods pane switches on or off per chat |

## Plugins

| Plugin | Focus | Skills | Agents | Hooks |
|--------|-------|--------|--------|-------|
| ak-git | Git workflow automation | 1 | 2 | — |
| ak-gitlab | GitLab mod (merge request and pipeline) | — | — | hooks module |
| ak-improve | Code optimization | — | 2 | — |
| ak-js | JavaScript/Node tooling | 1 | 1 | — |
| ak-keepwarm | Keep-warm mod (prompt cache pings) | — | — | hooks module |
| ak-knowledge | Solution documentation | 4 | 1 | — |
| ak-meta | Discovery & release management | 4 | 2 | — |
| ak-mods | Mod switcher (Mods pane, shared band) | — | — | hooks module |
| ak-notifications | macOS notifications | — | — | yes |
| ak-pause | Break mod (time without a break, water) | — | — | hooks module |
| ak-react | React/Next.js development | 2 | — | — |
| ak-review | Code quality assurance | 9 | — | yes |
| ak-security | Security guidelines | 3 | — | — |
| ak-session-id | Session-id mod (copy the id) | — | — | hooks module |
| ak-usage | Usage mod (context and 5-hour limit) | — | — | hooks module |
| ak-writing | Prose quality, AI-slop removal, clear German technical docs | 2 | — | — |
