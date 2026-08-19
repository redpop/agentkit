# Handoff

> Capture the state of a coding session so a fresh AI session can continue without re-explaining.

## Overview

Writes a session handoff document answering three questions for an agent that was not present: what the session set
out to do, where it stands, and what should happen next. It works at any point in a session — blocked on a problem,
half-way through a ticket, or finished and moving on.

The document is written to `docs/handoffs/YYYY-MM-DD-<slug>.md`. Code and Git are read only; the handoff document is
the sole file the skill writes.

## Usage

```text
/ak-meta:handoff [mission for the next session] [--blocked|--wip|--done]
```

Everything that is not a status flag becomes the mission for the next session, passed through verbatim. With no
arguments, the mission is derived from where the session stopped.

## Status

The skill detects the session's status and shapes the document around it:

| Status | Detected when | Emphasis |
| -------- | -------- | -------- |
| `Blocked` | A problem resisted several attempts | Blockers, ruled-out paths, what to try next |
| `In Progress` | Work is moving but unfinished | What is half-done and where the seam is |
| `Complete` | The session's goal was reached | What was delivered, what it enables next |

Pass `--blocked`, `--wip`, or `--done` to override the detection.

## Examples

```text
/ak-meta:handoff continue with ABC-123
```

Session is finished, the next one has a new ticket. Captures what was delivered, the Git state, the decisions made
along the way, and puts `continue with ABC-123` at the top as the next agent's instruction.

```text
/ak-meta:handoff
```

Mid-session capture with no mission given. Records the current state and derives the next step from where the work
stopped.

```text
debugging this auth bug is taking forever, /ak-meta:handoff --blocked
```

Forces the blocked framing: the open problem, every attempt that failed and why, and the approaches still worth
trying.

## What It Captures

- **Mission for the next session** — the instruction, verbatim
- **Executive summary** — goal, course, current standing, for a reader with zero context
- **What was done / what was not done** — including whether an open item is deferred or out of scope
- **Git state** — branch, uncommitted changes, commits made this session
- **Files touched** — each with one sentence on why
- **Decisions and assumptions** — so the next agent neither re-litigates settled choices nor trusts an unverified one
- **Blockers** — only when the status is `Blocked`
- **Suggested next steps** and **environment constraints**

## When to Use

- Ending a session and pointing the next one at a new ticket
- Switching to a different AI assistant, tool, or machine mid-task
- Pausing work that a teammate will pick up
- Handing off a problem you are stuck on for async debugging

## Best Practices

- Give the mission explicitly when you know it — a stated ticket beats an inferred next step
- Run it before the context runs out, not after: the skill reads the conversation, so what has scrolled away is gone
- Commit the handoff document if the next session runs on another machine

## Related

- [changelog](./changelog.md) -- turn released changes into user-facing release notes
- [ak-knowledge:log](../ak-knowledge/log.md) -- log solved problems for the knowledge base
