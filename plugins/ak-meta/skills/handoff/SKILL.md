---
name: handoff
description: >
  Capture the state of a coding session so a fresh AI session can continue without re-explaining. Use when the user
  asks to "create a handoff", "hand this over", "summarize this session for the next agent", "prepare a handoff for
  ticket XY", "document context for another AI", or is switching sessions, tools, or teammates — whether the work is
  blocked, half-finished, or complete.
---

# Handoff

Write a session handoff document: what the session set out to do, where it stands, and what the next session should
do. The reader is an AI agent that was not present and knows nothing about this session.

**SAFETY**: Code and Git are read **only**. The single file this skill writes is the handoff document itself —
never a source file, never a commit.

## Arguments

`$ARGUMENTS` is the mission for the next session, in the user's own words:

- A ticket: `continue with ABC-123`, `next up: PROJ-42 checkout flow`
- A direction: `finish the migration`, `pick up the failing tests`
- A status override: `--blocked`, `--wip`, `--done`
- Empty: the mission is derived from where the session stopped

Anything that is not a status flag is the mission text, verbatim. Do not paraphrase it away — it is the user's
instruction to the next agent, and it outranks whatever next step you would have inferred.

## Status Detection

Determine the session's status, then let it shape the emphasis of the document:

| Status | Signal | Emphasis |
| -------- | -------- | -------- |
| `Blocked` | An open problem resisted several attempts; the last thing tried failed | Blockers, what was ruled out, what to try next |
| `In Progress` | Work is moving, nothing is stuck, but the goal is not reached | What is half-done and where the seam is |
| `Complete` | The session's goal was reached | What was delivered, what it enables next |

An explicit `--blocked` / `--wip` / `--done` flag overrides detection. When signals are mixed — a finished feature
plus one unresolved side issue — choose the status of the *main* thread and record the rest under
"What Was Not Done".

## Execution

1. **Read the conversation** — the goal, the path taken, the outcome. Resolved work counts: the next agent needs to
   know what is already settled as much as what is open.
2. **Detect status** (see above), or take the flag.
3. **Collect the Git state** — current branch, uncommitted changes (`git status --short`), commits made during this
   session (`git log`). This is the most common blind spot on a session switch: what is on disk versus what is
   committed.
4. **List the files touched**, one sentence each on why they were touched.
5. **Surface decisions and assumptions** — choices made deliberately, and assumptions not yet verified. This keeps
   the next agent from re-litigating settled questions or trusting an untested premise.
6. **Write the document** to `docs/handoffs/YYYY-MM-DD-<slug>.md`, creating the directory if needed. The slug comes
   from the mission or the session's subject. If the file exists, append `-2`, `-3`, … rather than overwriting.
7. **Report the path** to the user so it can be handed to the next session.

## Output Format

Omit any section that would be empty — an empty heading is noise, not structure. `Blockers` appears only when the
status is `Blocked`.

```markdown
# Session Handoff — <topic>

**Date**: YYYY-MM-DD
**Branch**: <branch>
**Status**: Blocked | In Progress | Complete

## Mission for the Next Session
[The user's instruction, verbatim. If none was given: the next step this session leads to, marked as derived.]

## Executive Summary
[3-6 sentences: the goal, what happened, where it stands. Written for someone with zero context.]

## What Was Done
- [Change or finding, with its outcome]

## What Was Not Done
- [Open, deferred, or deliberately out of scope — and which it is]

## Current State

### Git
- Branch, uncommitted changes, commits made this session

### Files Touched
- `path/to/file` — why it was touched

## Decisions & Assumptions
- **Decision**: [what was chosen] — [why]
- **Assumption**: [what is being taken for granted] — [not yet verified]

## Blockers
[Only when Blocked: the specific error, what was attempted, why each attempt failed]

## Suggested Next Steps
1. [Concrete first action for the next session]

## Environment & Constraints
[Languages, frameworks, test and build commands, project conventions the next agent must follow]
```
