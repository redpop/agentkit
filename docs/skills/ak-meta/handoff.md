# Handoff

> Document current problem context for handoff to another AI assistant.

## Overview

Creates a structured handoff document capturing the unresolved problem, technical environment, attempted solutions, current blockers, and suggested next steps from the conversation history. Operates in read-only mode -- never modifies code. Supports standard and compact output modes.

## Usage

```text
/ak-meta:handoff [filename.md] [flags]
```

**Flags:** `--compact` / `-c` (max 10 sentences), `--technical` / `-t` (force technical details in compact mode), `--focus <topic>`, `--skip <topic>`

Default filename: `handoff.md`

## When to Use

- Switching to a different AI assistant mid-problem
- Ending a session with unresolved issues that need continuation
- Sharing problem context with a teammate or another AI tool
- Creating a concise problem summary for async debugging

## Best Practices

- Use `--compact` for quick context transfers between short sessions
- Add `--focus` to emphasize the most relevant area when the session covered multiple topics
- Use `--skip` to exclude resolved issues or irrelevant tangents
- The skill only captures unresolved problems -- resolved issues are intentionally ignored

## Related

- [changelog](./changelog.md) -- document completed changes (complementary to handoff)
- [ak-knowledge:document](../ak-knowledge/document.md) -- document solved problems for the knowledge base
