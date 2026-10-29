# Mods

A mod is a plugin whose hooks module changes Claude Code's own interface: a segment in the band
above the prompt, a pane, a status entry, a slash command, a model tool. The `ak-mods` plugin lists
the AgentKit mods in a pane, switches each on or off per chat, and draws the one band they share.

Requires Claude Code 2.1.309 or later (hooks-module support).

## AgentKit mods

| Mod | Plugin | Purpose |
|-----|--------|---------|
| [Mod switcher](ak-mods/switcher.md) | ak-mods | The Mods pane: ○ Off / ● On, ☆ / ★ Standard, and a chevron for details per mod; the shared band |
| [Keep warm](ak-keepwarm/keepwarm.md) | ak-keepwarm | Keeps the prompt cache warm with a small ping before it expires |
| [Session id](ak-session-id/session-id.md) | ak-session-id | Copies this session's id, to tell another session's agent which one is meant |
| [Usage](ak-usage/usage.md) | ak-usage | Shows the context fill and the 5-hour limit as one compact segment |

## Writing a mod

[Writing an AgentKit mod](writing-a-mod.md) holds the contract and the recipe every mod follows so
the pane can switch it.
