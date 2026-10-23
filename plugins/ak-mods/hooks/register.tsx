import type { Register } from 'claude-code'

import type { Mods } from '../types'
import { isAgentKit, rows, upsert } from './switches'

// `$` (here `built`) is spelled `built.state.get(REF)` at every call site: the
// engine refuses a module that hands it to a helper, `read` and `update` included.
const DECLARED = { plugin: 'ak-mods', key: 'declared' } as const
const ON = { plugin: 'ak-mods', key: 'on' } as const
const STANDARD = { plugin: 'ak-mods', key: 'standard' } as const

// Where each loaded plugin came from (`<name>@<marketplace>`, `<name>@inline`),
// as `plugin.register` saw it. A plugin admitted before ak-mods, or before its
// last reload, is not in it and is judged by name alone.
const provenances = new Map<string, string>()

export const register: Register = on => {
  on('plugin.register', ($, e, next) => {
    provenances.set(e.name, e.provenance)

    return next(e)
  })

  on('mods.declare', ($, e, next) =>
    isAgentKit(next.origin.plugin, provenances.get(next.origin.plugin)) ? next(e) : { value: false },
  ).catch(($, e, next) => (next.called ? next(e) : { value: false }))

  on('engine.create', async ($, e, next) => {
    const built = await next(e)

    // Standard marks persist in the store; the state mirrors them for drawings
    // once this session has written it.
    const standardOf = async (): Promise<string[]> => {
      const held = await built.state.get(STANDARD)
      if (held.version > 0 && held.value !== undefined) {
        return held.value
      }

      const stored = await built.store.get('standard')

      return Array.isArray(stored) ? stored.filter((name): name is string => typeof name === 'string') : []
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
      set: async ({ name, on: isOn }) => {
        for (;;) {
          const held = await built.state.get(ON)
          const value = { ...held.value, [name]: isOn }
          if ((await built.state.set(ON, value, { ifVersion: held.version })).isSet) {
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
