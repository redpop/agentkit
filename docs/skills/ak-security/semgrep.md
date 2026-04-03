# Semgrep Static Analysis

> Fast, pattern-based static analysis for security scanning and custom rule creation.

## Overview

Provides both scanning and rule authoring capabilities for Semgrep. Supports quick scans with curated rulesets (OWASP, CWE, security-audit), custom rule creation with pattern matching and taint-mode data flow analysis, and CI/CD integration. Can use Semgrep MCP tools when available, falling back to CLI commands.

## Usage

```text
/ak-security:semgrep
```

**Quick scan:** `semgrep --config auto .`

**Ruleset scan:** `semgrep --config p/security-audit --config p/owasp-top-ten .`

**Custom rule:** Write YAML rules with pattern matching or taint mode for project-specific checks.

## When to Use

- Running security scans on a codebase (minutes, not hours)
- Detecting known vulnerability patterns (OWASP, CWE)
- Creating custom detection rules for project-specific patterns
- Enforcing coding standards and best practices via static analysis
- Setting up CI/CD security scanning with GitHub Actions

## Best Practices

- Prioritize taint mode over pattern matching for injection vulnerabilities
- Always write test cases (`ruleid:` and `ok:` annotations) before writing rules
- Use `semgrep --test` to validate rules -- untested rules have hidden false positives
- Start with curated rulesets (`p/security-audit`, `p/owasp-top-ten`) before writing custom rules
- Use `# nosemgrep` comments sparingly and only for confirmed false positives

## Related

- [code-security](./code-security.md) -- security guidelines that inform what to scan for
- [llm-security](./llm-security.md) -- LLM-specific security rules
- [Semgrep Registry](https://semgrep.dev/explore) -- browse available rulesets
