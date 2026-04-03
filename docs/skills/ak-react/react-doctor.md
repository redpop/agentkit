# React Doctor

> Scan your React codebase for security, performance, correctness, and architecture issues.

## Overview

Runs `react-doctor` to analyze a React codebase and produce a 0-100 health score with actionable diagnostics. Covers security vulnerabilities, performance bottlenecks, correctness bugs, and architecture smells. Designed to run after making changes as a quick validation step.

## Usage

```text
/ak-react:react-doctor
```

Executes:

```bash
npx -y react-doctor@latest . --verbose --diff
```

## When to Use

- After implementing a React feature or bug fix
- During code review to catch issues early
- Before committing changes to validate React code quality
- As part of a finalize/completion workflow

## Best Practices

- Fix errors (highest severity) first, then re-run to verify the score improved
- Use `--diff` mode to focus on recently changed files
- Combine with [react-best-practices](./react-best-practices.md) for manual optimization guidance
- Run regularly during development, not just before release

## Related

- [react-best-practices](./react-best-practices.md) -- manual performance optimization guidelines
- [ak-review:coderabbit](../ak-review/coderabbit.md) -- broader code review beyond React-specific issues
