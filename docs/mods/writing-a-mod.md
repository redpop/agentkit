# Writing an AgentKit mod

> The contract every AgentKit mod follows, so the Mods pane can switch it on and off per chat.

## What a mod is

A mod is a plugin whose hooks module changes Claude Code's own interface: a band above the prompt,
a pane, a status entry, a slash command, a model tool. Each mod is its own plugin
(`plugins/ak-<name>/`), installable on its own. `ak-mods` lists every mod that declared itself and
holds one switch per mod for the current chat. A mod is off until someone turns it on, unless it is
marked standard.

## plugin.json and hooks.json

Beside the usual `name`, `description` and `version`, a mod's `.claude-plugin/plugin.json` lists
`ak-mods` as a dependency:

```json
{
  "name": "ak-example",
  "dependencies": ["ak-mods"]
}
```

`hooks/hooks.json` names the hooks module that holds the recipe below:

```json
{ "modules": ["./register.tsx"] }
```

Installing the mod then brings the switcher along. When a session loads the mod from a development
folder (`--plugin-dir`, the mods folder) next to `ak-mods`, the engine lays the `ak-mods` contract
into `.claude-plugin/types/ak-mods/`. That types `$.mods` and the read of `ak-mods`'s `on`
switches for `tsc` and the editor; without the dependency, `$.mods` does not type-check. A mod
needs `"types"` in its `plugin.json` only if it adds a noun of its own to `$`.

`claude plugin validate` checks the mod's own code. It lists the read of `ak-mods.on` under "state
of other plugins, not checked": that read is checked against the `ak-mods` contract only in a
session that has both plugins loaded. Nothing in the mod has to change for it.

## The recipe

Copy this into `hooks/register.tsx`, rename `ak-example`, `example` and `Example` to your mod's
name, and drop the parts your mod does not have (the tool, the agent type, the pane).

```tsx
import type { Register } from 'claude-code'

export const register: Register = on => {
  const NAME = 'ak-example'
  const TOOL = { name: 'probe', description: 'Answers a probe.' }

  // Whether ak-mods switches this mod: false once its declare was refused or
  // threw (no ak-mods loaded, or it failed). Then the mod runs on.
  let isSwitched = true

  // Off only when ak-mods switches the mod and says so. A call that throws
  // leaves the mod on (fail-open).
  const isOff = async (isOn: () => Promise<boolean>): Promise<boolean> => {
    if (!isSwitched) return false
    try {
      return !(await isOn())
    } catch {
      return false
    }
  }

  on('session.start', async ($, e, next) => {
    try {
      isSwitched = await $.mods.declare({
        name: NAME,
        title: 'Example',
        summary: 'Draws a band above the prompt.',
        details: 'The band says hello. /example turns the mod on and opens its pane.',
      })
    } catch {
      isSwitched = false
    }
    await $.command.register({ name: 'example', description: 'Turn the example on and open its pane' })
    // The tool exists only once the mod is on: here, or when it is switched on.
    if (!(await isOff(() => $.mods.isOn({ name: NAME })))) await $.tool.register(TOOL)

    return next(e)
  })

  // Every drawing: read the switches first (the read subscribes the drawing,
  // so a switch redraws it), then draw nothing while off.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await $.state.get({ plugin: 'ak-mods', key: 'on' })
    if (await isOff(() => $.mods.isOn({ name: NAME }))) return next(e)

    const { Text } = $.ui.resolve(e)

    return <Text>Example band</Text>
  })

  // The mod's own command turns it on, then does what it does.
  on('command.run', { command: 'example' }, async $ => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) await $.mods.set({ name: NAME, on: true })
    await $.ui.open({ id: NAME, title: 'Example' })

    return { text: 'Example is on.' }
  })

  // A tool registered earlier in this chat answers that the mod is off.
  on('tool.call', { tool: 'mcp__ak-example__probe' }, async ($, e, next) => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) {
      return { result: `${NAME} is off in this chat. The person can turn it on with /ak-mods.` }
    }

    return { result: 'Probed.' }
  }).catch(($, e, next) => next(e))

  // The model's view while off: a tool registered earlier waits behind
  // ToolSearch, the agent type is not offered.
  on('tool.describe', { tool: 'mcp__ak-example__probe' }, async ($, e, next) =>
    (await isOff(() => $.mods.isOn({ name: NAME })))
      ? { description: 'Off in this chat. Do not call it.', isDeferred: true }
      : next(e),
  )
  on('agent.offer', { agent: 'ak-example:helper' }, async ($, e, next) =>
    (await isOff(() => $.mods.isOn({ name: NAME }))) ? { isOffered: false } : next(e),
  ).catch(($, e, next) => next(e))

  // This mod's switch changed, and the write landed: register or describe
  // its tool afresh; when off, clear its status line and close its pane.
  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    const done = await next(e)
    const isOn = e.value[NAME] === true
    if (isSwitched && done.value?.isSet === true && isOn !== (e.previous?.[NAME] === true)) {
      if (isOn) await $.tool.register(TOOL)
      $.ui.invalidate('tool.describe')
      if (!isOn) {
        $.ui.status(undefined)
        await $.ui.close({ id: NAME })
      }
    }

    return done
  }).catch(($, e, next) => next(e))
}
```

## The rules

- **Fail-open.** A mod that `ak-mods` does not switch runs as on. Without `ak-mods`, `$.mods` is
  missing and every call on it throws; `isOff` turns that into "on". `declare` sits in its own
  `try`: when it resolves `false` (`ak-mods` refused the mod) or throws, `isSwitched` turns false,
  `isOff` answers "on" from then on, and the mod's command does not ask `ak-mods` to switch it. So
  a mod loaded alone (while you develop it), or one `ak-mods` refused, behaves as on and never
  throws, and its command's "is on" is true.
- **`isOff` takes the call, not `$`.** The engine lets `$` be passed only to a function declared at
  the top of the module, and the test kit loads an inline plugin's `register` on its own, without
  the rest of its file. A helper inside `register` that receives the call is valid in both, so the
  same code runs in a mod and in the tests.
- **Drawings** read `ak-mods`'s `on` switches first. The read subscribes the drawing, so switching
  the mod on or off redraws it without a reload. While off, a drawing returns `next(e)` and draws
  nothing.
- **Every other hook** returns `next(e)` while off, except the mod's own `tool.call` (below).
- **The mod's own command turns it on**, then does what it does. Commands stay listed while the
  mod is off.
- **Model tools are registered once the mod is switched on.** `session.start` registers the tool
  when the mod is on, and the `state.set` hook registers it when the mod is switched on
  (`$.tool.register` works mid-session, from the next prompt on). A tool cannot be unregistered:
  after a switch-off it stays registered but deferred, `tool.describe` moving it behind ToolSearch
  with a note that it is off, and its `tool.call` answers that the mod is off in this chat and can
  be turned on with `/ak-mods`.
- **Agent types are hidden while off:** `agent.offer` answers `{ isOffered: false }`.
- **A switch change** reaches a mod outside a drawing through a `state.set` hook on `ak-mods`'s
  `on` key. It acts only on a write that landed (`done.value?.isSet`; a missed write is raised
  again) and only when the mod's own switch changed. Then the hook registers the tool when on, asks
  for `tool.describe` again (the engine caches its answer) and, when off, clears the mod's status
  line with `$.ui.status(undefined)` and closes its pane with `$.ui.close`.
- **Gating hooks** (`tool.call`, `agent.offer`, `state.set`) carry `.catch(($, e, next) => next(e))`:
  a guard that fails leaves the mod on, as fail-open asks.

## Testing

`ak-mods` cannot be loaded inline in another plugin's tests, so a mod's own `claude plugin test`
runs without it and covers the "on" path. The off path is proven once, in `ak-mods`:
`plugins/ak-mods/tests/fixture/mod.tsx` is this recipe as `ak-fixture`. Its folder is a test-only
harness plugin at version `0.0.0`, outside the repository's version bump and the marketplace.

```bash
claude plugin validate plugins/ak-example
claude plugin test plugins/ak-example
# The recipe itself: with ak-mods (contract tests), and with no ak-mods at all
claude plugin test plugins/ak-mods
claude plugin test plugins/ak-mods/tests/fixture
```

`tests/contract.test.tsx` loads the fixture with `ak-mods`: off draws nothing and leaves the
engine's drawing, switching on draws the band without a reload, the command turns the mod on, the
tool is registered only once the mod is on, after switching off it is hidden and its call says how
to turn the mod on, the agent type is withheld while off, switching off closes the pane and clears
the status line, a switch write that did not land changes nothing, and a `declare` that `ak-mods`
refuses or that throws leaves the mod on.
`tests/fixture/fail-open.test.tsx` loads it without `ak-mods` and finds it on. When you change the
recipe, change the fixture with it. This prints nothing while the two match:

```bash
diff <(sed -n '/^import/,$p' plugins/ak-mods/tests/fixture/mod.tsx |
  sed 's/fixture/example/g; s/Fixture/Example/g') \
  <(sed -n '/^```tsx$/,/^```$/p' docs/mods/writing-a-mod.md | sed '1d;$d')
```
