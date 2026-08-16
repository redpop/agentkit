# Project Tooling Detection

Shared detection signals for skills that need to know what a project builds, tests, lints and formats with.
Referenced by `/ak-review:workflow` (to build a task completion workflow) and `/ak-review:deps` (to build a
dependency update baseline). Each consumer adds its own signals on top; only what both need lives here.

Run detection in parallel where possible. A signal found here is a *candidate* — confirm the command actually runs
before writing it into a generated file.

## Package and dependency manifests

| File | Scan for |
|---|---|
| `package.json` | `scripts` block (build, test, lint, format, typecheck, check), `devDependencies` (eslint, prettier, biome, vitest, jest, mocha, playwright, cypress) |
| `composer.json` | `scripts` block, `require-dev` (phpunit, phpstan, phpcs, php-cs-fixer, rector) |
| `pyproject.toml` | `[tool.*]` sections (pytest, ruff, mypy, black, isort, flake8), `[project.optional-dependencies]` |
| `Cargo.toml` | Presence implies `cargo build`, `cargo test`, `cargo clippy`, `cargo fmt` |
| `go.mod` | Presence implies `go build`, `go test`, `go vet` |
| `Makefile` / `Justfile` | Target names (build, test, lint, format, check) |
| `Gemfile` | `development`/`test` groups (rspec, rubocop, minitest) |

## Config files as secondary signals

| File | Implies |
|---|---|
| `biome.json` / `biome.jsonc` | Biome formatter/linter |
| `.eslintrc*` / `eslint.config.*` | ESLint |
| `.prettierrc*` | Prettier |
| `tsconfig.json` | TypeScript type checking |
| `.phpstan.neon*` | PHPStan |
| `phpunit.xml*` | PHPUnit |
| `.ruff.toml` / `ruff.toml` | Ruff |
| `pytest.ini` / `conftest.py` | Pytest |
| `rustfmt.toml` | Rust formatting |
| `.golangci.yml` | GolangCI-Lint |

## Lockfiles — which package manager actually runs

A manifest says what the project depends on; the lockfile says what installs it. When both `package-lock.json` and
`pnpm-lock.yaml` exist, one of them is stale — say so rather than picking silently.

| Lockfile | Manager |
|---|---|
| `pnpm-lock.yaml` | pnpm |
| `package-lock.json` | npm |
| `yarn.lock` | Yarn |
| `bun.lockb` / `bun.lock` | Bun |
| `composer.lock` | Composer |
| `poetry.lock` / `uv.lock` / `Pipfile.lock` | Poetry / uv / Pipenv |
| `Cargo.lock` | Cargo |
| `go.sum` | Go modules |
| `Gemfile.lock` | Bundler |

## CI as confirmation (lower priority)

Check `.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, or `.circleci/config.yml` for the commands the
project actually runs. CI confirms which of the detected candidates matter; it does not by itself introduce a tool.

Note what CI does **not** run. A check that only ever runs locally has no safety net, and a generated file should
say so instead of implying the pipeline covers it.
