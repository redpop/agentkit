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
