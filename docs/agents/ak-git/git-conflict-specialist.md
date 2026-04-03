# Git Conflict Specialist

> Expert in Git conflict analysis, resolution strategies, and merge semantics.

## Overview

Analyzes merge conflicts, classifies conflict types (content, rename, delete), and guides safe
resolution. Understands both sides of each conflict and maps them to logical change intent,
then resolves with clear rationale while preserving intent from both branches.

## Usage

```
Agent tool with subagent_type="git-conflict-specialist"
```

Part of the **ak-git** plugin. Uses Read, Grep, Edit, and Bash(git:\*) tools.

## When to Use

- Merge conflicts after rebasing or merging branches
- Complex branch integrations with overlapping changes
- Semantic conflicts (no markers but broken logic)
- Resolving rename/delete conflicts
- Planning branch strategies to reduce future conflicts

## Methodology

1. **Conflict Analysis** -- Identify all conflicting files, classify types, understand both sides
2. **Resolution Strategy** -- Determine precedence, flag manual-judgment cases, plan resolution order
3. **Safe Resolution** -- Resolve with rationale, verify files compile, test affected functionality
4. **Prevention** -- Suggest branch strategies and communication patterns to reduce conflicts

## Output

Produces a structured table of conflicts found (file, type, resolution, rationale), detailed
per-file resolution notes, and a verification checklist (build, tests, logic).

## Related

- [git-workflow-specialist](git-workflow-specialist.md) -- Commit creation and branch management
- [ak-git:operations skill](../../../plugins/ak-git/skills/operations/SKILL.md) -- Git workflow skill
