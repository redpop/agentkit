# TYPO3 Make Content Block Wrapper

> Intelligent wrapper for the native `make:content-block` command with smart defaults and skeleton management.

## Overview

Wraps the TYPO3 `make:content-block` CLI command with automatic vendor/extension detection, configuration management via `content-blocks.yaml`, built-in skeleton templates (hero, card-grid, accordion, landing-page), batch creation from YAML files, and migration helpers for Mask/DCE. Handles prerequisites checking, cache flushing, and post-generation setup.

## Usage

```text
/ak-typo3:make-content-block [flags]
```

**Flags:** `--vendor=...`, `--type=content-element|page-type|record-type`, `--skeleton-path=...`, `--config-path=...`, `--create-skeleton`, `--batch=file.yaml`, `--migrate-from=mask|dce`

## When to Use

- Creating content blocks using the native TYPO3 CLI command
- Batch-creating multiple content blocks from a definition file
- Migrating from Mask or DCE to Content Blocks
- Managing reusable skeleton templates for consistent scaffolding
- When you want smart defaults (vendor from composer.json, extension auto-detection)

## Best Practices

- Ensure `friendsoftypo3/content-blocks:^1.3` is installed before running
- Use `content-blocks.yaml` for persistent vendor/extension/skeleton configuration
- Create custom skeletons with `--create-skeleton` for project-specific patterns
- Use `--batch` for bulk creation instead of running the command repeatedly
- Vendor is auto-detected from `composer.json`, git remote URL, or existing Content Blocks

## Related

- [content-blocks](./content-blocks.md) -- generate Content Blocks directly (without the CLI wrapper)
- [sitepackage](./sitepackage.md) -- create the SitePackage that hosts content blocks
