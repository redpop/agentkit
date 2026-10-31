import { Footer, Group, Snippet, hasForms } from './kit'
import type { Kit } from './kit'

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'pear', label: 'Pear' },
  { value: 'plum', label: 'Plum' },
]

/** Forms: Input and Select, and a toggle built from what exists. Typing and picking only keep the value. */
export const formsSection = (k: Kit) => {
  const { Box, Text, Button } = k.el
  const t = k.t.forms
  const shown = (key: string, label: string) => (
    <Text dimColor size="footnote">
      {label}: {k.fields[key] ?? '—'}
    </Text>
  )
  const isOn = k.fields['toggle-buttons'] === 'on'
  const toggle = [
    <Box flexDirection="row" columnGap={1}>
      <Button
        key="toggle-on"
        label={t.on}
        {...(isOn ? { variant: 'primary' as const } : { dimColor: true })}
        onPress={() => k.put('toggle-buttons', 'on')}
      />
      <Button
        key="toggle-off"
        label={t.off}
        {...(isOn ? { dimColor: true } : { variant: 'primary' as const })}
        onPress={() => k.put('toggle-buttons', 'off')}
      />
    </Box>,
    Snippet(k, '<Button variant={isOn ? "primary" : undefined} dimColor={!isOn}>'),
  ]
  if (!hasForms(k.surface) || !('Input' in k.el)) {
    return (
      <Box flexDirection="column">
        <Text>{t.mobile}</Text>
        {Group(k, t.toggle, toggle)}
        {Footer(k, t.missing)}
      </Box>
    )
  }
  const { Input, Select } = k.el

  return (
    <Box flexDirection="column">
      {Group(k, t.single, [
        <Input
          key="input-single"
          label="Name"
          placeholder={t.placeholder}
          value={k.fields['input-single'] ?? ''}
          onSubmit={value => k.put('input-single', value)}
        />,
        shown('input-single', t.typed),
        Snippet(k, '<Input key="…" label="Name" placeholder="…" onSubmit={keep}>'),
      ])}
      {Group(k, t.multi, [
        <Input
          key="input-multi"
          rows={3}
          submitLabel={t.send}
          placeholder={t.placeholder}
          value={k.fields['input-multi'] ?? ''}
          onSubmit={value => k.put('input-multi', value)}
        />,
        shown('input-multi', t.typed),
        Snippet(k, `<Input key="…" rows={3} submitLabel="${t.send}" onSubmit={keep}>`),
      ])}
      {Group(k, t.select, [
        <Select
          key="select-fruit"
          label="Fruit"
          options={FRUITS}
          value={k.fields['select-fruit'] ?? 'apple'}
          onSelect={value => k.put('select-fruit', value)}
        />,
        shown('select-fruit', t.picked),
        Snippet(k, '<Select key="…" options={[{ value, label }]} onSelect={keep}>'),
      ])}
      {Group(k, t.toggle, toggle)}
      {Group(k, t.toggleSelect, [
        <Select
          key="toggle-select"
          options={[
            { value: 'on', label: t.on },
            { value: 'off', label: t.off },
          ]}
          value={k.fields['toggle-select'] ?? 'off'}
          onSelect={value => k.put('toggle-select', value)}
        />,
        Snippet(k, '<Select options={[{ value: "on" }, { value: "off" }]}>'),
      ])}
      {Footer(k, t.missing, t.mobile)}
    </Box>
  )
}
