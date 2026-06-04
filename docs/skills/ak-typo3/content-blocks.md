# TYPO3 Content Blocks Generator

> Generate Content Blocks v1.3 compatible configurations for TYPO3 v13.4.

## Overview

Creates complete Content Block scaffolding including `config.yaml`, Fluid templates (frontend and backend preview), XLIFF language files, and icon placeholders. Supports both Content Elements and Page Types with field type templates (Text, Textarea, File, Link, Select, Collection, Checkbox, DateTime, Number). Optionally generates Fluid v4 Components alongside.

## Usage

```text
/ak-typo3:content-blocks <name> [flags]
```

**Arguments:** `name` (kebab-case, e.g., "hero-section")

**Flags:** `--type=element|page`, `--fields=field1,field2,...`, `--sitepackage=path`, `--with-components`, `--component-type=inline|external`

If arguments are missing, the skill guides you interactively.

## Examples

```text
/ak-typo3:content-blocks hero-section
```

Creates a Content Element named `hero-section` with default settings (`--type=element`) and prompts for fields interactively.

```text
/ak-typo3:content-blocks teaser-card --fields=header,text,image,link
```

Scaffolds a Content Element with four pre-defined fields (`--fields`), generating the matching `config.yaml` and Fluid
templates.

```text
/ak-typo3:content-blocks landing-page --type=page --sitepackage=./packages/my-site
```

Creates a Page Type (`--type=page`) inside a non-default SitePackage location (`--sitepackage`).

```text
/ak-typo3:content-blocks hero-section --with-components --component-type=external
```

Generates the Content Block plus matching Fluid v4 Components (`--with-components`) as separate external component files
(`--component-type=external`).

## When to Use

- Creating new content elements for a TYPO3 v13 project
- Setting up page types with Content Blocks v1.3
- Scaffolding content blocks with proper field configurations
- Generating Content Blocks with matching Fluid Components

## Best Practices

- Use kebab-case for block names and proper vendor prefixes
- Access fields in templates with `{data.{vendor}_{name}_{field}}` pattern
- Always flush caches after generation: `vendor/bin/typo3 cache:flush`
- Use `--with-components` to generate Atomic Design components alongside blocks
- Set `prefixFields: true` and `prefixType: vendor` in config for namespace isolation

## Related

- [make-content-block](./make-content-block.md) -- wrapper for the native TYPO3 command
- [fluid-components](./fluid-components.md) -- standalone Fluid component generation
- [sitepackage](./sitepackage.md) -- create the SitePackage that hosts content blocks
