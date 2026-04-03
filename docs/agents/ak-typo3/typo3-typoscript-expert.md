# TYPO3 TypoScript Expert

> TypoScript configuration, Site Sets, setup optimization, and debugging for TYPO3 v13.4.

## Overview

Master of modern TypoScript patterns including Site Sets (config.yaml, settings.yaml, dependencies),
DataProcessor chains, the modern condition API, PAGEVIEW content object, and caching strategies.
Identifies legacy patterns and migrates them to TYPO3 v13 equivalents.

## Usage

```
Agent tool with subagent_type="typo3-typoscript-expert"
```

Part of the **ak-typo3** plugin. Uses Read, Grep, Glob, Edit, and Write tools.
References knowledge files: `sitepackage-configuration-guide.md`, `sitepackage-practical-examples.md`,
`troubleshooting-matrix.md`.

## When to Use

- Configuring TypoScript setup, constants, or TSconfig
- Optimizing Site Set configuration and dependency chains
- Debugging rendering issues or unexpected TypoScript behavior
- Implementing DataProcessor chains or custom processors
- Migrating legacy TypoScript (old conditions, stdWrap, deprecated content objects) to v13

## Methodology

1. **Configuration Audit** -- Analyze TypoScript setup, constants, and TSconfig for correctness
2. **Site Set Evaluation** -- Check config, dependencies, settings.yaml, and override chain
3. **Performance Analysis** -- Evaluate caching directives, USER/USER_INT usage, data processing efficiency
4. **Migration Assessment** -- Identify legacy patterns and suggest v13 equivalents

## Output

Produces a configuration summary (Site Sets, TypoScript/TSconfig line counts), quality scores
(modern patterns, performance, legacy code percentage), findings, and migration recommendations.

## Related

- [typo3-architect](typo3-architect.md) -- Architecture assessment
- [typo3-extension-developer](typo3-extension-developer.md) -- Extension development
- [ak-typo3:sitepackage skill](../../../plugins/ak-typo3/skills/sitepackage/SKILL.md) -- SitePackage creation skill
