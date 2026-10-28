# ak-usage

Shows how full this session's context is and how much of the account's 5-hour limit is used. A mod:
one compact segment in the shared band above the prompt, `ctx 67% · 5h 42%`. Needs `ak-mods`, which
installs with it, switches the mod on or off per chat and draws the band.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Install

```text
/plugin install ak-usage@ak-marketplace
```

## Use

- `ctx` is this session's context; `5h` is the account's 5-hour window, every session counted, as
  this session's last response reported it.
- `7d` joins from 75 %. The colour follows the fullest figure: yellow from 75 %, red from 90 %.

See [the mod docs](../../docs/mods/ak-usage/usage.md).

## Credit

Inspired by Token Weather from claude-code-playground (Anthropic, Apache-2.0). No code is taken
over.

## Development

```bash
claude plugin validate plugins/ak-usage
claude plugin test plugins/ak-usage
```
