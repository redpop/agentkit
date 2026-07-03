---
name: explain
description: This skill should be used when the user asks to "explain this code", "explain this function", pastes a code snippet after invoking /ak-review:explain, or wants to understand what a piece of code does, why it's built that way, and what's notable about it -- without improvement suggestions.
---

# Explain

Explain a code snippet to a developer: what it does, why it is built this way, and what is notable about it. No
improvement suggestions, no assumptions beyond the visible code.

## Input

- If code is selected in the editor, explain the selection.
- Otherwise, treat everything written after the skill invocation as the input. If it opens with a short
  introductory sentence before the actual snippet, use only the code portion -- ignore the introduction.

## Constraints

- All statements refer exclusively to the visible code -- no assumptions about callers or context outside the
  snippet.
- No improvement suggestions.

## Output Format

1. **Purpose** -- 1-2 sentences: what the code achieves and in what role.
2. **How it works** -- the load-bearing mechanisms and decisions, not line by line. Explain the why behind the
   structure where it is evident from the code.
3. **Noteworthy** (only if applicable) -- language features, APIs, or patterns that are not everyday, 1-2 sentences
   each: what it is and why it fits here. Omit entirely for purely standard code. Never duplicate a point already
   covered under "How it works".

Scope: adapt to the code. The explanation may be longer than the code for short snippets, but must be noticeably
shorter than the code for long snippets -- never more than ~250 words. No introduction, no conclusion.
