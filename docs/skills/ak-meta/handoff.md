# Handoff

> Document current problem context for handoff to another AI assistant.

## Overview

Creates a structured handoff document capturing the unresolved problem, technical environment, attempted solutions, current blockers, and suggested next steps from the conversation history. Operates in read-only mode -- never modifies code.

## Usage

```text
/ak-meta:handoff
```

## When to Use

- Switching to a different AI assistant mid-problem
- Ending a session with unresolved issues that need continuation
- Sharing problem context with a teammate or another AI tool
- Creating a concise problem summary for async debugging

## Best Practices

- The skill only captures unresolved problems -- resolved issues are intentionally ignored

## Related

- [changelog](./changelog.md) -- document completed changes (complementary to handoff)
- [ak-knowledge:log](../ak-knowledge/log.md) -- log solved problems for the knowledge base
