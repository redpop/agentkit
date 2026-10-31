/** The tones a segment of the shared band can take, as ak-mods names them. */
export type ShowcaseTone = 'ok' | 'warn' | 'alert' | 'info' | 'dim'

declare module 'claude-code' {
  interface PluginState {
    'ak-showcase': {
      /** The section the pane shows. */
      section: string
      /** The last dummy action, as the pane reports it. */
      last: string
      /** What was typed or picked in the form section, by the element's key. */
      fields: Record<string, string>
      /** The tone of the demo segment. */
      tone: ShowcaseTone
    }
  }
}
