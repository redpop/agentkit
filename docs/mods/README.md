# Mods

A mod is a plugin whose hooks module changes Claude Code's own interface: a band above the prompt,
a pane, a status entry, a slash command, a model tool. The `ak-mods` plugin lists the AgentKit mods
in a pane and switches each on or off per chat.

Requires Claude Code 2.1.309 or later (hooks-module support).

## AgentKit mods

| Mod | Plugin | Purpose |
|-----|--------|---------|
| [Mod switcher](ak-mods/switcher.md) | ak-mods | The Mods pane: ○ Off / ● On, ☆ / ★ Standard, and More/Less per mod |
| [Keep warm](ak-keepwarm/keepwarm.md) | ak-keepwarm | Keeps the prompt cache warm with a small ping before it expires |

## Writing a mod

[Writing an AgentKit mod](writing-a-mod.md) holds the contract and the recipe every mod follows so
the pane can switch it.
