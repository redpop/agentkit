# CodeRabbit Review

> Automated code review with CodeRabbit CLI, critical evaluation, and systematic fix application.

## Overview

Executes a CodeRabbit CLI review against uncommitted, committed, or all changes. Parses the results, critically evaluates each finding (apply, adapt, or skip), implements valid fixes, and validates project consistency afterward. Includes intelligent base branch detection.

## Usage

```text
/ak-review:coderabbit [flags]
```

**Flags:** `--type uncommitted|committed|all` (default: uncommitted), `--base <branch>`

## When to Use

- After implementing changes, before committing
- As part of a task completion workflow
- When you want automated review beyond what linting catches
- Reviewing committed changes on a feature branch

## Best Practices

- Expect 7-30+ minutes for review execution -- the skill sets a 60-minute timeout
- Skip purely stylistic suggestions with no functional benefit
- Adapt fixes to match project conventions rather than applying them blindly
- When in doubt, skip and flag for manual review -- false positives happen
- Run validation after fixes to ensure project consistency

## Related

- [finalize](./finalize.md) -- full task completion workflow that includes CodeRabbit
- [ak-git:operations](../ak-git/operations.md) -- commit after review passes
