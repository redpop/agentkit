import { Footer, Snippet } from './kit'
import type { Kit } from './kit'

/** Feedback: a toast and the status line, the only controls that show something outside the pane. */
export const feedbackSection = (k: Kit) => {
  const { Box, Button } = k.el
  const t = k.t.feedback

  return (
    <Box flexDirection="column" rowGap="xs">
      <Box flexDirection="row" columnGap="md" alignItems="center">
        <Button key="feedback-toast" label={t.toast} onPress={() => k.feedback('toast')} />
        {Snippet(k, '$.ui.toast(text)')}
      </Box>
      <Box flexDirection="row" columnGap="md" alignItems="center">
        <Button key="feedback-status" label={t.status} onPress={() => k.feedback('status')} />
        {Snippet(k, '$.ui.status(text)')}
      </Box>
      <Box flexDirection="row" columnGap="md" alignItems="center">
        <Button key="feedback-clear" label={t.clear} dimColor onPress={() => k.feedback('clear')} />
        {Snippet(k, '$.ui.status(undefined)')}
      </Box>
      {Footer(k, t.missing, t.note)}
    </Box>
  )
}
