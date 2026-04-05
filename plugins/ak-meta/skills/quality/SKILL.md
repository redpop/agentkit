---
name: quality
description: >
  Assess the quality of AgentKit plugin components — skills, agents, or entire plugins.
  Use this skill when the user asks to "check quality", "assess a skill", "rate a plugin",
  "evaluate skill quality", "score this agent", "review plugin components", "quality check",
  or wants to understand how well a skill or agent is written before publishing.
  Also use proactively after creating or significantly modifying skills and agents.
---

# Quality Assessment

Evaluate AgentKit plugin components against a structured quality framework. Produces a composite
score across 8 weighted dimensions, detects common quality issues, and assigns a tier rating.

## Arguments

Parse `$ARGUMENTS` for:

- A **path** to a skill directory, agent file, or plugin directory
- `--quick` — structural review only (Layer 1), no expert assessment
- `--compare <path-b>` — side-by-side comparison of two components

Flags can be combined: `--quick --compare <path-b>` runs a fast structural comparison.

If no path is given, prompt the user to specify what to assess.

---

## Mode Reference

### Standard Mode (default)

Runs both layers — structural review plus expert assessment via the `quality-assessor` agent.
All 8 dimensions are scored. Takes 30-60 seconds due to the agent dispatch.

**When to use:** Before publishing a component, for a thorough quality audit, or when you
need actionable improvement recommendations with full context.

### Quick Mode (`--quick`)

Runs Layer 1 only — instant structural checks, no agent dispatch. Completes in seconds.

**What changes:**

- Only 5 of 8 dimensions are scored (those with structural signals)
- 3 dimensions are **omitted entirely**: Instruction Effectiveness, Scope Balance, Resilience
- The remaining 5 dimension weights are renormalized to sum to 1.0
- No expert reasoning — scores reflect file structure, not content quality
- Quality issues (anti-patterns) are still fully detected

**Renormalized weights in quick mode:**

| Dimension | Standard weight | Quick weight |
|---|---|---|
| Activation Precision | 0.25 | 0.37 |
| Role Clarity | 0.20 | 0.29 |
| Information Architecture | 0.10 | 0.15 |
| Context Efficiency | 0.08 | 0.12 |
| Integration Fit | 0.05 | 0.07 |
| ~~Instruction Effectiveness~~ | ~~0.15~~ | — |
| ~~Scope Balance~~ | ~~0.12~~ | — |
| ~~Resilience~~ | ~~0.05~~ | — |

**When to use:** During active development as a fast feedback loop — check frontmatter,
descriptions, file organization, and anti-patterns before investing time in a full assessment.
Also useful for batch-scanning multiple components to find the weakest ones first.

**Example workflow:**

1. `--quick` on all skills in a plugin → identify lowest scorers
2. Full assessment on the weakest component → get expert recommendations
3. Fix issues → `--quick` again to verify structural improvements
4. Full assessment to confirm the component is ready

### Compare Mode (`--compare <path-b>`)

Evaluates two components side-by-side and produces a dimension-by-dimension comparison with
delta values showing where each one is stronger.

**Typical scenarios:**

- **Before/after:** Compare a skill before and after a rewrite to verify the rewrite actually improved quality
- **Alternative implementations:** Choose between two approaches for the same functionality
- **Cross-plugin comparison:** Compare similar skills across different plugins
- **Regression check:** Verify that changes to one component didn't degrade its score relative to a baseline

**How to read the results:**

- Positive delta (green) = component A scores higher on that dimension
- Negative delta (red) = component B scores higher
- Look at the **highest-weighted dimensions first** — a +0.10 on Activation Precision (weight 0.25) matters more than a +0.20 on Integration Fit (weight 0.05)
- The verdict section explains which component is stronger overall and why

**Combining flags:**

- `--compare <path-b>` alone → full assessment of both (standard depth)
- `--quick --compare <path-b>` → structural comparison only (fast, 5 dimensions)

---

## Assessment Layers

### Layer 1 — Structural Review

Read the target file(s) and perform these checks directly. No sub-agent needed.

**For Skills** (SKILL.md):

1. **Frontmatter** — `name` and `description` present? Description length ≥ 60 chars?
2. **Activation signal** — Does description contain "use when", "use this skill when", or "use proactively"?
3. **Heading structure** — Count H2/H3 headings. Minimum 3 H2 sections expected.
4. **Code blocks** — Count fenced code blocks. At least 1 expected for workflow/template skills.
5. **Line count** — Measure total lines. Sweet spot: 150-500 lines for SKILL.md.
6. **References directory** — Does `references/` exist? Are referenced files non-empty?
7. **Cross-references** — Verify any links to other skills/agents resolve correctly.
8. **Directive density** — Count MUST/ALWAYS/NEVER occurrences. Target < 1 per 10 lines.
9. **Duplicate content** — Scan for near-identical lines or repeated paragraph structures.
10. **Knowledge paths** — If `${CLAUDE_PLUGIN_ROOT}/knowledge/` is referenced, verify paths exist.

**For Agents** (.md):

1. **Frontmatter** — `name`, `description` present? Model and tools declared?
2. **Description** — Contains trigger context with `<example>` blocks?
3. **Identity** — Clear role statement in first paragraph?
4. **Methodology** — Numbered phases or structured approach?
5. **Line count** — Sweet spot for agents: 60-120 lines.
6. **Output format** — Defined output structure?

**Score each structural dimension** (0.0-1.0):

| Check area | Maps to dimension |
|---|---|
| Frontmatter + activation signal | Activation Precision |
| Output format + composability signals | Role Clarity |
| Line count + references balance | Information Architecture |
| Directive density + duplication | Context Efficiency |
| Heading density + code blocks + cross-refs | Integration Fit |

Dimensions without structural signals (Instruction Effectiveness, Scope Balance, Resilience) get no Layer 1 score — they rely entirely on Layer 2.

### Detect Quality Issues

Flag these specific patterns:

| Issue | Trigger | Impact |
|---|---|---|
| `RIGID_LANGUAGE` | >15 MUST/ALWAYS/NEVER in a single file | Reduces model flexibility, wastes tokens |
| `WEAK_DESCRIPTION` | Description field < 20 characters | Component becomes invisible to routing |
| `MISSING_ACTIVATION` | No "use when" / "use this skill when" pattern | Autonomous invocation fails |
| `MONOLITHIC_CONTENT` | >800 lines without a `references/` directory | Forces full content into context every time |
| `BROKEN_LINK` | Markdown link to a `references/` file that doesn't exist | Dead reference wastes context |
| `STALE_CROSS_REF` | References to skills/agents that don't exist in the plugin | Broken ecosystem links |
| `MISSING_PLUGIN_ROOT` | Knowledge file paths without `${CLAUDE_PLUGIN_ROOT}` prefix | Paths won't resolve at runtime |

Each detected issue reduces the final score by 5%, flooring at 50%:

```
issue_penalty = max(0.5, 1.0 - 0.05 * issue_count)
```

**If `--quick` was specified:** Skip to "Present Results" using only Layer 1 scores.

---

### Layer 2 — Expert Assessment

Dispatch the `quality-assessor` agent with the component path:

> Assess the component at: {resolved_path}
> Read all files thoroughly, then score it on the 4 expert dimensions.
> Return scores as JSON.

The agent returns structured scores for:

- **Activation Precision** — F1 estimate from mental test prompts
- **Role Clarity** — Worker purity assessment
- **Instruction Effectiveness** — Simulated task quality
- **Scope Balance** — Depth/breadth calibration

See [Scoring Guide](references/scoring-guide.md) for the full anchored rubrics.

---

## Compute Composite Score

### Dimension Weights

| # | Dimension | Weight | What it captures |
|---|---|---|---|
| 1 | Activation Precision | 0.25 | Does the description route correctly? |
| 2 | Role Clarity | 0.20 | Clean worker vs tangled orchestrator? |
| 3 | Instruction Effectiveness | 0.15 | Do the instructions produce quality results? |
| 4 | Scope Balance | 0.12 | Right size — not a stub, not bloated? |
| 5 | Information Architecture | 0.10 | Progressive disclosure via references/? |
| 6 | Context Efficiency | 0.08 | Lean token footprint per invocation? |
| 7 | Resilience | 0.05 | Edge cases and failure modes covered? |
| 8 | Integration Fit | 0.05 | Fits cleanly into AgentKit ecosystem? |

### Layer Blend Weights

When both layers ran (standard depth), blend per dimension:

| Dimension | Layer 1 (Structural) | Layer 2 (Expert) |
|---|---|---|
| Activation Precision | 0.35 | 0.65 |
| Role Clarity | 0.15 | 0.85 |
| Instruction Effectiveness | 0.00 | 1.00 |
| Scope Balance | 0.35 | 0.65 |
| Information Architecture | 1.00 | 0.00 |
| Context Efficiency | 0.80 | 0.20 |
| Resilience | 0.00 | 1.00 |
| Integration Fit | 0.85 | 0.15 |

For `--quick` mode, all weight falls on Layer 1. Dimensions without Layer 1 scores are omitted from the quick report and the remaining weights are renormalized.

### Final Score

```
composite = sum(dimension_weight * blended_score) * 100 * issue_penalty
```

### Tier Assignment

| Tier | Score | Meaning |
|---|---|---|
| Platinum | >= 90 | Reference quality — exemplary component |
| Gold | >= 80 | Production ready — solid and well-crafted |
| Silver | >= 70 | Functional — has clear improvement opportunities |
| Bronze | >= 60 | Minimum viable — needs targeted work |
| No tier | < 60 | Below quality bar — significant gaps |

---

## Present Results

Use this format:

```markdown
## Quality Assessment: {component_name}

**Score: {score}/100** — {tier} {tier_stars}

### Dimension Breakdown

| # | Dimension | Weight | Score | Grade |
|---|---|---|---|---|
| 1 | Activation Precision | 0.25 | {score} | {grade} |
| 2 | Role Clarity | 0.20 | {score} | {grade} |
| ... | ... | ... | ... | ... |

### Quality Issues

{list of detected issues with descriptions, or "No issues detected"}

### Recommendations

{ordered list: fix the lowest-scoring highest-weight dimension first}
{for each recommendation: what to change and why it matters}
```

Grade scale: A (0.90-1.0), B (0.80-0.89), C (0.70-0.79), D (0.60-0.69), F (<0.60).

Focus recommendations on the dimension where `weight * (1.0 - score)` is largest — that's where improvement yields the most composite score gain.

---

## Compare Mode Output

When `--compare <path-b>` is provided (see Mode Reference above for scenarios and interpretation):

1. Run Layer 1 on both components
2. If not `--quick`, run Layer 2 on both via parallel `quality-assessor` dispatches
3. Present a side-by-side comparison using this format:

```markdown
## Quality Comparison: {name_a} vs {name_b}

| Dimension | Weight | {name_a} | {name_b} | Delta |
|---|---|---|---|---|
| Activation Precision | 0.25 | {score_a} ({grade}) | {score_b} ({grade}) | {+/-diff} |
| Role Clarity | 0.20 | {score_a} ({grade}) | {score_b} ({grade}) | {+/-diff} |
| ... | ... | ... | ... | ... |

**Overall:** {name_a} {score_a}/100 ({tier}) vs {name_b} {score_b}/100 ({tier})

### Verdict
{which is stronger and why — cite the highest-weighted dimensions where they diverge}
{if scores are within 5 points: note they are effectively equivalent}
```

A positive delta means component A scores higher; negative means B is stronger.
The verdict should focus on the 2-3 highest-weighted dimensions where the delta is
largest — small differences on low-weight dimensions are not meaningful.

---

## Prioritizing Improvements

When a component scores below Gold, suggest fixes in this order — highest leverage first:

| Dimension | Weight | Typical fix | Expected gain |
|---|---|---|---|
| Activation Precision | 0.25 | Rewrite description with 3+ trigger contexts | High |
| Role Clarity | 0.20 | Add explicit Input/Output sections | High |
| Instruction Effectiveness | 0.15 | Add worked examples and edge case handling | Medium |
| Scope Balance | 0.12 | Move reference material to references/ | Medium |
| Information Architecture | 0.10 | Create references/ directory | Medium |
| Context Efficiency | 0.08 | Reduce directive language density | Low |
| Resilience | 0.05 | Add troubleshooting section | Low |
| Integration Fit | 0.05 | Add cross-references to related components | Low |

Rule of thumb: fixing Activation Precision alone often lifts the composite by 10+ points.
