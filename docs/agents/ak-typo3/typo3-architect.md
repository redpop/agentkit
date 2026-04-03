# TYPO3 Architect

> Enterprise CMS architecture, extension design, and performance optimization for TYPO3 v13.4.

## Overview

Assesses TYPO3 project architecture including dependency injection, event systems, Site Sets (v13),
multi-site setups, caching strategies, and security patterns. Analyzes the full stack from
extension structure to frontend asset delivery and implements improvements directly.

## Usage

```
Agent tool with subagent_type="typo3-architect"
```

Part of the **ak-typo3** plugin. Uses Read, Grep, Glob, Edit, and Write tools.
References knowledge files: `sitepackage-configuration-guide.md`, `sitepackage-structure-reference.md`,
`troubleshooting-matrix.md`, `typo3-ddev-commands-reference.md`.

## When to Use

- Reviewing overall TYPO3 system architecture
- Planning extension structure and dependencies
- Evaluating caching and database performance
- Designing multi-site or multi-language setups
- Security audits (CSP, access control, input validation)

## Methodology

1. **Architecture Assessment** -- Analyze project structure, dependencies, and configuration quality
2. **Pattern Evaluation** -- Check TYPO3 v13 compliance (Site Sets, PAGEVIEW, Content Blocks, modern TypoScript)
3. **Performance Analysis** -- Evaluate caching, database queries, extension loading, frontend delivery
4. **Security Review** -- Assess CSP headers, input handling, access control, extension security

## Output

Produces an architecture score (X/10), version compliance status, findings by category
(architecture, performance, security), and prioritized recommendations (immediate, short-term, long-term).

## Related

- [typo3-extension-developer](typo3-extension-developer.md) -- Extension development
- [typo3-typoscript-expert](typo3-typoscript-expert.md) -- TypoScript configuration
- [typo3-content-blocks-specialist](typo3-content-blocks-specialist.md) -- Content Blocks
