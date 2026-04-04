---
name: workflow
description: >
  Generate or audit a Task Completion Workflow for a project. Use when the user asks to
  "create a workflow", "set up finalize steps", "generate task completion workflow",
  "audit my workflow", "check workflow", or wants to ensure their AGENTS.md workflow
  section matches the current project tooling.
---

# Workflow

Generate a project-specific Task Completion Workflow for AGENTS.md, or audit an existing one against the current project state.

## Arguments

Parse `$ARGUMENTS` for mode:

| Argument | Mode |
|----------|------|
| *(none)* | **Generate** — Scan project, build workflow, write to AGENTS.md |
| `--audit` | **Audit** — Verify existing workflow against current tooling |

## Mode: Generate

### Step 1: Locate Project Instructions

Search for instruction files:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.claude/CLAUDE.md`

If multiple exist, prefer `AGENTS.md`. Remember the chosen file for Step 5.

### Step 2: Check for Existing Workflow

In the located file, search for a `##` heading matching (case-insensitive):

- `Task completion workflow`
- `Post-implementation workflow`
- `Quality assurance steps`
- `After implementation`
- `Completion checklist`
- Any `##` containing "completion", "workflow", "finalize", "quality"

If found: warn the user that a workflow already exists, show it, and ask whether to **replace** or **cancel**. Do not proceed without confirmation.

### Step 3: Detect Project Tooling

Scan the project root for tooling signals. Run detection in parallel where possible:

**Package/dependency files:**

| File | Scan For |
|------|----------|
| `package.json` | `scripts` block (build, test, lint, format, typecheck, check), `devDependencies` (eslint, prettier, biome, vitest, jest, mocha, playwright, cypress) |
| `composer.json` | `scripts` block, `require-dev` (phpunit, phpstan, phpcs, php-cs-fixer, rector) |
| `pyproject.toml` | `[tool.*]` sections (pytest, ruff, mypy, black, isort, flake8) |
| `Cargo.toml` | Presence implies `cargo build`, `cargo test`, `cargo clippy`, `cargo fmt` |
| `go.mod` | Presence implies `go build`, `go test`, `go vet` |
| `Makefile` / `Justfile` | Target names (build, test, lint, format, check) |
| `Gemfile` | `development`/`test` groups (rspec, rubocop, minitest) |

**Config files as secondary signals:**

| File | Implies |
|------|---------|
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

**Review tools:**

| Check | Implies |
|-------|---------|
| `which coderabbit` succeeds | CodeRabbit CLI available |
| `coderabbit` in global npm (`npm ls -g coderabbit`) | CodeRabbit CLI available |
| `.coderabbit.yaml` in project root | CodeRabbit configured (CLI may still be missing) |

**CI as hints (lower priority):**

Check `.github/workflows/*.yml`, `.gitlab-ci.yml`, or `Jenkinsfile` for commands that confirm which tools the project actually runs.

Produce a **tooling summary**: which build, test, lint, format, typecheck, and review commands are available.

### Step 4: Build the Workflow

Using the tooling summary, construct a 6-step workflow. Each step is included only if the project has matching tools.

**Template:**

```markdown
## Task completion workflow

After implementing changes:

1. **Validate** — {build_cmd} {test_cmd}
2. **Tests** — Check whether new or updated tests are needed for the changes
   - Look at modified/added files and verify matching test files exist
   - If test gaps are found, write the missing tests before continuing
3. **Format** — {format_cmd}
4. **Simplify** — Review changed code for unnecessary complexity
   - Claude Code: invoke the `code-simplifier:code-simplifier` agent on modified files
5. **Review** — {review_step}
6. **Re-validate** — {build_cmd} {test_cmd}

Skip steps 4-5 for trivial changes (typo fixes, config updates, single-line changes).
```

**Adaptation rules:**

- Replace `{build_cmd}` with the actual build command (e.g., `pnpm build`, `cargo build`, `go build ./...`). Omit if no build step exists.
- Replace `{test_cmd}` with the actual test command (e.g., `pnpm test`, `pytest`, `cargo test`). Omit if no tests exist.
- Replace `{format_cmd}` with the detected formatter (e.g., `pnpm biome check --write`, `cargo fmt`, `ruff format .`). Omit Step 3 entirely if no formatter is detected.
- If a type checker is detected, add it to Step 1 and Step 6 (e.g., `pnpm typecheck`).
- If linting is separate from formatting, combine in Step 3 (e.g., `pnpm lint --fix && pnpm format`).
- Replace `{review_step}` based on CodeRabbit availability:
  - **CodeRabbit available**: Use the CodeRabbit variant:

    ```
    5. **Review** — Run CodeRabbit review on uncommitted changes, then fix reported issues
       - Claude Code: invoke `/ak-review:coderabbit`
       - Other tools: run `coderabbit review --prompt-only --type uncommitted`
    ```

  - **CodeRabbit not available**: Use the self-review variant:

    ```
    5. **Review** — Review uncommitted changes for bugs, security issues, and design problems
       - Run `git diff` and analyze each changed file for: logic errors, missed edge cases,
         security concerns, naming/readability issues, and consistency with project conventions
       - Fix any issues found before continuing
    ```

- For projects without build/test tooling (e.g., pure Markdown repos), reduce to the applicable steps only.

### Step 5: Present and Confirm

Show the generated workflow to the user. Explain which tools were detected and how each step maps to them.

Wait for the user to review and approve. If they request changes, adjust and present again.

### Step 6: Write to Project Instructions

After confirmation:

1. Read the chosen instruction file from Step 1
2. Append the workflow section at an appropriate location (typically after existing dev environment or code style sections, before commit guidelines if present)
3. If no instruction file exists, create `AGENTS.md` with a minimal structure containing the workflow section
4. Show the user what was written and where

## Mode: Audit (`--audit`)

### Step 1: Find Existing Workflow

Same detection as Generate Steps 1-2. If no workflow is found, inform the user and suggest running `/ak-review:workflow` (without `--audit`) to create one.

### Step 2: Detect Current Tooling

Same detection as Generate Step 3.

### Step 3: Compare Workflow Against Tooling

For each step in the existing workflow, check:

| Check | Issue |
|-------|-------|
| Referenced command not found | Tool may have been removed or renamed |
| Referenced tool not in dependencies | Dependency might have been dropped |
| Available tool not mentioned | New tool added but workflow not updated |
| Generic placeholder remains | Command was never customized (e.g., still says "build and tests") |
| Script name changed | `package.json` script renamed but workflow still references old name |
| Review tool mismatch | Workflow references CodeRabbit but CLI not installed, or CodeRabbit is now available but workflow uses self-review |

Also verify structural completeness:

- Are the 6 standard steps present (validate, tests, format, simplify, review, re-validate)?
- Is the skip-clause present for trivial changes?
- Are tool invocation hints accurate (correct agent/skill names)?
- Does the review step match what's actually available (CodeRabbit vs self-review)?

### Step 4: Report Findings

Present results grouped by severity:

```markdown
## Workflow Audit Results

### Issues Found
- **[Step 1]** `pnpm build` — script "build" not found in package.json (removed?)
- **[Step 3]** References `prettier` — project now uses `biome` instead
- **[Missing]** No type-check step — `tsconfig.json` detected but not referenced

### Up to Date
- **[Step 2]** Test coverage check — OK
- **[Step 5]** CodeRabbit review — OK
- **[Step 6]** Re-validate matches Step 1 — OK

### Suggested Workflow
[Show the corrected workflow that would be generated today]
```

### Step 5: Offer to Fix

If issues were found, ask the user whether to apply the suggested corrections. On approval, update the workflow section in place (replace old section with corrected version).
