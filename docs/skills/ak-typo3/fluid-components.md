# TYPO3 Fluid Components Generator

> Generate Fluid v4 Components for TYPO3 v13 with Atomic Design patterns, or analyze existing templates.

## Overview

Operates in two modes. **Generation mode** creates Fluid v4 components following Atomic Design (Atom, Molecule, Organism) with typed `<f:argument>` declarations, SCSS scaffolds using BEM methodology, PHPUnit tests, and a `ComponentCollection` class. **Analysis mode** (`--analyze`) evaluates existing Fluid templates for architecture, ViewHelper usage, performance, and TYPO3 v13+ compliance.

## Usage

```text
/ak-typo3:fluid-components <component-name> [flags]
/ak-typo3:fluid-components --analyze
```

**Flags:** `--type=atom|molecule|organism` (default: atom), `--sitepackage=path`, `--analyze`

If no arguments are provided, the skill guides you interactively.

## When to Use

- Building reusable UI components for a TYPO3 v13 project
- Organizing templates with Atomic Design (atoms, molecules, organisms)
- Analyzing existing Fluid templates for quality and optimization opportunities
- Setting up component-based architecture with proper type safety

## Best Practices

- Use Atomic Design levels consistently: atoms for buttons/inputs, molecules for cards/forms, organisms for headers/grids
- Note that `fc:component` syntax is not available in Fluid v4.3/TYPO3 13 -- use standard partials instead
- Include ARIA attributes in atom-level components for accessibility
- Use the `--analyze` mode after migration to identify TYPO3 v13+ compliance gaps
- Each component gets SCSS with BEM methodology and variant/size modifiers

## Related

- [content-blocks](./content-blocks.md) -- generate Content Blocks that can use these components
- [sitepackage](./sitepackage.md) -- the SitePackage that houses component templates
- `typo3-fluid-expert` agent -- performs the analysis in `--analyze` mode
