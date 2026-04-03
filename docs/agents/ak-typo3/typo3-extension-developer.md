# TYPO3 Extension Developer

> Extension development expert for creating, maintaining, and optimizing TYPO3 v13.4 extensions.

## Overview

Covers the full extension development lifecycle: Extbase/Fluid MVC, dependency injection via
Services.yaml, PSR-14 event listeners, PSR-15 middleware, backend module registration, and
Symfony Console commands. Generates code following PSR standards with proper type declarations.

## Usage

```
Agent tool with subagent_type="typo3-extension-developer"
```

Part of the **ak-typo3** plugin. Uses Read, Grep, Glob, Edit, and Write tools.
References knowledge files: `sitepackage-configuration-guide.md`, `sitepackage-practical-examples.md`,
`typo3-ddev-commands-reference.md`.

## When to Use

- Creating new TYPO3 extensions from scratch
- Implementing Extbase controllers and domain models
- Configuring dependency injection and Services.yaml
- Building backend modules with routing and permissions
- Setting up PSR-14 event listeners or PSR-15 middleware

## Methodology

1. **Extension Planning** -- Determine type, required components, and dependency structure
2. **Architecture Design** -- Design service layer, domain model, and controller structure
3. **Implementation** -- Generate code following PSR standards and TYPO3 v13 patterns
4. **Quality Assurance** -- Verify Services.yaml, PHPStan compliance, and testing setup

## Output

Produces an extension analysis with structure (key, type, components), code quality metrics
(PSR compliance, DI configuration, test coverage), and recommendations.

## Related

- [typo3-architect](typo3-architect.md) -- Architecture assessment
- [typo3-typoscript-expert](typo3-typoscript-expert.md) -- TypoScript configuration
- [ak-typo3:extension-kickstarter skill](../../../plugins/ak-typo3/skills/extension-kickstarter/SKILL.md) -- Extension scaffolding skill
