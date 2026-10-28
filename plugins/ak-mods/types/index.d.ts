/** What an AgentKit mod says about itself when it declares itself. */
export type ModsInfo = { name: string; title: string; summary: string; details: string }

/** One row of the switcher: a declared mod with its two switches. */
export type ModsRow = ModsInfo & { isOn: boolean; isStandard: boolean }

/** A segment's colour: its state, not its mod. `ok` draws in the text colour; only the others colour it. */
export type ModsTone = 'ok' | 'warn' | 'alert' | 'info' | 'dim'

/** The line icons ak-mods draws: an id (`#`), a copy, a check mark. */
export type ModsIcon = 'id' | 'copy' | 'check'

/**
 * A run of a segment's text in its own tone; without one, in the segment's. In `rich`, a run with a
 * `ring` (0 to 100) draws as a ring filled that far, one with an `icon` as that line icon, instead
 * of its text, which a reader that cannot see the picture gets in its place. A ring wins over an
 * icon.
 */
export type ModsPart = { text: string; tone?: ModsTone; ring?: number; icon?: ModsIcon }

/** One row of a segment's hover card: a label and its value, one line each. */
export type ModsCardRow = { label: string; value: string }

/** What a mod shows in the shared band; ak-mods adds its name and title. */
export type ModsSegment = {
  /** One line: a control character draws as a space, as in the button's label. */
  text: string
  /**
   * `text` cut into runs, each drawn in its own tone, so a label can sit dim beside its value.
   * Joined they must read as `text`; else `text` draws in one run.
   */
  parts?: ModsPart[]
  /**
   * The segment as a surface that draws pictures shows it (the desktop app), in place of `text` and
   * `parts`: runs as in `parts`, any with a `ring`. The terminal draws `text`. Joined, the runs'
   * texts are what the segment says there; the band still counts its room by `text`.
   */
  rich?: ModsPart[]
  /** More of the same state, shown dim after the text in the Mods pane only, never in the band. One line, as `text`. */
  detail?: string
  /**
   * The rows of the card the desktop app shows while the pointer is over the segment: a dim label
   * beside its value, the labels in one column. Without them the card shows `detail`, a line a part.
   */
  card?: ModsCardRow[]
  tone?: ModsTone
  /** Higher stays visible longer when the band runs out of room; 5 when left out. */
  priority?: number
  /** `hotkey` is one printable character; any other is left out, and `m` is the band's own. */
  button?: { label: string; hotkey?: string; command: string; args?: string }
}

/** The `$.mods` noun that ak-mods adds to `$`. */
export type Mods = {
  /** Announces the calling mod; resolves false when the caller is not an AgentKit plugin or names another. */
  declare: (info: ModsInfo) => Promise<boolean>
  /** Whether the mod is on in this session; an undeclared name is off. */
  isOn: (args: { name: string }) => Promise<boolean>
  /** Turns the mod on or off for this session. */
  set: (args: { name: string; on: boolean }) => Promise<void>
  /** Marks or unmarks the mod as standard: on at the start of every new session. */
  setStandard: (args: { name: string; standard: boolean }) => Promise<void>
  /** Every declared mod, sorted by title, case-insensitive. */
  list: () => Promise<readonly ModsRow[]>
  /**
   * Publishes the calling mod's one segment in place of its last; undefined clears it. A caller that
   * is not a declared AgentKit mod is ignored. Cleared when the mod is switched off and when the chat ends.
   */
  segment: (segment: ModsSegment | undefined) => Promise<void>
}

declare module 'claude-code' {
  interface EngineInterface {
    mods: Mods
  }
  interface PluginState {
    'ak-mods': {
      declared: ModsInfo[]
      on: Record<string, boolean>
      standard: string[]
      expanded: Record<string, boolean>
      segments: Record<string, ModsSegment>
      /**
       * The band's width in cells (its `bodyColumns`: the terminal's less the five of the engine's
       * `[-]`), as `/ak-mods` or the band's `mods` button last recorded it; `bandWidth` in
       * `hooks/band.ts` defines it. What the pane counts the band's cut with.
       */
      width: number
    }
  }
}
