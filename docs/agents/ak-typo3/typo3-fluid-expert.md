# TYPO3 Fluid Expert

> Fluid Template Engine specialist for template architecture, ViewHelper development, and rendering optimization.

## Overview

Analyzes and improves Fluid templates for TYPO3 v13+, covering template/partial/layout organization,
custom ViewHelper creation, component patterns (Atomic Design, slot-based architecture), and
rendering performance optimization including caching and template compilation.

## Usage

```
Agent tool with subagent_type="typo3-fluid-expert"
```

Part of the **ak-typo3** plugin. Uses Read, Grep, Glob, Edit, and Write tools.
References knowledge files: `content-blocks-shared-partials.md`, `sitepackage-structure-reference.md`.

## When to Use

- Analyzing Fluid template architecture and organization
- Creating custom ViewHelpers with proper testing
- Optimizing rendering performance and caching
- Designing component architecture (Atomic Design with Fluid)
- Checking TYPO3 v13 Fluid conventions and deprecated patterns

## Methodology

1. **Template Inventory** -- Scan and catalog all templates, partials, layouts, and ViewHelpers
2. **Architecture Analysis** -- Evaluate organization, naming conventions, and reuse patterns
3. **Performance Assessment** -- Identify rendering bottlenecks, unnecessary ViewHelper calls, caching gaps
4. **Convention Compliance** -- Check v13 Fluid conventions, namespace usage, deprecated patterns

## Output

Produces scores for architecture, ViewHelper quality, performance, and convention compliance,
with categorized findings and prioritized recommendations (immediate, short-term, long-term).

## Related

- [typo3-content-blocks-specialist](typo3-content-blocks-specialist.md) -- Content Blocks templates
- [typo3-architect](typo3-architect.md) -- Overall architecture
- [ak-typo3:fluid-components skill](../../../plugins/ak-typo3/skills/fluid-components/SKILL.md) -- Fluid component generation skill
