import type { Register } from 'claude-code'

import type { Mods } from '../types'
import { initialOn, isAgentKit, namesOf, pruneKeys, rows, savedOf, upsert } from './switches'

// `$` (here `built`) is spelled `built.state.get(REF)` at every call site: the
// engine refuses a module that hands it to a helper, `read` and `update` included.
const DECLARED = { plugin: 'ak-mods', key: 'declared' } as const
const ON = { plugin: 'ak-mods', key: 'on' } as const
const STANDARD = { plugin: 'ak-mods', key: 'standard' } as const

// How many other sessions' switches the store keeps; older ones are dropped at start.
const KEPT_SESSIONS = 100

// Where each loaded plugin came from (`<name>@<marketplace>`, `<name>@inline`),
// as `plugin.register` saw it. A plugin admitted before ak-mods, or before its
// last reload, is not in it and is judged by name alone.
const provenances = new Map<string, string>()

// Whether this load has restored the session's switches. Until it has, `set`
// leaves the store alone: an early write would pass for the saved session and
// hide the one the restore must read. A reload starts it over, and runs
// `session.start` again.
let isRestored = false

export const register: Register = on => {
  on('plugin.register', ($, e, next) => {
    provenances.set(e.name, e.provenance)

    return next(e)
  })

  on('mods.declare', ($, e, next) =>
    isAgentKit(next.origin.plugin, provenances.get(next.origin.plugin)) ? next(e) : { value: false },
  ).catch(($, e, next) => (next.called ? next(e) : { value: false }))

  // A resumed chat gets its saved switches back; a new one starts with the
  // standard set. A mod that wrote its switch earlier in this load (its own
  // `session.start` ran first) keeps it: the restore fills in around it.
  on('session.start', async ($, e, next) => {
    const id = await $.session.id()
    const restored = initialOn(namesOf(await $.store.get('standard')), savedOf(await $.store.get(`session:${id}`)))
    isRestored = true
    for (;;) {
      const held = await $.state.get(ON)
      const value = { ...restored, ...held.value }
      if ((await $.state.set(ON, value, { ifVersion: held.version })).isSet) {
        // Switches written before the restore were kept out of the store.
        if (Object.keys(held.value ?? {}).length > 0) {
          await $.store.set(`session:${id}`, value)
        }
        break
      }
    }

    // The chat being resumed is kept whatever its age: its switches were just read.
    const others = (await $.store.keys()).filter(key => key !== `session:${id}`)
    for (const key of pruneKeys(others, KEPT_SESSIONS)) {
      await $.store.delete(key)
    }

    await $.command.register({
      name: 'ak-mods',
      description: 'Open the Mods pane: turn AgentKit mods on or off for this chat',
    })

    return next(e)
  })

  // `/clear` ends the chat with no new `session.start`: back to the standard set.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await $.state.set(ON, initialOn(namesOf(await $.store.get('standard')), undefined))
      await $.store.delete(`session:${e.sessionId}`)
    }

    return next(e)
  })

  on('engine.create', async ($, e, next) => {
    const built = await next(e)

    // Standard marks persist in the store; the state mirrors them for drawings
    // once this session has written it.
    const standardOf = async (): Promise<string[]> => {
      const held = await built.state.get(STANDARD)
      // Version 0 means this session never wrote the key: the store decides.
      if (held.version > 0 && held.value !== undefined) {
        return held.value
      }

      return namesOf(await built.store.get('standard'))
    }

    const mods: Mods = {
      // Each write is a read, a change and a write at that version, again on a
      // miss, so two calls in one moment both land.
      declare: async ({ name, title, summary, details }) => {
        for (;;) {
          const held = await built.state.get(DECLARED)
          const value = upsert(held.value ?? [], { name, title, summary, details })
          if ((await built.state.set(DECLARED, value, { ifVersion: held.version })).isSet) {
            return true
          }
        }
      },
      isOn: async ({ name }) => {
        const { value: list = [] } = await built.state.get(DECLARED)
        const { value: map = {} } = await built.state.get(ON)

        return list.some(one => one.name === name) && map[name] === true
      },
      // The store keeps the switches under the session's id, read at each
      // call: after a `/clear` the chat goes on under a new one.
      set: async ({ name, on: isOn }) => {
        for (;;) {
          const held = await built.state.get(ON)
          const value = { ...held.value, [name]: isOn }
          if ((await built.state.set(ON, value, { ifVersion: held.version })).isSet) {
            if (isRestored) {
              await built.store.set(`session:${await built.session.id()}`, value)
            }

            return
          }
        }
      },
      setStandard: async ({ name, standard }) => {
        const marked = (await standardOf()).filter(one => one !== name)
        const value = standard ? [...marked, name] : marked
        await built.store.set('standard', value)
        await built.state.set(STANDARD, value)
      },
      list: async () => {
        const { value: list = [] } = await built.state.get(DECLARED)
        const { value: map = {} } = await built.state.get(ON)

        return rows(list, map, await standardOf())
      },
    }

    return { ...built, mods }
  })
}
