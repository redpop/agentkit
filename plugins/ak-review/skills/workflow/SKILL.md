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
| _(none)_ | **Generate** — Scan project, build workflow, write to AGENTS.md |
| `--audit` | **Audit** — Verify existing workflow against current tooling |

## Workflow Shapes

A workflow section in the instruction file is in one of two shapes — both modes below refer back to this definition rather than re-deriving it:

- **Pointer form** (target shape): a short paragraph referencing a skill file path (`.claude/skills/task-completion/SKILL.md`), which holds the actual numbered steps. Keeps AGENTS.md/CLAUDE.md lean, since that file is resent in full on every prompt while the skill file is only loaded when invoked.
- **Inline form** (legacy): the numbered steps are written directly into the instruction file's section.

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

If found, determine its shape (see Workflow Shapes above) — in pointer form, also read the pointer target. Warn the user that a workflow already exists, show it (the pointer target's content if pointer form), and ask whether to **replace** or **cancel**. Do not proceed without confirmation.

### Step 3: Detect Project Tooling

Read `${CLAUDE_PLUGIN_ROOT}/knowledge/project-tooling-detection.md` and apply its manifest, config-file and
lockfile tables — they are shared with `/ak-review:deps` so both skills detect the same way. Run detection in
parallel where possible.

Then add the signals below, which are specific to building a task completion workflow:

**Review tools:**

| Check | Implies |
|-------|---------|
| `which coderabbit` succeeds | CodeRabbit CLI available |
| `coderabbit` in global npm (`npm ls -g coderabbit`) | CodeRabbit CLI available |
| `.coderabbit.yaml` in project root | CodeRabbit configured (CLI may still be missing) |

**Optional step signals:**

| Signal | Activates |
|--------|-----------|
| `docs/` directory exists in project root | Docs step |
| `CHANGELOG.md` exists | Version & Changelog step |
| Multiple `*.json` files contain a `"version"` field (monorepo / plugin marketplace) | Version & Changelog step with "release commit MUST be final" note |
| `/bump-version` skill available in installed plugins | Preferred invocation in release step |
| `/ak-meta:changelog` skill available | Fallback invocation in release step |

**CI as hints (lower priority):** see the CI section of the shared detection reference.

Produce a **tooling summary**: which build, test, lint, format, typecheck, and review commands are available, plus which optional steps apply.

### Step 4: Build the Workflow

Using the tooling summary, construct the workflow. Each step is included only if the project has matching tools.

**Base template (always included):**

```markdown
## Task completion workflow

After implementing changes:

1. **Validate** — {build_cmd} {typecheck_cmd} {test_cmd}
   {project_specific_validations}
2. **Tests** — Check whether new or updated tests are needed for the changes
   - Look at modified/added files and verify matching test files exist
   - If test gaps are found, write the missing tests before continuing
3. **Format** — {format_cmd}
4. **Simplify** — Simplify changed code for clarity and maintainability
   - Claude Code: invoke `/simplify` (preferred — Claude Code skill, install via plugin management if not available)
   - Fallback: invoke the `refactoring-expert` agent on modified files
5. **Review** — {review_step}
6. **Re-validate** — {build_cmd} {typecheck_cmd} {test_cmd}

Skip steps 4-5 for trivial changes (typo fixes, config updates, single-line changes).
```

**Optional step: Docs** — include between steps 5 and 6 (renumber Re-validate accordingly) when a `docs/` directory exists in the project root:

```
N. **Docs** — {docs_instructions}
```

Replace `{docs_instructions}` with a project-specific description of what to update (e.g., "If plugins, skills, agents, or hooks changed, update `docs/` (detail files and index READMEs) and the root `README.md` plugin table").

**Optional step: Version & Changelog** — include as the final step when a `CHANGELOG.md` exists and multiple files share a `version` field (monorepo / plugin marketplace pattern):

```
N. **Version & Changelog** — When changes warrant a release, bump version and update `CHANGELOG.md`. **The release commit MUST be the final commit of the release cycle** — if earlier finalize steps revealed additional fixes, commit those **first** and only then run the release step.
   - {release_invocation}
```

Replace `{release_invocation}` based on detected skills:

- `/bump-version` available → `Claude Code: invoke \`/bump-version\``
- `/ak-meta:changelog` available → `Claude Code: invoke \`/ak-meta:changelog\` directly (CHANGELOG only — version sync and tagging remain manual)`
- Neither → describe the manual steps found in contributing docs

Add a skip clause for this step: `Skip step N for docs-only or internal config changes that have no user-visible impact.`

**Adaptation rules:**

- Replace `{build_cmd}` with the actual build command (e.g., `pnpm build`, `cargo build`, `go build ./...`). Omit if no build step exists.
- Replace `{typecheck_cmd}` with the type-check command if detected (e.g., `pnpm typecheck`). Omit if no type checker is found.
- Replace `{test_cmd}` with the actual test command (e.g., `pnpm test`, `pytest`, `cargo test`). Omit if no tests exist.
- Replace `{project_specific_validations}` with file-type validations if the project has non-standard artifacts (e.g., JSON config files → `python3 -m json.tool {file} > /dev/null`, shell scripts → `shellcheck {file}`). Omit the sub-bullet block if no project-specific validations apply.
- Replace `{format_cmd}` with the detected formatter (e.g., `pnpm biome check --write`, `cargo fmt`, `ruff format .`). Omit Step 3 entirely if no formatter is detected. If linting is separate from formatting, combine (e.g., `pnpm lint --fix && pnpm format`).
- Omit Step 2 (Tests) for projects with no test infrastructure.
- Replace `{review_step}` based on CodeRabbit availability:
  - **CodeRabbit available**: Use the CodeRabbit variant:

    ```
    5. **Review** — Run code review on uncommitted changes, then fix reported issues
       - **Local review**: invoke `/ak-review:coderabbit` for immediate inline feedback (default)
       - **Delegated review** — Ask the user whether to also invoke `/ak-review:delegate` to generate a self-contained review prompt for external agents (Kimi, Codex, etc.) — useful for comprehensive cross-check or second opinions
       - **Other tools**: run `coderabbit review --prompt-only --type uncommitted`
       - **Critically evaluate review results** — not all suggestions are correct or relevant. Accept only changes that genuinely improve the code; dismiss false positives and overly pedantic findings.
    ```

  - **CodeRabbit not available**: Use the self-review variant:

    ```
    5. **Review** — Review uncommitted changes for bugs, security issues, and design problems
       - Run `git diff` and analyze each changed file for: logic errors, missed edge cases,
         security concerns, naming/readability issues, and consistency with project conventions
       - Ask the user whether to also invoke `/ak-review:delegate` for comprehensive cross-check with external agents
       - Fix any issues found before continuing
    ```

- For projects without build/test tooling (e.g., pure Markdown repos), reduce to the applicable steps only.
- After including optional steps, update the skip-clause step numbers to match the actual step positions in the generated workflow.

### Step 5: Present and Confirm

Show the generated workflow to the user. Explain which tools were detected and how each step maps to them.

Wait for the user to review and approve. If they request changes, adjust and present again.

### Step 6: Write to Project Instructions

The generated workflow is never inlined into the instruction file — it's always split into a lazy-loaded skill and a short pointer, so the full step list doesn't ride along on every prompt that includes AGENTS.md/CLAUDE.md.

After confirmation:

1. Write the full generated workflow to `.claude/skills/task-completion/SKILL.md`, creating the directory if needed, with the frontmatter and `# Task Completion Workflow` heading shown below — standalone SKILL.md bodies in this convention start with an H1, not the `##` heading Step 4 used for the inline case:

   ```markdown
   ---
   name: task-completion
   description: Task completion workflow for {project name} — {comma-separated step names}. Use after implementing changes and before committing.
   ---

   # Task Completion Workflow

   After implementing changes:

   1. **Validate** — ...
   ```

2. Read the chosen instruction file from Step 1.
3. Write a `## Task completion workflow` section containing a single pointer line, at the location the full block would otherwise have gone (typically after existing dev environment or code style sections, before commit guidelines if present):

   ```markdown
   ## Task completion workflow

   After implementing changes, follow the task-completion skill (`.claude/skills/task-completion/SKILL.md`): {arrow-separated step names, e.g. validate → simplify → review → docs → re-validate → version & changelog}.
   ```

4. If no instruction file exists, create `AGENTS.md` with a minimal structure containing the pointer section.
5. Show the user both files that were written.
6. **Optional**: if the project has the `skill-creator` skill installed (check the available-skills listing), offer to run it against the newly written `.claude/skills/task-completion/SKILL.md` as a quality pass on the skill's own structure and frontmatter — nice-to-have, not required. Skip silently if `skill-creator` isn't available; don't suggest installing it just for this.

## Mode: Audit (`--audit`)

### Step 1: Find Existing Workflow

Same detection as Generate Steps 1-2. If no workflow is found, inform the user and suggest running `/ak-review:workflow` (without `--audit`) to create one.

### Step 2: Detect Current Tooling

Same detection as Generate Step 3.

### Step 3: Compare Workflow Against Tooling

Run the comparison against the resolved step content (see Workflow Shapes). For each step, check:

| Check | Issue |
|-------|-------|
| Referenced command not found | Tool may have been removed or renamed |
| Referenced tool not in dependencies | Dependency might have been dropped |
| Available tool not mentioned | New tool added but workflow not updated |
| Generic placeholder remains | Command was never customized (e.g., still says "build and tests") |
| Script name changed | `package.json` script renamed but workflow still references old name |
| Review tool mismatch | Workflow references CodeRabbit but CLI not installed, or CodeRabbit is now available but workflow uses self-review |

Also verify structural completeness:

- Are the core steps present (validate, tests, format, simplify, review, re-validate)?
- Are optional steps present when they should be (docs/ dir → Docs step; CHANGELOG.md → Version & Changelog step)?
- Is the skip-clause present for trivial changes, with correct step numbers?
- Are tool invocation hints accurate (correct agent/skill names, e.g., `/simplify` not `code-simplifier:code-simplifier`)?
- Does the review step match what's actually available (CodeRabbit vs self-review)?
- Does the release step reference the correct skill (`/bump-version`, `/ak-meta:changelog`, or manual)?

In pointer form, also check for drift between the two files:

- Does the arrow-separated step-name list in the instruction file's pointer line match the actual step names in `.claude/skills/task-completion/SKILL.md`? Flag as **[Drift]** if a step was renamed, added, or removed in one file but not the other.

If the workflow is still in inline form, flag this as a **Conciseness** finding (see Workflow Shapes for why) and offer the migration in Step 5.

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

If issues were found, ask the user whether to apply the suggested corrections. On approval:

- **Content drift** (commands, tool references, missing/extra steps): update the resolved step content in place (see Workflow Shapes for where that lives).
- **Inline-form finding**: offer specifically to migrate — apply Generate Step 6 to write the corrected workflow into pointer form.
