# Scoring Guide — Anchored Rubrics

This document contains the full anchored rubrics for the 4 expert-assessed dimensions. The
`quality-assessor` agent uses these as ground truth when scoring components. Each dimension
uses a 0.0-1.0 scale with five anchor points.

---

## Dimension 1 — Activation Precision

**Weight in composite:** 0.25 (highest)

**Layer blend:** 35% structural, 65% expert

### What is being measured

Whether the component's `description` field causes Claude Code to invoke it at the right
times. Perfect activation precision means the component fires on every prompt that needs it
(high recall) and never fires when irrelevant (high precision). The score represents the
conceptual F1 across a representative prompt distribution.

### How the assessor scores it

The assessor generates 10 mental test prompts: 5 that should activate the component and
5 that should not. It evaluates whether the description would lead Claude's routing to
activate (or not) for each prompt.

### Anchor Points

**0.0-0.19 — Unusable signal**

The description is absent, trivially short, or provides no routing information.

Examples of descriptions at this level:

- Under 10 characters
- Just the component name: "quality"
- Describes what it is, not when to use it: "A skill about assessment"
- Entirely passive with no conditional framing

A component at this level is effectively invisible to autonomous invocation.

**0.20-0.39 — Weak signal**

The description exists and has some meaning but significant gaps remain:

- Mentions the domain but lacks explicit trigger phrases
- Trigger language maps to only one narrow use case
- Would fire on clearly wrong prompts (precision failure)
- Would miss 3+ of 5 should-activate test prompts (recall failure)

Example: "Plugin quality assessment with scoring dimensions."
This names the topic but gives no routing signal.

**0.40-0.59 — Partial signal**

Some trigger signal present but imprecise:

- Contains "use when" but only one specific context
- Would correctly route 3 of 5 should-activate prompts
- Some false positives for adjacent but wrong use cases
- Trigger phrase is generic rather than discriminative

Example: "Quality assessment. Use when evaluating plugins."
Better — has a trigger phrase — but "evaluating plugins" is too broad.

**0.60-0.79 — Good signal**

Clearly identifies when to invoke with only minor gaps:

- Contains "use when..." with at least two specific contexts
- Correctly routes 4 of 5 should-activate prompts
- Few false positives
- May miss uncommon trigger scenarios

Example: "Plugin quality assessment. Use when checking skill quality or rating agent
components before publishing."
Two explicit contexts — but misses comparison and post-creation scenarios.

**0.80-1.00 — Excellent signal**

Precise and comprehensive:

- "Use when..." with 3+ specific, distinct contexts
- Correctly routes all 5 should-activate prompts
- Correctly does NOT activate on all 5 should-not prompts
- Contexts are concrete and discriminative
- Includes "proactively" where appropriate for auto-activation

Example: "Assess the quality of AgentKit plugin components. Use when the user asks to
check quality, rate a skill, evaluate an agent, compare two components, or review plugin
components before publishing. Also use proactively after creating or modifying skills."

### Effective Description Patterns

- Lead with a one-sentence summary of what the component covers
- Follow with "Use this skill when..." listing 3+ concrete scenarios
- Name specific file types, contexts, or output formats when relevant
- Disambiguate from related components where confusion is likely
- Keep total description under 200 characters for clean display

### Common Pitfalls

- "Use when evaluating" — evaluating what? Too vague
- Only one trigger context — need 3+ to score above 0.70
- Passive phrasing ("This component covers...") without stating when to use it
- Mixing trigger context with capability description without clear separation

---

## Dimension 2 — Role Clarity

**Weight in composite:** 0.20

**Layer blend:** 15% structural, 85% expert

### What is being measured

Whether the component behaves as a focused worker in the plugin hierarchy. A well-designed
skill receives a delegated task, executes it with its own instructions, and returns structured
output. It should not be making decisions about which other tools to call, managing
multi-step workflows across agents, or acting as a supervisor.

This dimension is predominantly expert-assessed (85% weight) because surface patterns
alone don't reliably distinguish worker from orchestrator intent.

### How the assessor scores it

The assessor reads the full component and asks: does this define a focused worker
(receives task, executes, returns output) or an orchestrator (plans, delegates, aggregates)?

**Worker signals (positive):**

- Documents what it receives and what it returns
- Self-contained execution steps
- Code blocks show the component doing direct work
- Scoped, focused responsibilities
- Structured output format specified

**Orchestrator signals (negative):**

- Uses "orchestrate", "coordinate", "dispatch", "delegate" language
- Contains conditional routing: "if X, call agent Y; if Z, use skill W"
- Describes itself as a "supervisor" or "coordinator"
- Output is routing decisions rather than execution results
- References multiple external agents in a decision tree

### Anchor Points

**0.0-0.19 — Autonomous agent**

Written as a fully self-contained agent managing its own tool calls, sub-task delegation,
and workflow coordination. No defined input/output contract. Reads like an agent system
prompt rather than a worker instruction set.

**0.20-0.39 — Mixed responsibilities**

Mixes worker and orchestrator roles. Does some work directly but also contains routing
logic. Unclear boundaries between execution and coordination.

**0.40-0.59 — Worker with structural gaps**

Mostly a worker but output isn't structured for caller consumption. The invoking agent
can't easily parse or route based on the output.

**0.60-0.79 — Clean worker, minor gaps**

Functions as a clean worker. Inputs and outputs are documented. Instructions produce
consumable output. One or two ambiguous lines remain.

**0.80-1.00 — Composable worker**

Contract-defined worker with clear inputs and outputs. Output format is explicit —
a calling agent can rely on the structure. Instructions are execution steps with no
routing logic. Designed to be called repeatedly with different inputs.

### Common Pitfalls

- Documenting what the component "does" without specifying what it "returns"
- Including "Related" sections that imply the component will invoke siblings
- Writing instructions as if the component owns the entire conversation
- Mixing execution logic with stakeholder communication steps

---

## Dimension 3 — Instruction Effectiveness

**Weight in composite:** 0.15

**Layer blend:** 0% structural, 100% expert

### What is being measured

Whether the instructions would guide Claude to produce correct, complete, and useful output
across realistic tasks. This is entirely empirical — structural analysis cannot assess
instruction quality, so the blend is 100% expert.

### How the assessor scores it

The assessor selects 3 realistic tasks the component is designed for — varying from
straightforward to complex. For each, it mentally executes the instructions and assesses:

- **Correct** — factually accurate, technically sound
- **Complete** — covers all aspects the task requires
- **Useful** — actionable, well-formatted, appropriate length

The average across 3 tasks becomes the dimension score.

### Anchor Points

**0.0-0.19 — Instructions produce wrong output**

Following the instructions would lead to incorrect or actively harmful results.
Factual errors, logical contradictions, or directives that produce the opposite
of the intended result.

**0.20-0.39 — Major gaps**

Works for trivial cases but fails on anything non-trivial. Critical decision points
have no guidance. Output format is undefined — Claude must improvise.

**0.40-0.59 — Adequate for basics**

Reasonable output for straightforward tasks but struggles with complexity. Output
format is suggested but not enforced. Edge cases are unaddressed.

**0.60-0.79 — Good for most cases**

Quality output for the majority of realistic tasks. A few edge cases or complex
scenarios may be suboptimal but core use cases work well.

Characteristics: 3+ concrete examples, clearly specified output format, at least
one edge case addressed, actionable and specific instructions.

**0.80-1.00 — Excellent across the board**

Comprehensive, specific, and produces high-quality output even for complex or
edge-case tasks. Represents genuine expertise distillation.

Characteristics: examples covering simple through complex cases, precise output
format with schema or template, multiple edge cases with handling guidance,
expert-level domain knowledge encoded, troubleshooting for failure modes.

### Verification Checklist

When assessing technical instructions, the assessor verifies:

- Code blocks are syntactically correct and would run without modification
- Workflows are shown end-to-end, not as fragments
- Error handling covers the most common failure modes
- Referenced tools or APIs are current and available
- Version constraints are stated where relevant

---

## Dimension 4 — Scope Balance

**Weight in composite:** 0.12

**Layer blend:** 35% structural, 65% expert

### What is being measured

Whether the component is the right size for its purpose. Too thin and it provides
no value. Too broad and it wastes tokens, confuses the model, and overlaps with
siblings. The ideal component is exactly as large as it needs to be.

This requires significant expert judgment (65% weight) because "right size" depends
on the component's category and domain complexity.

### How the assessor scores it

The assessor evaluates:

1. Does it cover all important aspects of its stated domain?
2. Does it include anything outside its stated domain?
3. Is the depth appropriate — neither superficial nor excessive?
4. Is content density high (every line earns its place) or padded?

### Anchor Points

**0.0-0.19 — Stub**

A placeholder with fewer than 50 lines. Covers less than half of its stated domain.
Invoking this component yields fragmentary guidance insufficient for any real task.

**0.20-0.39 — Too narrow**

Covers its domain but only the surface layer. Important aspects are mentioned without
enough depth to be actionable. Useful as a starting point but not self-sufficient.

**0.40-0.59 — Off-balance**

Either moderately under-scoped (missing important aspects) or slightly over-scoped
(includes content belonging to a different component). The content that exists is
reasonable but the package isn't well-calibrated.

**0.60-0.79 — Well-scoped with minor issues**

Covers its domain well. Important aspects are addressed at appropriate depth. One
or two gaps remain, or a small amount of tangential content, but minor issues only.

**0.80-1.00 — Precisely calibrated**

Exactly what it needs to be. All important aspects covered at the right depth, with
no padding and no gaps. Every section earns its place. Could serve as a reference
implementation for its category.

### Category-Specific Expectations

| Category | Target lines | Pattern |
|---|---|---|
| Workflow / Process | 150-300 | Step-by-step + decision points + worked example |
| Reference / Documentation | 200-500 | Core content + references/ for extended material |
| Code generator | 100-200 | Instructions + references/ for templates |
| Diagnostic / Debugging | 200-400 | Decision trees + failure modes + procedures |
| Agent definition | 60-120 | Identity + methodology phases + output format |

### Common Pitfalls

- Writing a stub and planning to expand later — publish when content is ready
- Including content that belongs in a sibling component to inflate scope
- Over-explaining background theory the model already knows from training
- Adding filler headings ("Overview", "Introduction") that restate the description
- Treating a narrowly-scoped utility component as too thin — single-purpose can be 100 lines and perfectly calibrated

---

## Cross-Dimension Guidance

### Assessment Priority

When a component scores poorly on multiple dimensions, fix them in weight order. The
highest composite gain comes from improving the highest-weighted dimensions first.

A D grade in Activation Precision (weight 0.25) costs far more composite points than
a D in Integration Fit (weight 0.05).

### Score Stability

Expert scores may vary slightly between runs due to the non-deterministic nature of
mental test prompt generation. Improve stability by:

- Tightening the description with more specific trigger contexts
- Adding concrete examples that anchor the assessor's simulated tasks
- Making instructions unambiguous so the quality conclusion is clear

### Grade Scale

| Grade | Score range | Meaning |
|---|---|---|
| A | 0.90-1.00 | Excellent — no meaningful improvement needed |
| B | 0.80-0.89 | Good — minor gaps only |
| C | 0.70-0.79 | Adequate — one or two clear areas to improve |
| D | 0.60-0.69 | Marginal — needs targeted work |
| F | < 0.60 | Failing — significant remediation required |
