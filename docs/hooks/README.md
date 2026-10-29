# Hooks

Hooks are automated actions triggered by Claude Code tool events. They run shell scripts or prompt-based logic in response to specific tool uses, or, for `ak-mods`, a TSX hooks module that runs inside Claude Code.

## All Hooks

| Hook Group | Plugin | Trigger | Description |
|------------|--------|---------|-------------|
| [Notification Hooks](ak-notifications/notification-hooks.md) | ak-notifications | Permission/Idle prompts | Sound alerts and desktop notifications |
| [Mod switcher](../mods/ak-mods/switcher.md) | ak-mods | Session start/end, commands, rendering | Hooks module (TSX) behind the Mods pane and the shared band |
| [GitLab](../mods/ak-gitlab/gitlab.md) | ak-gitlab | Session start/end, prompts, turn completion, Bash calls, commands, rendering | Hooks module (TSX) that shows the merge request and its pipeline |
| [Keep warm](../mods/ak-keepwarm/keepwarm.md) | ak-keepwarm | Turn steps, commands, rendering | Hooks module (TSX) that pings the prompt cache |
| [Session id](../mods/ak-session-id/session-id.md) | ak-session-id | Session start/end, commands, rendering | Hooks module (TSX) that copies the session id |
| [Usage](../mods/ak-usage/usage.md) | ak-usage | Session start/end, turn completion, rendering | Hooks module (TSX) that shows the context fill and the rate limits |
| [Validation Hooks](ak-review/validation-hooks.md) | ak-review | After Write/Edit | Markdown, JSON, shell validation |
