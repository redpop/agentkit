# TYPO3 Content Blocks Specialist

> Content Blocks v1.3 expert for creating, configuring, and optimizing TYPO3 content blocks.

## Overview

Specializes in TYPO3 Content Blocks v1.3 including Content Elements, Page Types, and Record Types.
Handles field configuration (Text, File, Link, Select, Collection, etc.), Fluid template development,
backend previews, XLIFF localization, and migration from Mask/DCE.

## Usage

```
Agent tool with subagent_type="typo3-content-blocks-specialist"
```

Part of the **ak-typo3** plugin. Uses Read, Grep, Glob, Edit, and Write tools.
References knowledge files: `content-blocks-core-patterns.md`, `content-blocks-shared-partials.md`,
`content-blocks-v13-complete-reference.md`, `field-naming-reference.md`, `backend-preview-reference.md`.

## When to Use

- Creating new Content Blocks with YAML configuration
- Configuring field types including nested Collections with labelField and restrictedContentTypes
- Building Fluid frontend templates and backend preview templates
- Migrating from Mask or DCE to Content Blocks
- Optimizing existing Content Block configurations

## Methodology

1. **Requirements Analysis** -- Understand content structure, field relationships, editor workflows
2. **Configuration Design** -- Design config.yaml with proper field types, validation, prefixing strategy
3. **Template Implementation** -- Create Fluid templates using `{data.{vendor}_{name}_{field}}` access pattern
4. **Preview and Localization** -- Build backend previews and complete XLIFF translation files

## Output

Produces a configuration summary (block name, type, field count), quality assessment
(YAML validity, field naming compliance, template quality), and recommendations.

## Related

- [typo3-architect](typo3-architect.md) -- Overall TYPO3 architecture
- [typo3-fluid-expert](typo3-fluid-expert.md) -- Fluid template engine
- [ak-typo3:content-blocks skill](../../../plugins/ak-typo3/skills/content-blocks/SKILL.md) -- Content Blocks generation skill
