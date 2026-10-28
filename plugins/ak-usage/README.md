# ak-usage

Shows how full this session's context is and how much of the account's 5-hour limit is used. A mod:
one compact segment in the shared band above the prompt, `ctx ▬▬▬▬▬  5h ▬▬▬▬▬`, each bar's empty
cells dim. Needs `ak-mods`, which installs with it, switches the mod on or off per chat and draws
the band.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Install

```text
/plugin install ak-usage@ak-marketplace
```

## Use

- `ctx` is this session's context; `5h` is the account's 5-hour window, every session counted, as
  this session's last response reported it.
- Each figure is a bar of five cells. `7d` joins from 75 %. A figure from 75 % adds its percentage
  and draws in the warning colour, from 90 % in the error colour. The Mods pane shows every
  percentage.

See [the mod docs](../../docs/mods/ak-usage/usage.md).

## Credit

Inspired by Token Weather from claude-code-playground (Anthropic, Apache-2.0). No code is taken
over.

## Development

```bash
claude plugin validate plugins/ak-usage
claude plugin test plugins/ak-usage
```
