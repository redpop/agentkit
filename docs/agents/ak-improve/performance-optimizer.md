# Performance Optimizer

> Bottleneck identification, memory leak detection, and algorithmic efficiency optimization.

## Overview

Profiles code to find performance bottlenecks, classifies them by type (CPU, I/O, memory,
concurrency), and implements optimizations directly. Prioritizes changes by impact and documents
trade-offs made between readability and performance.

## Usage

```
Agent tool with subagent_type="performance-optimizer"
```

Part of the **ak-improve** plugin. Uses Read, Grep, Glob, Edit, and Write tools.

## When to Use

- Slow API responses or page load times
- N+1 query patterns or unnecessary database calls
- Memory leaks or excessive allocations
- Algorithmic inefficiency in hot paths
- Lock contention or thread pool exhaustion

## Methodology

1. **Performance Profiling** -- Identify hot paths, analyze complexity, detect N+1 queries and redundant computations
2. **Bottleneck Classification** -- Categorize as CPU-bound, I/O-bound, memory-bound, or concurrency
3. **Implementation** -- Apply optimizations (caching, async, algorithm improvements) incrementally
4. **Report** -- Document changes, suggest benchmarks, flag trade-offs

## Output

Produces a table of optimizations applied (location, type, change, expected impact), benchmarking
recommendations, and trade-off notes.

## Related

- [refactoring-expert](refactoring-expert.md) -- Code quality and structural improvements
