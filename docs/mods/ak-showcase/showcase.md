# Showcase (`ak-showcase`)

A style guide in a pane: every element, prop and variant a hooks module can draw, each sample with
the code that draws it, and what does not exist.

Requires Claude Code 2.1.309 or later (hooks-module support). Switched per chat in the
[Mods pane](../ak-mods/switcher.md); turning it on opens the pane, and `/showcase` turns the mod on
and opens it too.

## Why

Before building a mod you want to know what the pane can draw: which buttons, fields, colours and
spacings exist, what hover does, where a tooltip is possible and where not. The showcase answers
that by drawing it, on the surface you are looking at. A coding agent reads the same thing in the
source: each section is one file in `plugins/ak-showcase/hooks/sections/`, a sample beside the
props that draw it.

## Command

| Command | Effect |
| --- | --- |
| `/showcase` | Turns the mod on and opens the pane |
| `/showcase tone <ok\|warn\|alert\|info\|dim>` | Sets the tone of the demo segment in the band |
| `/showcase demo <check\|clear>` | What the demo segment's menu actions run: only records itself as the last action |

## Pane

A picker at the top chooses one of eleven sections: a `Select` where the surface draws one, a row
of buttons on the mobile app. Under it, the last action a control reported.

| Section | What it shows |
| --- | --- |
| Text | `size`, `weight`, `bold` to `tabular`, the `wrap` modes on a long line |
| Colours | Every theme key as `color` and `backgroundColor`, fixed colours beside them |
| Spacing | The `Space` steps `xs` to `xl` and numbers, as `gap` and as `padding` |
| Layout and borders | `flexDirection`, `justifyContent`, `alignItems`, border styles and colours, a card |
| Hover | `hover` on a Box, a Text and a whole row |
| Buttons | Default, `primary`, `secondary`, `dimColor`, `plain`, `role="dismiss"`, `autoFocus`, `hover`, `hotkey`, Text children, a glyph as label, a menu built from Buttons |
| Forms | `Input` on one line and on several, `Select`, and a toggle built from buttons or a Select |
| Content | `Code` as source and as a diff, `Markdown`, `Link` |
| Graphics | `Svg` as an image and with `isInteractive` (CSS hover, animation, a `<title>` tooltip) |
| Band segment | The parts of the demo segment, and its tone to change |
| Feedback | A toast, the status line set and cleared |

Each section ends with what does not exist, such as a tooltip outside an interactive Svg, a button
in a colour of its own, a checkbox or a disabled state, and with a note where a surface draws
differently. The desktop app does not paint theme keys on `Text`, and a `Button` there draws only
its label.

## Dummy controls

Every control in the pane only records itself: a press, a typed value or a pick lands in the pane's
own state and shows as the last action. None of them submits a prompt, runs a command or a tool,
or reaches a file, a process or the network. The tests press, type and pick every control in every
section and check that.

The exceptions show something on purpose: the feedback section's three buttons show a toast or set
and clear the status line, and the `Link` sample opens the browser, as a `Link` always does. The
Markdown sample's link goes to the pane instead (`pressableLinks`), so it opens nothing.

## Band

While on, the mod shows one demo segment in the band that [`ak-mods`](../ak-mods/switcher.md)
draws above the prompt. It carries one of every part a segment can have:

| Part | In the demo |
| --- | --- |
| `text`, `parts` | `Showcase 60%`, the word dim |
| `rich` | A check icon and a ring filled to 60 % on the desktop app |
| `compact` | `SC 60%`, or the ring alone, when the band is short of room |
| `card` | The tone and the ring as rows in the Mods pane |
| `settings` | A tone picker in the mod's card in the Mods pane, which runs `/showcase tone …` |
| `button` | **open**, in the Mods pane only (`isPaneOnly`) |
| `actions` | Two dummy actions in the `⋯` menu of the open card in the Mods pane, never in the band |
| `tone`, `priority` | The tone picked, priority 1: the first segment to go when the band is full |

Without `ak-mods` (or when it refuses the mod, or a publish fails), the mod draws its own band
instead, never both: `Showcase` and an **open** button.

The pane's texts follow Claude Code's `language` setting, else `LC_ALL`, `LC_MESSAGES` or `LANG`:
German or English. Prop names and code stay as they are.

## What it does not show

`Raster` and `Image` (terminal only) and `Client` (a surface module of the plugin's own) are named
but not drawn. The terminal has no `Svg`; its graphics section says so.
