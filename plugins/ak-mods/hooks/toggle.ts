import type { EngineInterface } from 'claude-code'

const PANE = { id: 'ak-mods', title: 'Mods' } as const

/**
 * Opens the Mods pane, or closes it while it is the one shown. A pane behind
 * another tab, or one waiting unplaced, is opened: that brings it forward. A
 * list that fails counts as closed. Before an open the band's width (see
 * `bandWidth`) is recorded, so the pane counts the band's cut; a failed write
 * still opens it.
 */
export async function togglePane($: EngineInterface, width: number | undefined): Promise<'opened' | 'closed'> {
  const panes = await $.ui.panes().catch(() => [])
  if (panes.some(pane => pane.id === PANE.id && pane.isShown)) {
    await $.ui.close({ id: PANE.id })

    return 'closed'
  }
  if (width !== undefined) {
    await $.state.set({ plugin: 'ak-mods', key: 'width' }, width).catch(() => undefined)
  }
  await $.ui.open(PANE)

  return 'opened'
}

/**
 * What a press on a segment in the band asks for: the Mods pane with that
 * mod's row open alone, scrolled into view, where its card rows and details
 * show. Pressed again while that is so, the row closes and the pane with it,
 * as the band was before the first press. One row open at a time keeps the
 * pane short enough to see the one asked for. The width is recorded as by
 * `togglePane`.
 */
export async function toggleMod($: EngineInterface, width: number | undefined, name: string): Promise<'opened' | 'closed'> {
  const [panes, held] = await Promise.all([
    $.ui.panes().catch(() => []),
    $.state.get({ plugin: 'ak-mods', key: 'expanded' }).catch(() => ({ value: undefined })),
  ])
  const isShown = panes.some(pane => pane.id === PANE.id && pane.isShown)
  if (isShown && held.value?.[name] === true) {
    await $.state.set({ plugin: 'ak-mods', key: 'expanded' }, {}).catch(() => undefined)
    await $.ui.close({ id: PANE.id })

    return 'closed'
  }
  await $.state.set({ plugin: 'ak-mods', key: 'expanded' }, { [name]: true }).catch(() => undefined)
  if (width !== undefined) {
    await $.state.set({ plugin: 'ak-mods', key: 'width' }, width).catch(() => undefined)
  }
  await $.ui.open(PANE)
  // A row the pane cannot reach yet stays where it is: the pane is open all the same.
  await $.ui.scroll({ in: PANE.id, to: { key: `mod-${name}` }, block: 'nearest' }).catch(() => undefined)

  return 'opened'
}
