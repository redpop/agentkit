# ak-knowledge

Solution documentation and knowledge maintenance for AgentKit.

## Skills

### /ak-knowledge:document

Captures verified solutions in `docs/solutions/` with structured YAML frontmatter. Uses parallel
subagents for research and assembly, with a compact-safe single-pass alternative.

**Usage:**

```bash
/ak-knowledge:document                  # Document the most recent fix
/ak-knowledge:document [context hint]   # Provide additional context
/ak-knowledge:document --compact        # Lightweight single-pass mode
```

### /ak-knowledge:refresh

Maintains `docs/solutions/` quality over time. Reviews existing docs against the current codebase
with five maintenance actions: Keep, Update, Consolidate, Replace, Delete.

**Usage:**

```bash
/ak-knowledge:refresh                          # Interactive review
/ak-knowledge:refresh [scope hint]             # Narrow to specific area
/ak-knowledge:refresh mode:autofix             # Automated maintenance
/ak-knowledge:refresh mode:autofix [scope]     # Automated + scoped
```

### /ak-knowledge:agents-md

Converts `CLAUDE.md` files to `AGENTS.md` with backward-compatible
symlinks. Handles rename, consolidation (when both files exist), and
skip (already converted).

**Usage:**

```bash
/ak-knowledge:agents-md
```

## Agents

- **solution-reviewer** — Validates generated documentation for schema conformance, section completeness, and content quality.

## How It Works

Each documented solution compounds your team's knowledge:

1. Solve a problem — research and debugging time
2. Run `/ak-knowledge:document` — structured doc in `docs/solutions/`
3. Next occurrence — quick lookup instead of re-research
4. Run `/ak-knowledge:refresh` periodically — keep docs accurate as code evolves

## Output Structure

```text
docs/solutions/
├── build-errors/
├── test-failures/
├── runtime-errors/
├── performance-issues/
├── database-issues/
├── security-issues/
├── ui-bugs/
├── integration-issues/
├── logic-errors/
├── developer-experience/
├── workflow-issues/
├── best-practices/
└── documentation-gaps/
```

Each file has YAML frontmatter with `module`, `problem_type`, `component`, `severity`, `tags` and
more — enabling structured search across solutions.
