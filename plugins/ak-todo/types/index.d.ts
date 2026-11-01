/** A task is work to do; a note is context Claude reads. */
export type Kind = 'task' | 'note'
/** Who created an entry. */
export type Owner = 'user' | 'claude'
/** Where a task stands. Notes have none. */
export type Status = 'open' | 'doing' | 'done'
/** One task or note. `id` is never reused in a list. */
export type Entry = { id: number; kind: Kind; text: string; owner: Owner; status?: Status; isDeferred?: true }
/**
 * One conversation's list. `removed` holds the normalised text of every entry the user removed, so
 * Claude never adds it back; `touched` is when the list last changed.
 */
export type TodoList = { v: 1; nextId: number; entries: Entry[]; trash: Entry[]; removed: string[]; touched: number }

declare module 'claude-code' {
  interface PluginState {
    'ak-todo': {
      /** This conversation's tasks and notes, mirrored to `$.store`; read through `parseList`. */
      list: TodoList
      /** The conversation `list` belongs to; another id means the list must be loaded afresh. */
      conversation: string
      /** The person's changes Claude has not been told of yet, one line each. */
      pending: string[]
      /** Whether the person closed the pane in this conversation; it then opens only when asked. */
      isPaneClosed: boolean
      /** Whether the pane is open. */
      isPaneOpen: boolean
      /** The pane's own view: the row being edited, the kind a new entry gets, the open folds, the row whose menu is open. */
      view: { editing?: number; kind: Kind; open: string[]; menu?: number }
    }
  }
}
