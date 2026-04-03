# Solution Document Templates

Select the template matching the problem_type track (see `references/schema.yaml`).

---

## Bug Track

Use for: `build_error`, `test_failure`, `runtime_error`, `performance_issue`, `database_issue`, `security_issue`, `ui_bug`, `integration_issue`, `logic_error`

````markdown
---
title: [Concise problem title]
date: [YYYY-MM-DD]
category: [docs/solutions subdirectory]
module: [Module or area]
problem_type: [schema enum]
component: [schema enum]
symptoms:
  - [Observable symptom 1]
root_cause: [schema enum]
resolution_type: [schema enum]
severity: [schema enum]
tags: [keyword-one, keyword-two]
---

# [Concise problem title]

## Problem

[1-2 sentence description of the issue and its visible impact]

## Symptoms

- [Observable symptom or error message]

## What Didn't Work

- [Attempted approach and why it failed]

## Solution

[The fix that resolved the issue, with code snippets where useful]

## Why This Works

[Root cause explanation and why the solution addresses it]

## Prevention

- [Concrete practice, test, or guardrail to avoid recurrence]

## Related

- [Links to related docs or issues, if any]
````

---

## Knowledge Track

Use for: `best_practice`, `documentation_gap`, `workflow_issue`, `developer_experience`

````markdown
---
title: [Descriptive title]
date: [YYYY-MM-DD]
category: [docs/solutions subdirectory]
module: [Module or area]
problem_type: [schema enum]
component: [schema enum]
severity: [schema enum]
applies_when:
  - [Condition where this applies]
tags: [keyword-one, keyword-two]
---

# [Descriptive title]

## Context

[What situation, gap, or friction prompted this guidance]

## Guidance

[The practice, pattern, or recommendation with code examples where useful]

## Why This Matters

[Rationale and impact of following or ignoring this guidance]

## When to Apply

- [Conditions or situations where this applies]

## Examples

[Concrete before/after or usage examples]

## Related

- [Links to related docs or issues, if any]
````
