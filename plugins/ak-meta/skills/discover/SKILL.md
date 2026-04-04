---
name: discover
description: >
  Surface and stress-test improvement opportunities across any project. Use when the user wants
  to find what to work on next, explore directions, uncover blind spots, or generate a prioritized
  set of ideas before diving into brainstorming. Applies to code, content, product, or strategy.
---

# Discover

Systematically uncover high-value opportunities by casting a wide net, then ruthlessly filtering for signal. Works across domains — technical debt, feature gaps, content strategy, architecture, DX.

`discover` sits upstream of brainstorming and planning:

- **discover** — "Where should we focus? What opportunities exist?"
- **brainstorming** — "How do we shape a specific opportunity into something concrete?"
- **planning** — "What are the steps to build it?"

The output is a prioritized discovery document saved to `docs/discover/`. No requirements, no plans, no code.

## Arguments

Parse `$ARGUMENTS` for optional scope or direction:

- A topic: `DX improvements`, `blog content for Q3`
- A file path: `plugins/ak-security/`
- A constraint: `low-complexity quick wins`
- A quantity hint: `top 3`, `100 ideas`, `raise the bar`
- Empty: unconstrained exploration

## Guiding Principles

1. **Context first** — Understand the project before proposing anything. Abstract suggestions without grounding are noise.
2. **Breadth before depth** — Produce the full candidate set before evaluating individual entries.
3. **Earn the shortlist** — Every survivor must withstand adversarial scrutiny. Optimistic ranking is not filtering.
4. **Write early** — Persist the discovery document before presenting results so nothing is lost to interruptions.

## Phase 0: Check for Prior Work

Look in `docs/discover/` for documents from the past 30 days.

If a matching document exists (overlapping topic or scope), offer:

1. Pick up where it left off
2. Start from scratch

When resuming: load the document, recap prior findings, carry forward status markers and the session log.

## Phase 1: Gather Project Context

Before generating anything, build situational awareness. Launch in parallel:

1. **Project survey** — A sub-agent reads project instructions (AGENTS.md, CLAUDE.md, README.md) and examines the top-level structure. Returns a compact profile (under 30 lines):
   - Tech stack and project shape
   - Conventions and patterns in use
   - Visible friction points or gaps
   - High-leverage areas

2. **Prior art search** — A sub-agent scans for related documentation, past solutions, or existing content in the project (`docs/solutions/`, `docs/`, content archives, etc.).

Combine both into a concise grounding brief.

## Phase 2: Wide-Angle Exploration

Launch 4-6 parallel sub-agents, each approaching the project from a distinct angle. The angle is a **starting lens, not a boundary** — agents follow promising threads wherever they lead.

**Default lenses:**

| Lens | Entry Question |
|---|---|
| Friction & Pain | Where do users or developers lose the most time? |
| Missing Capabilities | What obvious need is unaddressed? |
| Simplification | What complex step could be automated, shortened, or removed? |
| Challenged Assumptions | Which accepted constraint might actually be wrong? |
| Multiplier Effects | What single change amplifies everything else? |
| Demanding Users | What would a power user expect that we currently lack? |

Each sub-agent:

- Gets the grounding brief plus any focus hint
- Produces ~7-8 candidates (targeting 30-40 raw ideas total)
- Returns per idea: title, one-liner, why it matters, evidence from the project
- Pushes beyond the obvious — early ideas tend to be surface-level

Once all agents report back:

1. **Consolidate and deduplicate** into a unified candidate pool (~20-30 distinct entries)
2. **Spot combinations** — Look for ideas from different lenses that reinforce each other. Add up to 3-5 hybrid candidates.

## Phase 3: Critical Evaluation

Subject every candidate to rigorous scrutiny. Two-layer approach preferred:

1. **Challenger sub-agents** stress-test the pool from different critical angles
2. **Orchestrator** weighs the critiques, applies the scoring rubric, ranks survivors

**Cut criteria:**

- Too abstract to act on
- Weaker duplicate of another candidate
- Disconnected from the actual project
- Cost outweighs realistic benefit
- Already solved by existing tools or workflows

**Scoring dimensions (equally weighted):**

- Connection to real project state
- Expected impact
- Originality
- Feasibility
- Compounding value
- Effort required

**Target outcome:** 5-7 finalists. Too many? Apply a stricter pass. Fewer than 5? Report honestly — don't dilute the bar.

Record a one-line cut reason for every rejected candidate.

## Phase 4: Present Finalists

Show the surviving ideas in a consistent structure:

```markdown
### 1. <Title>
**What:** Concrete description
**Why:** How this moves the project forward
**Trade-offs:** Known costs or risks
**Confidence:** 0-100%
**Effort:** Low / Medium / High
```

Follow with a compact rejection table so the user sees the full picture of what was weighed.

Pause for questions before writing the artifact.

## Phase 5: Persist the Discovery Document

1. Create `docs/discover/` if it does not exist
2. Filename: `docs/discover/YYYY-MM-DD-<topic>-discover.md` (or `-open-discover.md` without a topic)
3. Write the document:

```markdown
---
date: YYYY-MM-DD
topic: <kebab-case-topic>
focus: <optional scope or constraint>
---

# Discover: <Title>

## Project Context
[Grounding brief from Phase 1]

## Ranked Opportunities

### 1. <Title>
**What:** [Concrete description]
**Why:** [How this moves the project forward]
**Trade-offs:** [Known costs or risks]
**Confidence:** [0-100%]
**Effort:** [Low / Medium / High]
**Status:** [Unexplored / Explored]

## Rejected Candidates

| # | Candidate | Reason |
|---|-----------|--------|
| 1 | <Title> | <One-line reason> |

## Session Log
- YYYY-MM-DD: Initial run — X candidates evaluated, Y finalists
```

When resuming: update the existing file, append to the session log, keep explored markers intact.

## Phase 6: What Comes Next

After presenting results, offer three paths:

1. **Brainstorm a finalist** — Mark the idea as `Explored`, log it in the session, hand off to the brainstorming workflow
2. **Iterate on the discovery** — Route based on intent:
   - "More ideas" / "new angles" → back to Phase 2
   - "Tighter filter" / "raise the bar" → back to Phase 3
   - "Expand idea #N" → deeper analysis on that specific entry
3. **Wrap up** — Offer to commit the discovery document (no branch, no push)

**Always** save or update the artifact before any handoff or session close.

## Quality Checklist

Before finishing, confirm:

- Candidates are rooted in actual project state, not generic advice
- The full pool was generated before any filtering took place
- Every rejected candidate has a stated reason
- Finalists are meaningfully stronger than a naive "suggest improvements" prompt
- The artifact is written and saved before handoff or session end
- Progressing on an idea routes to brainstorming, never straight to implementation
