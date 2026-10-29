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

/** One row of a segment's card in the Mods pane: a label and its value, one line each. */
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
   * texts are what the segment says there, and the band counts its room by them there, a ring or an
   * icon as three cells, a character as 0.85 of a cell.
   */
  rich?: ModsPart[]
  /**
   * The segment as the band draws it when it is short of room: before taking a second row, the band
   * draws every segment that has one in this form. `text`, `parts` and `rich` as on the segment.
   * Without it, the segment draws in full there. A compact segment's button draws on its text where
   * the band can press text (the desktop app), with no hotkey, and the terminal leaves it out. Keep a
   * run of text in `rich` beside any ring or icon: a picture alone cannot be pressed, and the button
   * would be lost there.
   */
  compact?: { text: string; parts?: ModsPart[]; rich?: ModsPart[] }
  /** More of the same state, shown dim after the text in the Mods pane only, never in the band. One line, as `text`. */
  detail?: string
  /**
   * The rows of the card the desktop app shows in the Mods pane, which a press on the segment's text
   * opens at its row (only a plain run is pressed there: a run in a colour or dim stays text, as a Button draws its text in one look): a dim label beside its value, the labels in one column. Without them the card shows `detail`, a line a part.
   */
  card?: ModsCardRow[]
  tone?: ModsTone
  /** Higher stays visible longer when the band runs out of room; 5 when left out. */
  priority?: number
  /**
   * `hotkey` is one printable character; any other is left out, and `m` is the band's own.
   * `isPaneOnly` keeps the button out of the band, for an action seldom taken: the Mods pane alone
   * shows it, so the band shows the state and the pane the way to change it. `isOnText` makes the
   * segment's text the button where the band can press text (the desktop app), for a segment whose
   * one action is plain from what it shows, such as copying an id: no button of its own beside it.
   */
  button?: { label: string; hotkey?: string; command: string; args?: string; isPaneOnly?: boolean; isOnText?: boolean }
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
