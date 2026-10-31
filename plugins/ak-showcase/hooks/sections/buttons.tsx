import type { RenderChildren } from 'claude-code'

import { Footer, Group, Snippet } from './kit'
import type { Kit } from './kit'

/** Buttons: every variant a Button has. A press only records itself. */
export const buttonsSection = (k: Kit) => {
  const { Box, Text, Button } = k.el
  const t = k.t.buttons
  const press = (what: string) => () => k.act(what)
  // A keyed row: the Box the pointer hovers for the Button's `hover`.
  const row = (code: string, button: RenderChildren) => (
    <Box key={`row-${code}`} flexDirection="row" columnGap="md" alignItems="center">
      {button}
      {Snippet(k, code)}
    </Box>
  )

  // The Mods pane's `⋯` menu, built the same way: a dim plain Button toggles the actions, which are
  // Buttons under the row, in place. The pane keeps whether it is open; a pick closes it.
  const isMenuOpen = k.fields['card-menu'] === 'open'
  const menu = [
    <Box key="menu-row" flexDirection="column" rowGap="xs">
      <Box flexDirection="row" columnGap={1}>
        <Text>Showcase</Text>
        <Button
          key="menu-open"
          label="⋯"
          plain
          dimColor
          onPress={() => k.put('card-menu', isMenuOpen ? 'closed' : 'open')}
        />
      </Box>
      {isMenuOpen && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          {k.t.demoActions.map(({ label }, index) => (
            <Button
              key={`menu-action-${index}`}
              label={label}
              onPress={() => {
                k.put('card-menu', 'closed')
                k.act(`Menu action ${label}`)
              }}
            />
          ))}
        </Box>
      )}
    </Box>,
    Snippet(k, '$.mods.segment({ actions: [{ label, command, args }], … })'),
  ]

  return (
    <Box flexDirection="column">
      {Group(k, 'Button', [
        row('<Button>', <Button key="button-default" label="Default" onPress={press('Button default')} />),
        row(
          'variant="primary"',
          <Button key="button-primary" label="Primary" variant="primary" onPress={press('Button primary')} />,
        ),
        row(
          'variant="secondary"',
          <Button key="button-secondary" label="Secondary" variant="secondary" onPress={press('Button secondary')} />,
        ),
        row('dimColor', <Button key="button-dim" label="Dim" dimColor onPress={press('Button dimColor')} />),
        row('plain', <Button key="button-plain" label="Plain" plain onPress={press('Button plain')} />),
        row(
          'role="dismiss"',
          <Button key="button-dismiss" label="Dismiss" role="dismiss" onPress={press('Button role=dismiss')} />,
        ),
        row(
          'autoFocus',
          <Button key="button-focus" label="Focus" autoFocus onPress={press('Button autoFocus')} />,
        ),
        row(
          `hover={{ color: 'claude' }}`,
          <Button key="button-hover" label="Hover" hover={{ color: 'claude' }} onPress={press('Button hover')} />,
        ),
      ])}
      {Group(k, t.plainHotkey, [
        <Box flexDirection="row" columnGap={2}>
          <Button key="button-yes" label={k.t.forms.on} hotkey="1" plain onPress={press('Button hotkey 1')} />
          <Button key="button-no" label={k.t.forms.off} hotkey="2" plain onPress={press('Button hotkey 2')} />
        </Box>,
        Snippet(k, '<Button plain hotkey="1" label="…">'),
      ])}
      {Group(k, t.children, [
        <Box flexDirection="row">
          <Button key="button-chip" onPress={press('Button with Text children')}>
            main.ts <Text dimColor>2m</Text>
          </Button>
        </Box>,
        Snippet(k, '<Button key="…">main.ts <Text dimColor>2m</Text></Button>'),
      ])}
      {Group(k, t.glyph, [
        <Box flexDirection="row" columnGap={2}>
          <Button key="button-star" label="★" plain onPress={press('Button ★')} />
          <Button key="button-play" label="▶︎" plain onPress={press('Button ▶︎')} />
          <Button key="button-speaker" label={'\u{1F50A}'} plain onPress={press('Button 🔊')} />
        </Box>,
        Snippet(k, '<Button plain label="★">'),
      ])}
      {Group(k, t.menu, menu)}
      {Footer(k, t.missing, k.surface === 'desktop' ? t.note : undefined)}
    </Box>
  )
}
