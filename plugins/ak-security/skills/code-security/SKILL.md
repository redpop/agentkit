---
name: code-security
description: >
  Security guidelines for writing secure code. Always consult when writing or reviewing any code
  that handles user input, authentication, file operations, database queries, network requests,
  or cryptography — even if the user doesn't explicitly mention security.
---

# Code Security Guidelines

Comprehensive security rules for writing secure code across 15+ languages. Covers OWASP Top 10, infrastructure security, and coding best practices with 28 rule categories.

## How to Use This Skill

**Proactive mode** — When writing or reviewing code, automatically check for relevant vulnerabilities based on the language and patterns present. You don't need to wait for the user to ask about security.

**Reactive mode** — When the user asks about security, use the categories below to find the relevant rule file, then read it for detailed vulnerable/secure code examples.

### Workflow

1. Identify the language and what the code does (handles input? queries a DB? reads files?)
2. Check the relevant rules below — focus on Critical and High impact first
3. Read the specific rule file from `${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/` for detailed code examples in that language
4. Apply the secure patterns, or flag the vulnerable patterns if reviewing

## Language-Specific Priority Rules

When writing code in these languages, check these rules first:

| Language | Priority Rules to Check |
|----------|------------------------|
| **Python** | SQL injection, command injection, path traversal, code injection, SSRF, insecure crypto |
| **JavaScript/TypeScript** | XSS, prototype pollution, code injection, insecure transport, CSRF |
| **Java** | SQL injection, XXE, insecure deserialization, insecure crypto, SSRF |
| **Go** | SQL injection, command injection, path traversal, insecure transport |
| **C/C++** | Memory safety, unsafe functions, command injection, path traversal |
| **Ruby** | SQL injection, command injection, code injection, insecure deserialization |
| **PHP** | SQL injection, XSS, command injection, code injection, path traversal |
| **HCL/YAML** | Terraform (AWS/Azure/GCP), Kubernetes, Docker, GitHub Actions |

## Categories

### Critical Impact

- **SQL Injection** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/sql-injection.md`) - Use parameterized queries, never concatenate user input
- **Command Injection** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/command-injection.md`) - Avoid shell commands with user input, use safe APIs
- **XSS** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/xss.md`) - Escape output, use framework protections
- **XXE** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/xxe.md`) - Disable external entities in XML parsers
- **Path Traversal** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/path-traversal.md`) - Validate and sanitize file paths
- **Insecure Deserialization** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/insecure-deserialization.md`) - Never deserialize untrusted data
- **Code Injection** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/code-injection.md`) - Never eval() user input
- **Hardcoded Secrets** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/secrets.md`) - Use environment variables or secret managers
- **Memory Safety** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/memory-safety.md`) - Prevent buffer overflows, use-after-free (C/C++)

### High Impact

- **Insecure Crypto** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/insecure-crypto.md`) - Use SHA-256+, AES-256, avoid MD5/SHA1/DES
- **Insecure Transport** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/insecure-transport.md`) - Use HTTPS, verify certificates
- **SSRF** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/ssrf.md`) - Validate URLs, use allowlists
- **JWT Issues** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/authentication-jwt.md`) - Always verify signatures
- **CSRF** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/csrf.md`) - Use CSRF tokens on state-changing requests
- **Prototype Pollution** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/prototype-pollution.md`) - Validate object keys in JavaScript

### Infrastructure

- **Terraform AWS/Azure/GCP** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/terraform-aws.md`, `${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/terraform-azure.md`, `${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/terraform-gcp.md`) - Encryption, least privilege, no public access
- **Kubernetes** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/kubernetes.md`) - No privileged containers, run as non-root
- **Docker** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/docker.md`) - Don't run as root, pin image versions
- **GitHub Actions** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/github-actions.md`) - Avoid script injection, pin action versions

### Medium/Low Impact

- **Regex DoS** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/regex-dos.md`) - Avoid catastrophic backtracking
- **Race Conditions** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/race-condition.md`) - Use proper synchronization
- **Correctness** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/correctness.md`) - Avoid common logic bugs
- **Best Practices** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/best-practice.md`) - General secure coding patterns
- **Performance** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/performance.md`) - Secure performance patterns
- **Maintainability** (`${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/maintainability.md`) - Maintainable secure code

See `${CLAUDE_PLUGIN_ROOT}/knowledge/code-security/_sections.md` for the full index with CWE/OWASP references.

## Quick Reference

| Vulnerability | Key Prevention |
|--------------|----------------|
| SQL Injection | Parameterized queries |
| XSS | Output encoding |
| Command Injection | Avoid shell, use APIs |
| Path Traversal | Validate paths |
| SSRF | URL allowlists |
| Secrets | Environment variables |
| Crypto | SHA-256, AES-256 |

## Attribution

Based on [Semgrep Skills](https://github.com/semgrep/skills) by Semgrep, Inc. (MIT License).
