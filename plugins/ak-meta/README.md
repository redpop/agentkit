# ak-meta

Project management utilities plugin for AgentKit.

## Skills

| Skill | Description |
|-------|-------------|
| `changelog` | AI-powered CHANGELOG.md management with automatic version detection |
| `discover` | Surface and stress-test improvement opportunities across any project |
| `handoff` | Documents current problem context for handoff to another AI assistant |
| `quality` | Assess plugin component quality with structural review and expert scoring |

## Agents

| Agent | Description |
|-------|-------------|
| `quality-assessor` | Expert assessor that scores skills and agents on 4 quality dimensions |
| `diagram-creator` | Creates Mermaid diagrams for architecture, flows, ERDs, and system interactions |

## Usage

```bash
/ak-meta:changelog --fast
/ak-meta:discover
/ak-meta:handoff
/ak-meta:quality plugins/ak-review/skills/coderabbit/
/ak-meta:quality plugins/ak-typo3/agents/typo3-architect.md --quick
/ak-meta:quality plugins/ak-git/ --compare plugins/ak-review/
```
