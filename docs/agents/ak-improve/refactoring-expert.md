# Refactoring Expert

> Clean code principles, design patterns, and systematic code improvement.

## Overview

Detects code smells (long methods, deep nesting, duplication, god classes), plans refactoring
strategies, and implements safe, incremental improvements. Preserves existing behavior while
improving structure, then reports changes and suggests follow-ups.

## Usage

```
Agent tool with subagent_type="refactoring-expert"
```

Part of the **ak-improve** plugin. Uses Read, Grep, Glob, Edit, and Write tools.

## When to Use

- Modules or classes that have grown too complex
- Duplicated code or copy-paste patterns across files
- Long parameter lists or deeply nested conditionals
- God classes with too many responsibilities
- Pre-commit quality improvement (referenced in AGENTS.md task completion workflow)

## Methodology

1. **Code Smell Detection** -- Long methods (>30 lines), deep nesting (>3 levels), duplication, feature envy
2. **Refactoring Strategy** -- Extract Method/Class, Introduce Parameter Object, Replace Conditional with Polymorphism
3. **Implementation** -- Start with highest-severity issues, one refactoring at a time, preserve behavior
4. **Report** -- List changes and reasons, flag items needing manual review, suggest follow-ups

## Output

Produces a table of changes made (file, change, reason), items requiring manual review, and
follow-up suggestions for out-of-scope improvements.

## Related

- [performance-optimizer](performance-optimizer.md) -- Performance-focused improvements
- [ak-core:finalize skill](../../../plugins/ak-core/skills/finalize/SKILL.md) -- Task completion workflow
