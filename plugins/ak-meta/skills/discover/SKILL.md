---
name: discover
description: >
  Generate and critically evaluate improvement ideas for any project. Use when asking what to improve,
  requesting idea generation, exploring content ideas, or wanting proactive suggestions before
  brainstorming one idea in depth. Works for code, content, product, or any creative direction.
---

# Discover

Generate grounded, critically evaluated ideas through divergent thinking and adversarial filtering. Works for any domain: code improvements, content strategy, product features, architecture decisions.

`discover` precedes brainstorming:

- **discover** answers: "What are the strongest ideas worth exploring?"
- **brainstorming** answers: "What exactly should one chosen idea become?"
- **planning** answers: "How should it be built?"

This workflow produces a ranked ideation artifact in `docs/ideation/`. It does **not** produce requirements, plans, or code.

## Arguments

Parse `$ARGUMENTS` as optional context:

- A concept: `DX improvements`, `blog content for Q3`
- A path: `plugins/ak-security/`
- A constraint: `low-complexity quick wins`
- A volume hint: `top 3`, `100 ideas`, `raise the bar`
- No argument: open-ended ideation

## Core Principles

1. **Ground before ideating** — Scan the actual project first. No abstract advice detached from reality.
2. **Diverge before judging** — Generate the full idea set before evaluating any individual idea.
3. **Use adversarial filtering** — Quality comes from explicit rejection with reasons, not optimistic ranking.
4. **Preserve the artifact early** — Write the ideation document before presenting results so work survives interruptions.

## Phase 0: Resume Check

Check `docs/ideation/` for ideation documents created within the last 30 days.

If a relevant doc exists (topic/path overlaps with the current focus), ask:

1. Continue from it
2. Start fresh

If continuing: read the document, summarize what was explored, preserve previous statuses and session log.

## Phase 1: Project Context Scan

Before generating ideas, gather project context. Dispatch in parallel:

1. **Context scan** — A general-purpose sub-agent that reads project instructions (AGENTS.md, CLAUDE.md, README.md) and scans the top-level directory layout. Returns a concise summary (under 30 lines):
   - Project shape (language, framework, structure, content type)
   - Notable patterns or conventions
   - Obvious pain points or gaps
   - Likely leverage points for improvement

2. **Existing knowledge search** — A sub-agent that searches for relevant past solutions, docs, or existing content in the project (e.g., `docs/solutions/`, `docs/`, blog posts, content archives — whatever exists).

Consolidate results into a short grounding summary.

## Phase 2: Divergent Ideation

Dispatch 4-6 parallel sub-agents, each with a different ideation frame as a **starting bias, not a constraint**. Each agent begins from its assigned perspective but follows any promising thread wherever it leads.

**Default frames:**

| Frame | Starting Bias |
|---|---|
| Pain & Friction | What causes the most frustration or wasted time? |
| Unmet Needs | What capability is missing or underserved? |
| Inversion & Removal | What painful step could be automated, simplified, or eliminated entirely? |
| Assumption-Breaking | What "obvious truth" about this project might be wrong? |
| Leverage & Compounding | What small change would multiply the value of everything else? |
| Edge Cases & Power Users | What would the most demanding user need that we don't serve? |

Each sub-agent:

- Receives the grounding summary + focus hint
- Generates ~7-8 ideas (30-40 raw across all agents)
- Returns structured output per idea: title, summary, why_it_matters, evidence/grounding hooks
- Pushes past the safe obvious layer — first ideas tend to be generic

After all agents return:

1. **Merge and deduplicate** into one master candidate list (~20-30 unique candidates)
2. **Synthesize cross-cutting combinations** — Scan for ideas from different frames that together are stronger than either alone. Add 3-5 combined ideas at most.

## Phase 3: Adversarial Filtering

Review every candidate critically. Prefer a two-layer critique:

1. **Skeptical sub-agents** attack the merged list from distinct angles
2. **Orchestrator** synthesizes critiques, applies the rubric, scores survivors, decides final ranking

**Rejection criteria:**

- Too vague or not actionable
- Duplicates a stronger idea
- Not grounded in the actual project
- Too expensive relative to likely value
- Already covered by existing workflows or docs

**Survivor rubric (all factors weighted):**

- Groundedness in the actual project
- Expected value
- Novelty
- Pragmatism
- Leverage on future work
- Implementation burden

**Target:** 5-7 survivors. If too many survive, run a second stricter pass. If fewer than 5 survive, report that honestly rather than lowering the bar.

For each rejected idea, write a one-line reason.

## Phase 4: Present Survivors

Present surviving ideas in structured form:

```markdown
### 1. <Idea Title>
**Description:** Concrete explanation
**Rationale:** Why this improves the project
**Downsides:** Tradeoffs or costs
**Confidence:** 0-100%
**Complexity:** Low / Medium / High
```

Then include a brief rejection summary so the user can see what was considered and cut.

Allow brief follow-up questions before writing the artifact.

## Phase 5: Write the Ideation Artifact

1. Ensure `docs/ideation/` exists
2. File path: `docs/ideation/YYYY-MM-DD-<topic>-ideation.md` (or `-open-ideation.md` if no focus)
3. Write the document:

```markdown
---
date: YYYY-MM-DD
topic: <kebab-case-topic>
focus: <optional focus hint>
---

# Ideation: <Title>

## Project Context
[Grounding summary from Phase 1]

## Ranked Ideas

### 1. <Idea Title>
**Description:** [Concrete explanation]
**Rationale:** [Why this improves the project]
**Downsides:** [Tradeoffs or costs]
**Confidence:** [0-100%]
**Complexity:** [Low / Medium / High]
**Status:** [Unexplored / Explored]

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | <Idea> | <Reason> |

## Session Log
- YYYY-MM-DD: Initial ideation — X candidates generated, Y survivors
```

If resuming: update in place, append to session log, preserve explored markers.

## Phase 6: Next Steps

After presenting results, ask:

1. **Brainstorm a selected idea** — Mark idea as `Explored`, note in session log, hand off to brainstorming workflow
2. **Refine the ideation** — Route by intent:
   - "Add more ideas" / "explore new angles" → return to Phase 2
   - "Re-evaluate" / "raise the bar" → return to Phase 3
   - "Dig deeper on idea #N" → expand that idea's analysis
3. **End the session** — Offer to commit the ideation doc (no branch, no push)

**Always** write/update the artifact before any handoff or session end.

## Quality Bar

Before finishing, verify:

- The idea set is grounded in the actual project
- The candidate list was generated before filtering (diverge-first)
- Every rejected idea has a reason
- Survivors are materially better than a naive "give me ideas" list
- The artifact was written before any handoff or session end
- Acting on an idea routes to brainstorming, not directly to implementation
