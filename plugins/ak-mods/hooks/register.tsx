import type { Register } from 'claude-code'

import type { Mods } from '../types'
import { renderBand } from './band-render'
import { renderPane } from './pane'
import { initialOn, isAgentKit, namesOf, pruneKeys, rows, savedOf, upsert } from './switches'

// `$` (here `built`) is spelled `built.state.get(REF)` at every call site: the
// engine refuses a module that hands it to a helper, `read` and `update` included.
const DECLARED = { plugin: 'ak-mods', key: 'declared' } as const
const ON = { plugin: 'ak-mods', key: 'on' } as const
const STANDARD = { plugin: 'ak-mods', key: 'standard' } as const
const SEGMENTS = { plugin: 'ak-mods', key: 'segments' } as const

// How many other sessions' switches the store keeps; older ones are dropped at start.
const KEPT_SESSIONS = 100

// Where each loaded plugin came from (`<name>@<marketplace>`, `<name>@inline`),
// as `plugin.register` saw it. A plugin admitted before ak-mods, or before its
// last reload, is not in it and is judged by name alone.
const provenances = new Map<string, string>()

// The chat whose switches this load restored, the restore itself, and whether
// its write has settled. A write waits for it, so none lands before the
// restore or under another chat's id. A reload, a `/clear` and a resume start
// it over; a restore they overtake writes nothing.
let restoring: { id: string; done: Promise<void>; isDone: boolean } | undefined

// Restores the current chat's switches unless this load already did; answers
// the chat's id. Set by `engine.create`, which holds what it needs.
let restoreChat: (() => Promise<string>) | undefined

export const register: Register = on => {
  on('plugin.register', ($, e, next) => {
    provenances.set(e.name, e.provenance)

    return next(e)
  })

  // A plugin declares itself alone, and only an AgentKit one.
  on('mods.declare', ($, e, next) =>
    e.name === next.origin.plugin && isAgentKit(next.origin.plugin, provenances.get(next.origin.plugin))
      ? next(e)
      : { value: false },
  ).catch(($, e, next) => (next.called ? next(e) : { value: false }))

  // A mod publishes its own segment alone, and only a declared AgentKit one;
  // any other caller is ignored without an error. The method beneath does
  // not know who called, so the write is made here, keyed by the caller: a
  // read, a change and a write at that version, again on a miss.
  on('mods.segment', async ($, e, next) => {
    const name = next.origin.plugin
    if (!isAgentKit(name, provenances.get(name))) return { value: undefined }
    const { value: declared = [] } = await $.state.get(DECLARED)
    if (!declared.some(one => one.name === name)) return { value: undefined }
    for (;;) {
      const held = await $.state.get(SEGMENTS)
      const { [name]: _, ...others } = held.value ?? {}
      // `$.mods.segment(undefined)` reaches the hook as `{}`: no text clears.
      const value = typeof e?.text === 'string' ? { ...others, [name]: e } : others
      if ((await $.state.set(SEGMENTS, value, { ifVersion: held.version })).isSet) return { value: undefined }
    }
  })

  // The command comes first, so `/ak-mods` exists even if the store fails.
  // Then the chat is restored: a resumed one gets its saved switches back, a
  // new one starts with the standard set.
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ak-mods',
      description: 'Open the Mods pane: turn AgentKit mods on or off for this chat',
    })
    const id = await restoreChat?.()

    // The chat being resumed is kept whatever its age: its switches were just read.
    const others = (await $.store.keys()).filter(key => key !== `session:${id}`)
    for (const key of pruneKeys(others, KEPT_SESSIONS)) {
      await $.store.delete(key)
    }

    return next(e)
  })

  // After a resume no `session.start` follows. Until something writes, the
  // reads answer from the store; the next turn writes the new chat's
  // switches into the state, so every mod sees its own switch change.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await restoreChat?.()
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // `/clear` ends the chat with no new `session.start`: back to the standard
  // set. A resume puts another chat in its place, also with none: the state
  // is emptied and the new chat restored under its own id, by the next write
  // or turn. The old chat's switches stay in the store, so a later resume of
  // it gets them back; pruning ages them out.
  on('session.end', async ($, e, next) => {
    // Segments belong to the chat that showed them, whatever ends it.
    await $.state.set(SEGMENTS, {})
    if (e.reason === 'clear' || e.reason === 'resume') {
      restoring = undefined
      await $.state.set(
        ON,
        e.reason === 'clear' ? initialOn(namesOf(await $.store.get('standard')), undefined) : {},
      )
    }

    return next(e)
  })

  on('command.run', { command: 'ak-mods' }, async $ => {
    await $.ui.open({ id: 'ak-mods', title: 'Mods' })

    return { text: 'Opened the Mods pane.' }
  })

  on('ui.render', { component: 'Pane', requestId: 'ak-mods' }, ($, e) => renderPane($, e))

  // The shared band above the prompt, drawn from every switched-on mod's segment.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => renderBand($, e, next))

  on('engine.create', async ($, e, next) => {
    const built = await next(e)

    // The saved switches replace the state whole: nothing of another chat
    // is carried over. A `/clear` or a resume while a restore reads the
    // store overtakes it: it writes only while it is still the current
    // restore, at the version it read, so the end's own write is never
    // undone. The chat then current is restored in its place.
    const restore = async (): Promise<string> => {
      for (;;) {
        const id = await built.session.id()
        if (restoring?.id !== id) {
          const current = { id, done: Promise.resolve(), isDone: false }
          current.done = (async () => {
            const [standard, saved] = await Promise.all([built.store.get('standard'), built.store.get(`session:${id}`)])
            const value = initialOn(namesOf(standard), savedOf(saved))
            for (;;) {
              const held = await built.state.get(ON)
              if (restoring !== current) return
              if ((await built.state.set(ON, value, { ifVersion: held.version })).isSet) break
            }
            current.isDone = true
          })()
          restoring = current
          // A failed restore is tried again by the next write.
          current.done.catch(() => {
            if (restoring === current) restoring = undefined
          })
        }
        const awaited = restoring
        await awaited.done
        if (restoring === awaited) {
          return id
        }
      }
    }
    restoreChat = restore

    // The current chat's switches, without writing (a drawing may not): the
    // state once this load restored the chat, else what the restore writes.
    // It never waits for a restore: a mod's `state.set` hook asks while the
    // restore's write waits for that hook. The state is read either way, so
    // a drawing redraws on a change.
    const switches = async (): Promise<Record<string, boolean>> => {
      const [id, { value: map = {} }] = await Promise.all([built.session.id(), built.state.get(ON)])
      if (restoring?.id === id && restoring.isDone) {
        return map
      }
      const [standard, saved] = await Promise.all([built.store.get('standard'), built.store.get(`session:${id}`)])

      return initialOn(namesOf(standard), savedOf(saved))
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

        return list.some(one => one.name === name) && (await switches())[name] === true
      },
      // The store keeps the switches under the chat's id: after a `/clear`
      // or a resume the process goes on under another. The switch lands in
      // the chat current when it lands: one that ended since the restore is
      // restored over again first. A write at the version read lands before
      // the end's or not at all, so what the store gets is that chat's own.
      set: async ({ name, on: isOn }) => {
        for (;;) {
          const id = await restore()
          const held = await built.state.get(ON)
          if (restoring?.id !== id) continue
          const value = { ...held.value, [name]: isOn }
          if ((await built.state.set(ON, value, { ifVersion: held.version })).isSet) {
            await built.store.set(`session:${id}`, value)
            break
          }
        }
        // A mod switched off shows nothing in the band.
        while (!isOn) {
          const held = await built.state.get(SEGMENTS)
          if (held.value?.[name] === undefined) return
          const { [name]: _, ...others } = held.value
          if ((await built.state.set(SEGMENTS, others, { ifVersion: held.version })).isSet) return
        }
      },
      // Standard marks persist in the store, shared by every chat; it is read
      // afresh at each change, so a mark another chat set meanwhile stays. The
      // state mirrors them, so a drawing that lists them redraws on a change.
      // The chat is restored first: a new mark does not switch it.
      setStandard: async ({ name, standard }) => {
        await restore()
        const marked = namesOf(await built.store.get('standard')).filter(one => one !== name)
        const value = standard ? [...marked, name] : marked
        await built.store.set('standard', value)
        await built.state.set(STANDARD, value)
      },
      list: async () => {
        const { value: list = [] } = await built.state.get(DECLARED)
        const map = await switches()
        // Read for the subscription; the store decides.
        await built.state.get(STANDARD)

        return rows(list, map, namesOf(await built.store.get('standard')))
      },
      // The `mods.segment` hook above makes the write: only it knows the
      // caller. Reached without it (the hook failed), nothing is stored.
      segment: async () => {},
    }

    return { ...built, mods }
  })
}
