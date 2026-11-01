import type { Register } from 'claude-code'

import { learnLanguage, texts } from './i18n'

export const register: Register = on => {
  const NAME = 'ak-todo'

  // Whether ak-mods switches this mod: false once its declare was refused or
  // threw (no ak-mods loaded, or it failed). Then the mod runs on.
  let isSwitched = true

  on('session.start', async ($, e, next) => {
    const t = texts(await learnLanguage($))
    try {
      isSwitched = await $.mods.declare({ name: NAME, title: t.title, summary: t.summary, details: t.details })
    } catch {
      isSwitched = false
    }

    return next(e)
  })
}
