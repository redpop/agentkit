# Quality

> Assess plugin component quality with structural review and expert scoring across 8 dimensions.

## Overview

Evaluates AgentKit skills, agents, or entire plugins against a structured quality framework. Uses a two-layer approach: Layer 1 performs instant structural checks (frontmatter, descriptions, file organization, quality issues), Layer 2 dispatches the `quality-assessor` agent for semantic evaluation of activation precision, role clarity, instruction effectiveness, and scope balance. The composite score blends both layers across 8 weighted dimensions and assigns a tier rating (Platinum/Gold/Silver/Bronze).

## Usage

```text
/ak-meta:quality <path> [flags]
```

### Modes

| Mode | Command | Speed | Dimensions | Best for |
|---|---|---|---|---|
| **Standard** | `/ak-meta:quality <path>` | 30-60s | All 8 | Thorough audit before publishing |
| **Quick** | `/ak-meta:quality <path> --quick` | Seconds | 5 of 8 | Fast feedback during development |
| **Compare** | `/ak-meta:quality <path-a> --compare <path-b>` | 60-90s | All 8 | Before/after or A vs B evaluation |
| **Quick Compare** | `/ak-meta:quality <path-a> --quick --compare <path-b>` | Seconds | 5 of 8 | Fast structural comparison |

### Quick Mode Details

Skips the expert assessment (Layer 2) and runs only structural checks. Three dimensions are omitted because they require semantic analysis: Instruction Effectiveness, Scope Balance, and Resilience. The remaining 5 dimensions are renormalized so scores stay comparable. Quality issues (anti-patterns) are still fully detected.

Recommended workflow: `--quick` to find weak spots fast, then full assessment on the lowest scorers.

### Compare Mode Details

Evaluates two components side-by-side with a delta column showing where each is stronger. Useful for verifying a rewrite improved quality, choosing between alternative implementations, or catching regressions. Positive delta = first component scores higher; focus on the highest-weighted dimensions for the meaningful differences.

## Examples

```text
/ak-meta:quality plugins/ak-meta/skills/quality
```

Full standard assessment (both layers, all 8 dimensions) of the quality skill directory — the path positional
argument points at the component to score.

```text
/ak-meta:quality plugins/ak-git/agents/git-workflow-specialist.md --quick
```

Structural-only review of a single agent file — `--quick` skips the expert agent and scores the 5 dimensions with
structural signals in seconds.

```text
/ak-meta:quality plugins/ak-meta/skills/discover --compare plugins/ak-meta/skills/quality
```

Side-by-side comparison of two skills — `--compare <path-b>` scores both and shows per-dimension deltas so you can
see which is stronger and where.

```text
/ak-meta:quality plugins/ak-react/skills/react-doctor --quick --compare plugins/ak-react/skills/react-best-practices
```

Fast structural comparison — combining `--quick` with `--compare` runs the 5-dimension structural pass on both
components, ideal for quickly ranking siblings before a deeper audit.

## When to Use

- After creating or significantly modifying a skill or agent
- Before publishing a plugin component to the marketplace
- When comparing two versions of a component to see which is better
- To identify the highest-leverage improvements for a low-scoring component
- When auditing overall plugin quality across multiple components

## Quality Dimensions

| # | Dimension | Weight | What it measures |
|---|---|---|---|
| 1 | Activation Precision | 0.25 | Does the description trigger the component correctly? |
| 2 | Role Clarity | 0.20 | Is the component a clean worker, not an orchestrator? |
| 3 | Instruction Effectiveness | 0.15 | Do the instructions produce quality output? |
| 4 | Scope Balance | 0.12 | Right size for its purpose? |
| 5 | Information Architecture | 0.10 | Progressive disclosure via references/? |
| 6 | Context Efficiency | 0.08 | Lean token footprint per invocation? |
| 7 | Resilience | 0.05 | Edge case and failure mode coverage? |
| 8 | Integration Fit | 0.05 | Fits into the AgentKit ecosystem? |

## Tier Ratings

- **Platinum** (>= 90) — Reference quality, exemplary component
- **Gold** (>= 80) — Production ready, solid and well-crafted
- **Silver** (>= 70) — Functional, has improvement opportunities
- **Bronze** (>= 60) — Minimum viable, needs targeted work

## Best Practices

- Start with `--quick` during development for instant structural feedback
- Run full assessment (without `--quick`) before publishing
- Fix Activation Precision first — at weight 0.25 it yields the highest composite gains
- Use `--compare` to validate that a rewrite actually improves the score

## Related

- [discover](./discover.md) — generate improvement ideas across the project
- [quality-assessor](../../agents/ak-meta/quality-assessor.md) — the expert assessment agent
