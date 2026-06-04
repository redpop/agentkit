# Handoff

> Document current problem context for handoff to another AI assistant.

## Overview

Creates a structured handoff document capturing the unresolved problem, technical environment, attempted solutions, current blockers, and suggested next steps from the conversation history. Operates in read-only mode -- never modifies code.

## Usage

```text
/ak-meta:handoff
```

The skill takes no arguments — it reads the current conversation history and writes the handoff document directly.

## Examples

```text
/ak-meta:handoff
```

Scans the conversation for the current unresolved problem and writes a handoff document capturing the problem
statement, technical environment, attempted solutions, current blockers, and suggested next steps — everything a
fresh AI session needs to continue without you re-explaining.

```text
debugging this auth bug is taking forever, /ak-meta:handoff
```

Same read-only capture, invoked mid-session when you want to pass the still-open problem (resolved issues are
intentionally excluded) to another assistant or teammate.

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
