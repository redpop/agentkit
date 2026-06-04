---
name: delegate
description: This skill should be used when the user asks to "delegate a code review", "generate a review prompt for another agent", "create a code review prompt", "hand off review to Kimi/Codex", or wants a self-contained, project-specific review prompt for a foreign coding agent.
---

# Delegate Code Review

Generate a self-contained, project-specific code-review prompt for a foreign coding agent (Kimi, Codex, etc.). **Output only — this skill never modifies code** (except writing the prompt file when `--out` is given).

## Arguments

Parse `$ARGUMENTS`:

| Flag | Effect |
|------|--------|
| `--type all\|committed\|uncommitted` | Git-diff scope (CodeRabbit semantics). Default `all` |
| `--base <ref>` | Base ref for diffs (auto-detected if omitted) |
| `--path <glob/dir/file …>` | Review specific paths instead of a git diff |
| `--all` | Review the entire project |
| `--fix` | Generated prompt instructs the agent to FIX findings (default: report only) |
| `--out <path>` | Also write the prompt to a file (default: terminal only) |

**Scope precedence:** `--path` / `--all` override `--type`. If nothing is given, use `--type all`.

## Workflow

### Phase 1: Resolve Scope

Use `PROJECT_ROOT=$(pwd)` and absolute paths in subshells.

- `--all`: instruct the reviewer to review the whole tree (note large-repo caveat).
- `--path`: list the concrete files via `git ls-files` filtered to the given paths.
- Git-diff modes: detect base branch — current branch upstream
  (`git rev-parse --abbrev-ref @{u}`), else `main`/`master`. Override with
  `--base`. Produce the exact commands the reviewer must run:
  - `uncommitted`: `git diff` + `git diff --cached`
  - `committed`: `git diff <base>...HEAD`
  - `all`: both committed-vs-base and uncommitted

### Phase 2: Capture Project Context

Read (if present): `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `README.md`.
Detect: primary languages/frameworks, test command, lint command, build
command, key documentation paths, project-specific conventions and quirks.
Collect concrete file paths the reviewer should read first.

### Phase 3: Assemble the Prompt

Combine three parts into the template below:

1. **Generic review dimensions** — draw from
   `${CLAUDE_PLUGIN_ROOT}/knowledge/review-dimensions.md` (Security, Performance,
   Architecture, Testing, Accessibility; severity scale; dedup rules).
2. **Project-specific** — the files/conventions/commands found in Phase 2.
3. **Task** — the resolved scope (Phase 1), the mode (report-only unless `--fix`), and the required output format.

### Phase 4: Emit

Print the assembled prompt as ONE fenced code block for easy copy-paste. If
`--out <path>` was given, also write it there (absolute path) and confirm the
location.

## Generated Prompt Template

The emitted prompt MUST be self-contained (the foreign agent has no access to this session). Fill the bracketed parts:

```text
# Code Review Task

You are an expert code reviewer working in the repository "[REPO_NAME]".
You do not have prior context — gather everything you need from the repo itself.

## 1. Read first
[List of concrete files: AGENTS.md / CLAUDE.md / README / key docs]

## 2. Project context
- Languages/frameworks: [...]
- Run tests with: [command]
- Run linter with: [command]
- Conventions & quirks: [...]

## 3. Scope — review exactly this
[Concrete file list OR exact git commands to run, e.g. `git diff origin/main...HEAD`]

## 4. What to check
Review across these dimensions (skip those that do not apply):
- Correctness & logic errors
- Security (input validation, auth, injection, secrets)
- Error handling & edge cases
- Performance (hot paths, N+1, memory)
- Tests (coverage of changed behavior, edge cases)
- Maintainability & adherence to the project conventions above

Severity scale: Critical / High / Medium / Low. Separate true risks from
nitpicks (cosmetic items with no functional impact).

## 5. [MODE]
[If report-only:] Do NOT modify any code. Produce only the report below.
[If --fix:] First produce the report below, then fix the Confirmed High/Critical
findings, then list what you changed.

## 6. Required output format
Produce a Markdown report grouped by priority, then a machine-readable JSON block.

### Markdown
Group findings under: 🔴 High · 🟡 Medium · 🟢 Low · then a "Nitpicks" section.
Each finding: `**F-NNN** — <title>` / `file:line` / severity / category /
rationale / suggested fix.

### JSON (append verbatim at the end, fenced as ```json)
{
  "task": "code_review_findings",
  "repo": "[REPO_NAME]",
  "base_ref": "[BASE_OR_NULL]",
  "head_ref": "HEAD",
  "findings": [
    {
      "id": "F-001",
      "title": "...",
      "severity": "high|medium|low|nitpick",
      "category": "...",
      "file": "path/to/file.ext",
      "start_line": 42,
      "end_line": 42,
      "claim": "...",
      "evidence": "...",
      "suggested_fix": "..."
    }
  ]
}

Use stable, unique IDs (F-001, F-002, …). Do not invent issues you cannot
point to in the code.
```

## Notes

- Keep the prompt agent-agnostic — no Claude-specific or session-specific references.
- If the scope is empty (no diff), say so and stop instead of emitting an empty prompt.
