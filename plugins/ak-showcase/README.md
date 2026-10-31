# ak-showcase

A style guide in a pane: every element, prop and variant a hooks module can draw, each sample with
the code that draws it and what does not exist. A mod: turning it on opens the pane, and a demo
segment in the shared band shows every part a segment can carry. Needs `ak-mods`, which installs
with it, switches the mod on or off per chat and draws the band.

Requires Claude Code 2.1.309 or later (hooks-module support).

## Install

```text
/plugin install ak-showcase@ak-marketplace
```

## Use

- `/showcase` opens the pane; `/showcase tone warn` sets the demo segment's tone.
- Eleven sections: text, colours, spacing, layout, hover, buttons, forms, content, graphics, band
  segment, feedback. Each section is one file in `hooks/sections/`, readable as a template.
- The controls are dummies: they only record that they were used. Only the feedback section shows
  a toast or the status line, and the `Link` sample opens the browser.

See [the mod docs](../../docs/mods/ak-showcase/showcase.md).

## Development

```bash
claude plugin validate plugins/ak-showcase
claude plugin test plugins/ak-showcase
```
