# TYPO3 SitePackage Generator

> Create a complete TYPO3 v13.4 SitePackage with Site Sets, PAGEVIEW, and Fluid Styled Content.

## Overview

Generates a full SitePackage based on the official TYPO3 template from get.typo3.org. Includes `composer.json`, `ext_emconf.php`, Site Set configuration (config.yaml, settings.yaml, page.tsconfig, TypoScript), CKEditor/RTE setup, PAGEVIEW templates (Layouts, Pages, Partials), language files (XLIFF), and public assets structure. Optionally includes DDEV or Docker configuration.

## Usage

```text
/ak-typo3:sitepackage <vendor> <package-name> [flags]
```

**Flags:** `--include-ddev`, `--include-docker`, `--author=name`, `--email=address`

If arguments are missing, the skill asks interactively for vendor, package name, title, and author details.

## Examples

```text
/ak-typo3:sitepackage mycompany corporate-site
```

Creates a SitePackage for vendor `mycompany` and package `corporate-site` (the two positional arguments) with the full
v13.4 structure.

```text
/ak-typo3:sitepackage mycompany corporate-site --include-ddev
```

Adds DDEV configuration (`--include-ddev`) for local development with PHP 8.2 and MariaDB 10.11.

```text
/ak-typo3:sitepackage mycompany corporate-site --include-docker
```

Adds Docker configuration (`--include-docker`) instead of DDEV for the local development environment.

```text
/ak-typo3:sitepackage mycompany corporate-site --author="Jane Doe" --email=jane@example.com
```

Pre-fills the extension author metadata via `--author` and `--email` instead of prompting for them.

## When to Use

- Starting a new TYPO3 v13.4 project from scratch
- Setting up a SitePackage with modern Site Sets configuration
- Creating a foundation that includes PAGEVIEW, Fluid Styled Content, and RTE
- Bootstrapping a TYPO3 project with DDEV or Docker support

## Best Practices

- Use lowercase vendor names and kebab-case package names
- Configure Site Sets in the TYPO3 Site Configuration after installation
- The SitePackage depends on `fluid-styled-content` -- ensure it is available
- Use `--include-ddev` for local development with PHP 8.2 and MariaDB 10.11
- After creation, register in `composer.json` repositories and run `composer require`

## Related

- [content-blocks](./content-blocks.md) -- add content blocks to the SitePackage
- [fluid-components](./fluid-components.md) -- add reusable Fluid components
- [extension-kickstarter](./extension-kickstarter.md) -- create standalone extensions (non-SitePackage)
