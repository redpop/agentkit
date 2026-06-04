# TYPO3 Extension Kickstarter

> Create complete TYPO3 extensions using ext-kickstarter or manual scaffolding.

## Overview

Scaffolds TYPO3 extensions with `composer.json`, `ext_emconf.php`, `Services.yaml`, and type-specific code (plugins, backend modules, services, event listeners, console commands). Can use `stefanfroemken/ext-kickstarter` when available, or generates the full structure manually with best practices for TYPO3 13.4.

## Usage

```text
/ak-typo3:extension-kickstarter <extension-key> [flags]
```

**Flags:** `--type=basic|plugin|backend-module|service|content`, `--use-kickstarter`, `--composer-name=vendor/name`, `--with-backend-module`, `--with-plugin`, `--with-middleware`, `--with-command`, `--with-event-listener`, `--with-tests`

If no arguments are provided, the skill guides you interactively.

## Examples

```text
/ak-typo3:extension-kickstarter my_extension
```

Scaffolds a basic extension named `my_extension` (default `--type=basic`) with `composer.json`, `ext_emconf.php`, and DI
configuration.

```text
/ak-typo3:extension-kickstarter my_shop --type=plugin --with-plugin --with-tests
```

Creates an Extbase plugin extension (`--type=plugin`, `--with-plugin`) including a PHPUnit/PHPStan test setup
(`--with-tests`).

```text
/ak-typo3:extension-kickstarter my_api --with-middleware --with-command --with-event-listener
```

Builds an extension bundling a PSR-15 middleware (`--with-middleware`), a console command (`--with-command`), and an
attribute-based event listener (`--with-event-listener`).

```text
/ak-typo3:extension-kickstarter my_module --type=backend-module --with-backend-module --composer-name=acme/my-module
```

Generates a backend-module extension (`--type=backend-module`, `--with-backend-module`) with an explicit Composer
package name (`--composer-name`).

```text
/ak-typo3:extension-kickstarter my_extension --use-kickstarter
```

Delegates scaffolding to `stefanfroemken/ext-kickstarter` when installed (`--use-kickstarter`), falling back to manual
scaffolding otherwise.

## When to Use

- Starting a new TYPO3 extension from scratch
- Creating extensions with specific component types (plugin, backend module, service)
- Setting up proper PSR-4 autoloading and dependency injection
- Generating PHPUnit and PHPStan testing infrastructure

## Best Practices

- Use lowercase with underscores for extension keys (TYPO3 convention)
- Combine `--with-*` flags to include multiple features in one extension
- Use `--with-tests` from the start to include PHPUnit and PHPStan (level 5) configuration
- Event listeners use PHP 8.2 attributes (`#[AsEventListener]`) -- no manual registration needed
- Run `vendor/bin/typo3 extension:setup` after installation

## Related

- [sitepackage](./sitepackage.md) -- create a SitePackage (a specialized extension type)
- [content-blocks](./content-blocks.md) -- add content blocks to an existing extension
