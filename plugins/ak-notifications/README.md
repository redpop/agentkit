# ak-notifications

Platform-specific notification hooks for Claude Code (macOS).

## Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| Sound alert | Permission prompt | Plays Glass.aiff sound |
| Desktop banner | Idle prompt | Shows macOS notification |

## Requirements

- macOS (uses `afplay` and `osascript`)

## Installation

/plugin install ak-notifications@ak-marketplace
