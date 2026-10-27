/** What an AgentKit mod says about itself when it declares itself. */
export type ModsInfo = { name: string; title: string; summary: string; details: string }

/** One row of the switcher: a declared mod with its two switches. */
export type ModsRow = ModsInfo & { isOn: boolean; isStandard: boolean }

/** A segment's colour: its state, not its mod. */
export type ModsTone = 'ok' | 'warn' | 'alert' | 'info' | 'dim'

/** What a mod shows in the shared band; ak-mods adds its name and title. */
export type ModsSegment = {
  text: string
  tone?: ModsTone
  /** Higher stays visible longer when the band runs out of room; 5 when left out. */
  priority?: number
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
      /** The terminal's width in cells as `/ak-mods` last ran: what the pane counts the band's cut with. */
      width: number
    }
  }
}
