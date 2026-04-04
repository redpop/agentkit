# Performance Optimizer

> Diagnoses slowdowns, traces root causes, and applies targeted performance fixes.

## Overview

Analyzes code to locate performance hotspots, classifies issues by category (compute, I/O,
memory, contention), and implements fixes directly. Prioritizes by expected impact and clearly
documents any trade-offs between speed and maintainability.

## Usage

```
Agent tool with subagent_type="performance-optimizer"
```

Part of the **ak-improve** plugin. Uses Read, Grep, Glob, Edit, and Write tools.

## When to Use

- Slow API responses or sluggish page loads
- N+1 query patterns or redundant database access
- Memory leaks or oversized allocations
- Inefficient algorithms on critical paths
- Thread pool saturation or lock conflicts

## Methodology

1. **Diagnosis** -- Trace hot spots, assess algorithmic complexity, find redundant work and N+1 patterns
2. **Root Cause Classification** -- Categorize as compute-heavy, I/O-heavy, memory pressure, or contention
3. **Fix & Optimize** -- Apply targeted changes (caching, async, better algorithms) incrementally
4. **Summary** -- Describe each fix, recommend measurement approaches, note trade-offs

## Output

Produces a table of applied fixes (location, category, change, expected gain), verification
suggestions, and notes on any trade-offs introduced.

## Related

- [refactoring-expert](refactoring-expert.md) -- Structural code quality improvements
