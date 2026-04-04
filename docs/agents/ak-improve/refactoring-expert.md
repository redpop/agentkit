# Refactoring Expert

> Structural code improvement through clean code techniques and proven design patterns.

## Overview

Identifies structural weaknesses (oversized functions, excessive nesting, duplication, bloated
classes), devises a safe improvement path, and applies changes incrementally. Preserves existing
behavior throughout and reports on each modification with follow-up recommendations.

## Usage

```
Agent tool with subagent_type="refactoring-expert"
```

Part of the **ak-improve** plugin. Uses Read, Grep, Glob, Edit, and Write tools.

## When to Use

- Modules or classes that have become unwieldy
- Copy-paste duplication spread across files
- Long argument lists or deeply nested control flow
- Monolithic classes carrying too many concerns
- Pre-commit quality pass (referenced in AGENTS.md task completion workflow)

## Methodology

1. **Structural Analysis** -- Oversized methods (>30 lines), deep nesting (>3 levels), duplication, misplaced logic
2. **Improvement Plan** -- Extract Method/Class, Introduce Parameter Object, Replace branching with Polymorphism
3. **Execution** -- Address most severe issues first, one change at a time, maintain existing behavior
4. **Summary** -- Document modifications and reasoning, flag items for manual review, suggest future work

## Output

Produces a table of modifications (file, change, motivation), items that need human judgment,
and suggestions for improvements outside the current scope.

## Related

- [performance-optimizer](performance-optimizer.md) -- Performance-focused optimization
- [ak-core:finalize skill](../../../plugins/ak-core/skills/finalize/SKILL.md) -- Task completion workflow
