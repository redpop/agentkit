# Hypothesis-Driven Debugging

A structured approach to root cause analysis based on the Analysis of Competing Hypotheses (ACH)
methodology. Instead of guessing and poking at code, formulate explicit hypotheses, gather
evidence for and against each, and arbitrate between competing explanations.

## When to Apply

- A bug has multiple plausible root causes
- Initial investigation hasn't pinpointed the issue
- The problem spans multiple modules or layers
- You want to avoid confirmation bias (latching onto the first explanation that seems right)
- An intermittent or hard-to-reproduce issue requires systematic evidence gathering

## Failure Mode Categories

Use these 6 categories to generate initial hypotheses. For any given bug, try to formulate
at least one hypothesis from each relevant category before investigating.

### 1. Logic Error

Incorrect conditionals (wrong operator, missing case), off-by-one errors, missing edge case
handling, broken algorithm implementation.

### 2. Data Issue

Unexpected input values, type mismatches or coercion problems, null/undefined/None where a
value is expected, encoding or serialization bugs, data truncation or overflow.

### 3. State Problem

Race conditions between concurrent operations, stale cache returning outdated data, incorrect
initialization or default values, unintended mutation of shared state, invalid state machine
transitions.

### 4. Integration Failure

API contract violations (request/response shape mismatch), version incompatibility between
components, configuration drift between environments, missing or wrong environment variables,
network timeouts or connection failures.

### 5. Resource Issue

Memory leaks causing gradual degradation, connection pool exhaustion, file descriptor or
handle leaks, disk space or quota exceeded, CPU saturation from inefficient processing.

### 6. Environment

Missing runtime dependency, wrong library or framework version, platform-specific behavior
differences, permission or access control issues, timezone or locale-related behavior.

## Evidence Standards

### Evidence Types

| Type | Strength | Description |
|---|---|---|
| **Direct** | Strong | Observable proof at a specific code location — e.g., `file.ts:42` shows `>` where `>=` is needed |
| **Correlational** | Medium | Timing or pattern match without proven causation — e.g., error rate spiked after commit `abc123` |
| **Testimonial** | Weak | Reported behavior without verification — e.g., "it works on my machine" |
| **Absence** | Variable | Something expected is missing — e.g., no null check found in the code path |

### Citation Format

Every piece of evidence must include a file:line reference:

```
The validation function at `src/validators/user.ts:87` does not check
for empty strings, only null/undefined. This allows empty email addresses
to pass validation.
```

### Confidence Levels

| Level | Threshold | Criteria |
|---|---|---|
| **High** | >80% | Multiple direct evidence pieces, clear causal chain, no contradicting evidence |
| **Medium** | 50-80% | Some direct evidence, plausible causal chain, minor ambiguities |
| **Low** | <50% | Mostly correlational evidence, incomplete causal chain, some contradicting evidence |

## Investigation Template

For each hypothesis, structure the investigation like this:

```markdown
## Hypothesis: {Clear, falsifiable statement}

**Category:** {Logic Error | Data Issue | State Problem | Integration Failure | Resource Issue | Environment}

**Scope:** {Files/directories to examine}

**Confirming evidence** (finding these supports the hypothesis):
1. {Observable condition}
2. {Observable condition}

**Falsifying evidence** (finding these disproves the hypothesis):
1. {Observable condition}
2. {Observable condition}
```

## Evidence Report Template

After investigating, report findings in this structure:

```markdown
## Report: {Hypothesis Title}

**Verdict:** {Confirmed | Falsified | Inconclusive}
**Confidence:** {High | Medium | Low}

### Supporting Evidence
1. `file:line` — {what was found}

### Contradicting Evidence
1. `file:line` — {what contradicts}

### Causal Chain (if confirmed)
1. {Root cause} →
2. {Intermediate effect} →
3. {Observable symptom}

### Recommended Fix
{Specific change with location}
```

## Arbitration Protocol

When multiple hypotheses have been investigated:

### Step 1 — Categorize Results

- **Confirmed**: High confidence, strong direct evidence, clear causal chain
- **Plausible**: Medium confidence, some evidence, reasonable explanation
- **Falsified**: Evidence directly contradicts the hypothesis
- **Inconclusive**: Not enough evidence to decide either way

### Step 2 — Rank Confirmed Hypotheses

If multiple hypotheses are confirmed, rank by:

1. Confidence level (High > Medium > Low)
2. Number of direct evidence pieces
3. Completeness of the causal chain
4. Absence of contradicting evidence

### Step 3 — Determine Root Cause

- **One clear winner**: Declare as root cause, propose fix
- **Multiple confirmed, related**: Compound issue — multiple contributing factors
- **Multiple confirmed, unrelated**: Primary = highest confidence; others may be separate bugs
- **None confirmed**: Generate new hypotheses based on evidence gathered so far

### Step 4 — Validate Before Closing

- Fix addresses the identified root cause
- Fix doesn't introduce new issues
- Original reproduction case no longer fails
- Related edge cases are covered
- Tests are added or updated

## Common Patterns by Symptom

### "500 Internal Server Error"

1. Unhandled exception in request handler (Logic Error)
2. Database connection failure (Resource Issue)
3. Missing environment variable (Environment)

### "Intermittent / Flaky Failure"

1. Shared state mutation without synchronization (State Problem)
2. Async operation ordering assumption (Logic Error)
3. Cache staleness window (State Problem)

### "Works Locally, Fails in Production"

1. Environment variable mismatch (Environment)
2. Different dependency version (Environment)
3. Resource limits — memory, connections (Resource Issue)

### "Regression After Deploy"

1. New code introduced a bug (Logic Error)
2. Configuration change (Integration Failure)
3. Database migration issue (Data Issue)
