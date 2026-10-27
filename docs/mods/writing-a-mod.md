# Writing an AgentKit mod

> The contract every AgentKit mod follows, so the Mods pane can switch it on and off per chat.

## What a mod is

A mod is a plugin whose hooks module changes Claude Code's own interface: a segment in the shared
band above the prompt, a pane, a status entry, a slash command, a model tool. Each mod is its own
plugin (`plugins/ak-<name>/`), installable on its own. `ak-mods` lists every mod that declared
itself and holds one switch per mod for the current chat. A mod is off until someone turns it on,
unless it is marked standard.

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
into `.claude-plugin/types/ak-mods/`. That types `$.mods`, the segment it takes, and the
`state.set` hook on `ak-mods`'s `on` switches for `tsc` and the editor; without the dependency,
`$.mods` does not type-check. A mod
needs `"types"` in its `plugin.json` only if it adds a noun of its own to `$`.

`claude plugin validate` checks the mod's own code. It lists the mod's hooks, the
`state.set{plugin=ak-mods, key=on}` hook among them, and its calls on `$`, the `$.mods` ones
among them. Nothing in the mod has to change for it.

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
  // Counts this mod's switch changes, so a republish scheduled for one change
  // is dropped once another followed it. A read of the switch in the delayed
  // call has been seen to answer as of the earlier change; the count does not
  // depend on that read.
  let switches = 0

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

  // The mod's part of the shared band. ak-mods draws it while the mod is on
  // and clears it on switch-off and when the chat ends. Publish it again
  // whenever what it shows changes.
  const SEGMENT = { text: 'Example segment', tone: 'ok' } as const

  // Publishes while ak-mods switches the mod and it is on. A publish that
  // throws hands the drawing back to the mod's own band (fail-open).
  const publish = async (isOn: () => Promise<boolean>, send: () => Promise<void>) => {
    if (!isSwitched || (await isOff(isOn))) return
    try {
      await send()
    } catch {
      isSwitched = false
    }
  }

  on('session.start', async ($, e, next) => {
    try {
      isSwitched = await $.mods.declare({
        name: NAME,
        title: 'Example',
        summary: 'Shows a segment in the band above the prompt.',
        details: 'The segment says hello. /example turns the mod on and opens its pane.',
      })
    } catch {
      isSwitched = false
    }
    await $.command.register({ name: 'example', description: 'Turn the example on and open its pane' })
    // The tool exists only once the mod is on: here, or when it is switched on.
    if (!(await isOff(() => $.mods.isOn({ name: NAME })))) await $.tool.register(TOOL)
    await publish(() => $.mods.isOn({ name: NAME }), () => $.mods.segment(SEGMENT))

    return next(e)
  })

  // /clear, /resume and /branch end the chat, and ak-mods clears every
  // segment with it. A publish for a mod that is off is not drawn.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    await publish(() => $.mods.isOn({ name: NAME }), () => $.mods.segment(SEGMENT))

    return next(e)
  }).catch(($, e, next) => next(e))

  // The mod's own band, drawn only while ak-mods does not switch the mod:
  // otherwise ak-mods draws its segment, never both.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isSwitched) return next(e)

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
  // its tool afresh; when on, publish its segment again (ak-mods cleared it
  // at the switch-off); when off, clear its status line and close its pane.
  // The publish runs off this hook: from inside it, within ak-mods's `set`,
  // a segment call resolves without reaching ak-mods.
  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    const done = await next(e)
    const isOn = e.value[NAME] === true
    if (isSwitched && done.value?.isSet === true && isOn !== (e.previous?.[NAME] === true)) {
      const change = ++switches
      if (isOn) {
        await $.tool.register(TOOL)
        $.clock.after(0, () => {
          if (change !== switches) return
          // A publish that failed hands the drawing back: draw the own band.
          publish(async () => true, () => $.mods.segment(SEGMENT)).then(() => $.ui.invalidate('ui.render'))
        })
      }
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
- **The band is shared.** `ak-mods` owns one band above the prompt for all mods. A mod does not
  draw a band beside it: it publishes one segment with `$.mods.segment(...)`, and `ak-mods` draws
  the segments of the switched-on mods. A segment is plain data: `text`, an optional `tone` (`ok`,
  `warn`, `alert`, `info` or `dim`; `ak-mods` picks the colour), an optional `priority` (default
  5; higher stays longer) and at most one `button` (`label`, an optional `hotkey`, the `command` it
  runs, its `args`). The button runs a slash command the mod already answers, so no handler crosses
  from one plugin to another. When two mods ask for one hotkey, the first by title keeps it.
- **One segment per mod.** Publishing again replaces it; `$.mods.segment(undefined)` clears it.
  `ak-mods` clears it itself when the mod is switched off and when the chat ends, whatever ends it.
  So the mod publishes at `session.start`, again whenever what the segment shows changes, after a
  switch-on, and after `/clear`, `/resume` and `/branch` (a `classic.SessionStart` hook). It
  publishes nothing while off.
- **A publish from a `state.set` hook on the switches does not reach `ak-mods`; schedule it off
  the hook with `$.clock.after(0, ...)`.** That hook runs inside `ak-mods`'s own `set`, where a
  segment call resolves without being stored. A switch-off right after has been seen to read as on
  in the delayed call, so the recipe counts the switch changes and drops a publish scheduled for an
  earlier one.
- **When the band runs out of room** it degrades in steps: one row; then two rows, never more; then
  the segments with the lowest priority drop out (ties by title) and a `+N` chip ends the band.
  The chip opens the Mods pane, which names the dropped mods: `N mods do not fit the band: …`.
  There is no toast.
- **On the desktop app** `ak-mods` shows the same segments as one label in the footer: the texts
  joined with ` · `, one line, a segment with a button ending with its slash command (`/keepwarm`),
  and `+N` when the lowest-priority segments drop out. The mod does nothing extra for it. The
  footer's width is provisional (60 characters) until it is checked on the desktop app.
- **The mod's own band is the fail-open path.** While `isSwitched` is false (no `ak-mods`, or it
  refused the mod), the mod draws its own single band and publishes nothing. A publish that throws
  turns `isSwitched` false, so the mod draws its own band again. While `isSwitched` is true it
  draws no band: one owner at a time, never two bands.
- **Other drawings** (a pane, a status entry) read `ak-mods`'s `on` switches first. The read
  subscribes the drawing, so switching the mod on or off redraws it without a reload. While off, a
  drawing returns `next(e)` and draws nothing.
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
  again) and only when the mod's own switch changed. Then the hook registers the tool and schedules
  the publish when on, asks for `tool.describe` again (the engine caches its answer) and, when
  off, clears the mod's status line with `$.ui.status(undefined)` and closes its pane with
  `$.ui.close`. The hook reads the switches from `e.value` and may ask `$.mods.isOn` or
  `$.mods.list`, but never calls `$.mods.set`: the write that raised it may be the chat's restore,
  which waits for the hook while `set` waits for the restore.
- **Gating hooks** (`tool.call`, `agent.offer`, `state.set`, and the `classic.SessionStart` hook of
  the republish after `/clear`, `/resume` and `/branch`) carry `.catch(($, e, next) => next(e))`: a
  guard that fails leaves the mod on, as fail-open asks.

## Testing

`ak-mods` cannot be loaded inline in another plugin's tests, so a mod's own `claude plugin test`
runs without it and covers the "on" path and its own band. The off path and the shared band are
proven once, against the real `ak-mods`: `plugins/ak-mods/tests/fixture/mod.tsx` is this recipe as
`ak-fixture`. Its folder is a test-only harness plugin at version `0.0.0`, outside the
repository's version bump and the marketplace.

```bash
claude plugin validate plugins/ak-example
claude plugin test plugins/ak-example
# The recipe itself: with ak-mods (contract tests), and with no ak-mods at all
claude plugin test plugins/ak-mods
claude plugin test plugins/ak-mods/tests/fixture
```

`tests/contract.test.tsx` loads the fixture with `ak-mods`: off draws nothing and leaves the
engine's drawing, switching on shows the segment in the shared band without a reload, a mod on from
the start shows it, switching off clears it, a quick switch-off drops the scheduled publish,
`/branch` and `/clear` keep the segment of a mod that stays on, the command turns the mod on, the
tool is registered only once the mod is on, after switching off it is hidden and its call says how
to turn the mod on, the agent type is withheld while off, switching off closes the pane and clears
the status line, a switch write that did not land changes nothing, and a `declare` that `ak-mods`
refuses or that throws leaves the mod on and drawing its own band.
`tests/fixture/fail-open.test.tsx` loads it without `ak-mods` and finds it on, drawing its own band.
When you change the recipe, change the fixture with it. This prints nothing while the two match:

```bash
diff <(sed -n '/^import/,$p' plugins/ak-mods/tests/fixture/mod.tsx |
  sed 's/fixture/example/g; s/Fixture/Example/g') \
  <(sed -n '/^```tsx$/,/^```$/p' docs/mods/writing-a-mod.md | sed '1d;$d')
```

To test a mod's publish path in its own tests, stand in for `ak-mods`, as
`plugins/ak-keepwarm/tests/keepwarm.test.tsx` does. The stand-in is a test-only inline plugin:

- It is named `ak-mods`, at `tier: 'prepend'`. Only under that name are the switches it writes
  `ak-mods`'s state, which the mod's `state.set` hook on `{ plugin: 'ak-mods', key: 'on' }`
  hears.
- Its `engine.create` hook adds a fake `mods` noun: `declare` switches the mod on, `isOn` and `set`
  read and write the `on` switches, and `segment` reports each segment as a toast the test reads.
- It registers a command (`/stand-in on|off|…`) that the test runs to switch the mod. The test's
  own `$` carries no plugin's nouns.
- It models the blind spot above: a `segment` call made while its `set` runs is dropped. A
  stand-in that stores it would pass a mod that publishes from inside the switch hook, which the
  real `ak-mods` loses.
