# Semgrep Static Analysis

> Fast, pattern-based static analysis for security scanning and custom rule creation.

## Overview

Provides both scanning and rule authoring capabilities for Semgrep. Supports quick scans with curated rulesets (OWASP, CWE, security-audit), custom rule creation with pattern matching and taint-mode data flow analysis, and CI/CD integration. Can use Semgrep MCP tools when available, falling back to CLI commands.

## Usage

```text
/ak-security:semgrep [target path and/or intent]
```

The skill has no formal flags. The text in `$ARGUMENTS` describes what to do — a target path to scan, a vulnerability
class to look for, or a request to author a custom rule. Based on that intent the skill runs Semgrep MCP tools
(`semgrep_scan`, `semgrep_scan_with_custom_rule`) when available, or falls back to the CLI commands below.

**Quick scan:** `semgrep --config auto .`

**Ruleset scan:** `semgrep --config p/security-audit --config p/owasp-top-ten .`

**Custom rule:** Write YAML rules with pattern matching or taint mode for project-specific checks.

## Examples

```text
/ak-security:semgrep scan src/api for injection vulnerabilities
```

Runs a scan over `src/api` looking for injection sinks; the trailing text scopes the target path and the intent (it
steers toward taint-mode/injection rulesets such as `p/owasp-top-ten`).

```text
/ak-security:semgrep run a full security audit on this repo and write SARIF
```

Scans the whole repository with curated rulesets and emits SARIF output (`semgrep --config p/security-audit --sarif -o
results.sarif .`) for upload to a code-scanning dashboard.

```text
/ak-security:semgrep write a taint-mode rule that flags request data reaching os.system
```

Authors a custom YAML rule (with `ruleid:`/`ok:` test cases) rather than scanning — the intent text asks for rule
creation, so the skill follows the rule-writing workflow.

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
