# Notification Hooks

> macOS notification hooks: sound on permission prompt, banner on idle.

## Overview

Provides audible and visual notifications for Claude Code events on macOS. Plays a sound when
Claude requests permission (so you hear it even if you are not watching) and displays a macOS
notification banner when Claude is idle waiting for input.

## Hooks

### Permission Prompt Sound

- **Trigger:** `Notification` event with `permission_prompt` matcher
- **Action:** Plays the system Glass sound at 50% volume via `afplay`
- **Requirements:** macOS with `/System/Library/Sounds/Glass.aiff` (built-in)

### Idle Prompt Banner

- **Trigger:** `Notification` event with `idle_prompt` matcher
- **Action:** Displays a macOS notification banner ("Claude is waiting for input") via `osascript`
- **Requirements:** macOS with notification permissions for the terminal app

## Configuration

Defined in `plugins/ak-notifications/hooks/hooks.json`. Installed automatically when the
ak-notifications plugin is added.

## Best Practices

- Ensure your terminal app has macOS notification permissions (System Settings > Notifications)
- Adjust volume in the `afplay -v` parameter (0.0 to 1.0) if the sound is too loud or quiet
- Both hooks are non-blocking and exit quickly to avoid delaying Claude Code
- These hooks are macOS-only; they will not work on Linux or Windows
