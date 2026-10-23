// The fixture mod: the recipe in docs/mods/writing-a-mod.md with Example
// renamed to Fixture (ak-example to ak-fixture). The tests that load it are
// what prove the recipe, so change both together.

import type { Register } from 'claude-code'

export const register: Register = on => {
  const NAME = 'ak-fixture'
  const TOOL = { name: 'probe', description: 'Answers a probe.' }

  // Off only when ak-mods says so. Without ak-mods `$.mods` is missing and
  // the call throws: the mod is on (fail-open).
  const isOff = async (isOn: () => Promise<boolean>): Promise<boolean> => {
    try {
      return !(await isOn())
    } catch {
      return false
    }
  }

  on('session.start', async ($, e, next) => {
    try {
      await $.mods.declare({
        name: NAME,
        title: 'Fixture',
        summary: 'Draws a band above the prompt.',
        details: 'The band says hello. /fixture turns the mod on and opens its pane.',
      })
    } catch {
      // No ak-mods loaded: nothing to declare to, and the mod runs on.
    }
    await $.command.register({ name: 'fixture', description: 'Turn the fixture on and open its pane' })
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

    return <Text>Fixture band</Text>
  })

  // The mod's own command turns it on, then does what it does.
  on('command.run', { command: 'fixture' }, async $ => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) await $.mods.set({ name: NAME, on: true })
    await $.ui.open({ id: NAME, title: 'Fixture' })

    return { text: 'Fixture is on.' }
  })

  // A tool registered earlier in this chat answers that the mod is off.
  on('tool.call', { tool: 'mcp__ak-fixture__probe' }, async ($, e, next) => {
    if (await isOff(() => $.mods.isOn({ name: NAME }))) {
      return { result: `${NAME} is off in this chat. The person can turn it on with /ak-mods.` }
    }

    return { result: 'Probed.' }
  }).catch(($, e, next) => next(e))

  // The model's view while off: a tool registered earlier waits behind
  // ToolSearch, the agent type is not offered.
  on('tool.describe', { tool: 'mcp__ak-fixture__probe' }, async ($, e, next) =>
    (await isOff(() => $.mods.isOn({ name: NAME })))
      ? { description: 'Off in this chat. Do not call it.', isDeferred: true }
      : next(e),
  )
  on('agent.offer', { agent: 'ak-fixture:helper' }, async ($, e, next) =>
    (await isOff(() => $.mods.isOn({ name: NAME }))) ? { isOffered: false } : next(e),
  ).catch(($, e, next) => next(e))

  // This mod's switch changed: register or describe its tool afresh, close
  // its pane when off.
  on('state.set', { plugin: 'ak-mods', key: 'on' }, async ($, e, next) => {
    const done = await next(e)
    const isOn = e.value[NAME] === true
    if (isOn !== (e.previous?.[NAME] === true)) {
      if (isOn) await $.tool.register(TOOL)
      $.ui.invalidate('tool.describe')
      if (!isOn) await $.ui.close({ id: NAME })
    }

    return done
  }).catch(($, e, next) => next(e))
}
