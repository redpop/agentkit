// The fixture mod: the recipe in docs/mods/writing-a-mod.md with Example
// renamed to Fixture (ak-example to ak-fixture). The tests that load it are
// what prove the recipe, so change both together.

import type { Register } from 'claude-code'

export const register: Register = on => {
  const NAME = 'ak-fixture'
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
  const SEGMENT = { text: 'Fixture segment', tone: 'ok' } as const

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
        title: 'Fixture',
        summary: 'Shows a segment in the band above the prompt.',
        details: 'The segment says hello. /fixture turns the mod on and opens its pane.',
      })
    } catch {
      isSwitched = false
    }
    await $.command.register({ name: 'fixture', description: 'Turn the fixture on and open its pane' })
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
