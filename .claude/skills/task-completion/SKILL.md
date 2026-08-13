---
name: task-completion
description: Task completion workflow for the AgentKit plugin marketplace — validate, simplify, review, docs, re-validate, version & changelog. Use after implementing changes and before committing.
---

# Task Completion Workflow

After implementing changes:

1. **Validate** — Verify modified files are well-formed
   - JSON files: `python3 -m json.tool {file} > /dev/null`
   - Shell scripts: `shellcheck {file}`
   - Markdown: handled automatically by the `markdown-format` hook
2. **Simplify** — Simplify changed code for clarity and maintainability
   - Claude Code: invoke `/simplify` (preferred — Claude Code skill, install via plugin management if not available)
   - Fallback: invoke the `refactoring-expert` agent on modified files
3. **Review** — Run code review on uncommitted changes, then fix reported issues
   - **Local review**: invoke `/ak-review:coderabbit` for immediate inline feedback (default)
   - **Delegated review** — Ask the user whether to also invoke `/ak-review:delegate` to generate a self-contained review prompt for external agents (Kimi, Codex, etc.) — useful for comprehensive cross-check or second opinions
   - **Other tools**: run `coderabbit review --uncommitted` (CLI ≥ 0.7 dropped
     `--prompt-only`/`--type`/`--plain`; plain text is the default output now)
   - **Critically evaluate review results** — not all suggestions are correct or relevant. Accept only changes that genuinely improve the code; dismiss false positives and overly pedantic findings.
4. **Docs** — If plugins, skills, agents, or hooks changed, update `docs/` (detail files and index READMEs) and the root `README.md` plugin table
5. **Re-validate** — Re-run JSON/shellcheck validation if those files were modified during steps 2-4
6. **Version & Changelog** — When changes warrant a release, bump version and update `CHANGELOG.md`. **The release commit MUST be the final commit of the release cycle** — if earlier finalize steps (simplify, review, docs, re-validate) revealed additional fixes, commit those **first** and only then run the release step. This guarantees `git checkout v<version>` matches the exact state you released and keeps changelog diffs (`git log vA..vB`) accurate.
   - Claude Code: invoke `/bump-version` (preferred — fully automated end-to-end: auto-detects bump type from commits, updates all 11 files, runs `/ak-meta:changelog`, runs `/ak-git:operations`, and creates an annotated git tag via `git tag -a v<version> -m "Release v<version>"`)
   - Manual fallback: invoke `/ak-meta:changelog` directly (handles CHANGELOG only — version sync across the 11 files and tagging remain manual; see "Commit and PR guidelines" in AGENTS.md). Always create annotated tags (`git tag -a v<version> -m "Release v<version>"`), never lightweight tags.

Skip steps 2-3 for trivial changes (typo fixes, config updates, single-line changes).
Skip step 6 for docs-only or internal config changes that have no user-visible plugin impact.
