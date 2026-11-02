# Explain MR

> Walks through a merge request, pull request, or branch as an interactive learning unit.

## Overview

Explains a GitLab merge request, a GitHub pull request, a branch, or a commit range so that the reader understands
what was built, how it is structured, and why. The outline runs from the requirement down to the helper functions
instead of file by file, and the session advances one point per message with a code excerpt each. It explains and does
not review: no findings, no checklists.

Before explaining, it checks the real scope. Commits of another ticket mean a stacked MR, and the first message names
the commit where the actual change begins. Ticket, commit bodies, specs, and project rules are read as context; what
is missing is stated in one line.

## Usage

```text
/ak-review:explain-mr [MR/PR URL, !123, #123, or base..head]
```

Without an argument, the current branch is explained against its base. The platform follows from the URL host or the
`git remote`; `glab` serves GitLab, `gh` serves GitHub, and local `git` is the fallback.

## Examples

```text
/ak-review:explain-mr https://gitlab.example.com/group/project/-/merge_requests/123
```

Fetches the MR with `glab`, outlines it in a few points, and starts with the requirement.

```text
/ak-review:explain-mr #45
```

Explains pull request 45 of the current GitHub repository via `gh`.

## Closing question

After each point the skill offers "Continue" and "Deeper" as buttons where the surface supports it. In the Claude
desktop app it uses `wrap_up` before the message, because the app shortens text that stands before a tool call. In
the terminal it asks with `AskUserQuestion` after the message. Without either, the question stays as text.

## Related

- [`/ak-review:explain`](explain.md) explains a single code snippet, not a whole change.
