# ak-security

Security guidelines for writing secure code, building secure LLM applications, and performing static analysis with Semgrep.

## Skills

| Skill | Description |
|-------|-------------|
| `code-security` | OWASP Top 10, infrastructure security, and coding best practices across 15+ languages (28 rule categories) |
| `llm-security` | OWASP Top 10 for LLM Applications 2025 — prompt injection, excessive agency, output handling, and more |
| `semgrep` | Semgrep static analysis — running scans, writing custom rules, taint-mode dataflow analysis |

## Knowledge Base

- **code-security/** — 28 detailed rule files with vulnerable/secure code examples per language
- **llm-security/** — 10 OWASP LLM rule files with implementation patterns
- **semgrep/** — Quick reference and workflow guide for custom rule creation

## Usage

```bash
# Install the plugin
claude plugin add ak-security

# Use skills
/ak-security:code-security
/ak-security:llm-security
/ak-security:semgrep
```

## Attribution

Security rules based on [Semgrep Skills](https://github.com/semgrep/skills) by Semgrep, Inc. (MIT License).
