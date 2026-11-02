---
name: explain-mr
description: This skill should be used when the user asks to "explain this MR", "explain this PR", "walk me through this merge request", "walk me through this branch", "what does this MR actually do", "I want to understand this before I review", or pastes a GitLab merge request or GitHub pull request URL asking for an explanation. Also matches German triggers such as "erklär mir MR 883", "geh den Branch mit mir durch", "Lerneinheit zum Diff". Explains a merge request, pull request, branch, or commit range as an interactive learning unit, for the author or as review preparation.
argument-hint: "[MR/PR URL, !123, #123, or base..head]"
---

# Explain a Merge Request

Explain a merge request, pull request, or branch diff so that someone afterwards understands **what** was built,
**how** it is structured, and **why** it was built that way — from the big picture down, not file by file. The
session is interactive: one point per message, more depth only on request.

"MR" below means a GitLab merge request or a GitHub pull request alike.

This is an explanation, not a review. The messages have the form fixed below, and that form has no room for findings,
review tasks, or checklists. What step 1 finds about the scope (stacked, title does not match, partner MR) is
orientation and belongs in the first message.

## Step 1 — Identify the source and the real scope

| Input | Fetch with |
|---|---|
| GitLab MR URL or `!123` / "MR 123" | `glab mr view <n> -R <group/project>` (title, description, branches), `glab mr view <n> --comments`, `glab mr diff <n>`, commits via `glab api "projects/<group%2Fproject>/merge_requests/<n>/commits"` |
| GitHub PR URL or `#123` / "PR 123" | `gh pr view <n> -R <owner/repo>` (title, description, branches), `gh pr view <n> --comments`, `gh pr diff <n>`, commits via `gh api repos/<owner>/<repo>/pulls/<n>/commits` |
| Branch or commit range | `git log --format='%h %s%n%b' <base>..<head>`, `git diff --stat <base>...<head>`, `git diff <base>...<head>` |
| nothing given | current branch against its base (target branch of the open MR, otherwise `main`/`master`/`develop`, whichever exists) |

Take the platform from the URL host or the `git remote`. A bare `123` with both kinds of remote is ambiguous: ask.
Without `glab` or `gh` installed, or without a login, fall back to local `git` and say so in one line.

Then check whether the diff really contains only this change:

- Group the commits by ticket key (`[A-Z][A-Z0-9]+-\d+`). Commits that belong to another ticket mean the MR is
  probably stacked on another one. Find its open MR and determine the commit where the actual change begins.
- If the MR title or description does not match the ticket of the commits, note it.
- If description, commits, or ticket point to a partner MR in another repository, add it as context.

## Step 2 — Gather context

Fetch what exists and say in one line what is missing. Without ticket and spec, explain from the diff and the commit
bodies.

- **Ticket:** key from branch, MR title, or commits. If a Jira connector is available (tools such as
  `get_jira_issue`, often to be loaded via `ToolSearch` first), read description, acceptance criteria, subtasks, and
  comments.
- **Commit bodies:** the best source for the why.
- **Specs/plans:** in `.docs/`, `docs/`, or files with the ticket key in the name (`grep -ril <KEY>`).
- **Project rules:** `AGENTS.md`/`CLAUDE.md` — they show what is a convention of its own in this project.

Read silently. For large diffs (roughly 15 files or 1000 lines and up) hand the reading to a subagent. It returns an
outline draft with only references per point (`file:lines`, commit, spec section, acceptance criterion), no prose.
Fetch the exact excerpt yourself when you reach the point.

## Step 3 — Outline

2–10 points, by topic rather than by file, in this order of layers:

1. **Requirement and purpose** — which problem, for whom, what is different afterwards.
2. **Core logic and architecture** — the central idea, the data model, how the parts connect.
3. **Helpers and core functions** — the functions the rest stands on.
4. **Surroundings** — depending on the MR: persistence/session, state, reset, accessibility, sync with other systems,
   output (PDF, export).

Small MRs merge layers; not every layer needs a point. Tests, docs, formatting, imports, icons, and lockfiles get at
most one shared line at the end of the outline — unless the MR is about exactly that.

## Step 4 — The messages

**First message**, in this form:

```
**<Ticket key> – <title in plain words>**

<1–2 sentences: problem and solution.>

<only if step 1 found something: at most three lines on the real scope — stacked
(with command), title/description belong to another ticket, partner MR in another repo, e.g.
"Stacked on !880 – the actual change is `git diff <base-sha> <head-sha>`.">

<only if something is missing: one line, e.g. "No ticket found – explaining from the diff.">

1. <point>
2. <point>
…

Start with 1, or jump to another point?
```

**Each point message**, in this form:

````
**<N>. <Title>**

<1–2 sentences: what this part does and how it fits into the whole.>

`path/file.ts:42`
```<language>
<the decisive excerpt, at most ~15 lines; diff hunk with +/- or
the new code, shortened with "…">
```

<2–4 sentences: why it is built this way.>

<optional: **Alternative:** <the obvious other way> — <why not, with source>.>

<optional: **Trick:** <what is special about it>.>

Understood? Continue with <N+1> (<title>), or deeper into <specific detail from this point>?
````

Rules for the slots:

- **The excerpt is mandatory.** Every point shows code. Several places? Show the most important one and name the others
  with `file:line` in one sentence.
- **For the requirement point** the excerpt is the quote of the requirement (acceptance criterion, ticket or MR text,
  commit body) with source instead of code. Without a written requirement, show the place where a user sees the
  change.
- **Prose at most ~150 words** per point message, not counting the code block.
- **Alternative** only where there was an obvious other way. The reasoning comes from a source (commit body, spec
  section, ticket comment, code comment) and names it. Without a source it begins with "Probably because …".
- **Trick** only if at least one applies: a newer language or API feature, a deliberate security aspect (with its
  purpose, not just "this is hashed"), a non-obvious trick, a convention of this project. Otherwise leave it out.
- **Closing question as buttons:** If a tool offers answers as buttons, use it instead of the text question. The
  options are "Continue with <N+1>" and "Deeper: <specific detail>". Own wishes are typed freely. Which tool depends on
  the surface:
  - **Claude desktop app** (`mcp__ccd_turn__wrap_up` available): call it **before** writing the message. `recap` is
    one sentence on the state ("Point 3 of 9: …"), `ask` the closing question, `actions` two answer buttons with
    `label` and `message`. The point message follows as the last text. The app shortens text that stands before a tool
    call to a summary, which would drop the code excerpt. So no tool call follows the point message.
  - **Claude desktop app without `wrap_up`** (tools with the prefix `mcp__ccd_` such as
    `mcp__ccd_session__mark_chapter`, but no `mcp__ccd_turn__wrap_up`): **no** `AskUserQuestion` and no tool call at
    all after the point message. The app would shorten the text before it to a summary, and excerpt and prose are
    gone. The text question from the template stays.
  - **Terminal** (`AskUserQuestion` available, no `mcp__ccd_` tools): write the message first and call
    `AskUserQuestion` afterwards, with one question, header "Continue?", and two to three options.
  - **No such tool:** the text question from the template stays.
- **"Deeper"** means: the same point, one detail further down, again in this form. Then back to the outline.

**Last message**, after the last point:

```
**Done – the highlights**

- <2–5 points, one line each: what to take away from this MR>

<one line on what the outline left out on purpose, e.g. "Not covered: tests, E2E, docs.">
```

## Language

Answer in the language of the user. Code, paths, and identifiers stay as they are.

## Common mistakes

| Mistake | Instead |
|---|---|
| outline follows files or commit order | by layer and topic, requirement first |
| point message without code, only bullet lists | excerpt with `file:line`, then short prose |
| presenting every function of a file | the one the rest stands on; others by reference |
| reasoning sounds like the author's intent but is guessed | name the source or "Probably because …" |
| stacked MR explained as a whole | determine the real scope and name it in the first message |
| in the desktop app `AskUserQuestion` after the message – the app shows only a summary | in the desktop app never call a tool after a message, not even after the outline; text question or `wrap_up` before it |
