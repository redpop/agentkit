# Code Security Guidelines

> Comprehensive security rules for writing secure code across 15+ languages, covering OWASP Top 10 and 28 rule categories.

## Overview

Provides proactive and reactive security guidance when writing or reviewing code. Covers critical vulnerabilities (SQL injection, XSS, command injection, path traversal), high-impact issues (insecure crypto, SSRF, JWT, CSRF), infrastructure security (Terraform, Kubernetes, Docker, GitHub Actions), and general best practices. Each category links to a detailed knowledge file with vulnerable/secure code examples.

## Usage

```text
/ak-security:code-security [scope or topic]
```

This is a guideline skill — it carries no formal flags. It activates automatically (proactive mode) whenever code
handles user input, authentication, file operations, database queries, network requests, or cryptography. Any trailing
text in `$ARGUMENTS` is treated as a scope or topic (a file, directory, language, or vulnerability class) that focuses
which rules to consult.

## Examples

```text
/ak-security:code-security
```

Invoked with no arguments — Claude applies the relevant rule categories to whatever code is currently in context (the
file being written or reviewed).

```text
/ak-security:code-security review src/api for SQL injection and SSRF
```

The trailing text scopes the consultation to `src/api` and narrows focus to the SQL Injection and SSRF rule files.

```text
/ak-security:code-security check this Terraform for least-privilege issues
```

Directs the skill to the infrastructure rules (Terraform AWS/Azure/GCP) for the HCL in context.

## When to Use

- Writing code that processes user input or external data
- Reviewing code for security vulnerabilities
- Implementing authentication, authorization, or cryptography
- Configuring infrastructure (Terraform, Kubernetes, Docker)
- Any code touching databases, file systems, or shell commands

## Best Practices

- Check critical-impact rules first: SQL injection, command injection, XSS, path traversal
- Use the language-specific priority table to focus on the most relevant rules
- Read the specific knowledge file for detailed code examples in your language
- Parameterized queries for SQL, safe APIs instead of shell commands, output encoding for XSS
- Never hardcode secrets -- use environment variables or secret managers

## Related

- [llm-security](./llm-security.md) -- security for LLM-specific applications
- [semgrep](./semgrep.md) -- automated static analysis scanning
- Based on [Semgrep Skills](https://github.com/semgrep/skills) (MIT License)
