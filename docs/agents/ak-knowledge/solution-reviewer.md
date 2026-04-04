# Solution Reviewer

> Reviews solution documentation for completeness, schema conformance, and clarity.

## Overview

Validates solution docs written to `docs/solutions/` against the project's schema and quality
standards. Determines the track (bug vs knowledge), checks all required fields and sections,
and assesses content quality. Applies fixes directly for unambiguous errors and warnings.

## Usage

```
Agent tool with subagent_type="solution-reviewer"
```

Part of the **ak-knowledge** plugin. Uses Read, Grep, and Glob tools.

## When to Use

- After `/ak-knowledge:log` writes a solution doc
- Validating frontmatter fields against the solution schema
- Checking that all required sections are present for a given track
- Ensuring code examples are properly formatted and solutions are self-contained

## Methodology

1. **Schema Validation** -- Check required fields, enum values, date format (YYYY-MM-DD), tags (lowercase, hyphenated)
2. **Section Completeness** -- Bug track: Problem, Symptoms, Solution, Prevention; Knowledge track: Context, Guidance, Examples
3. **Content Quality** -- Code blocks with language tags, clarity without original context, concrete prevention strategies
4. **Issue Classification** -- Error (must fix), Warning (should fix), Info (optional style suggestions)

## Output

Produces a review with schema/section pass/fail status, error and warning lists with fix
instructions, and a final verdict (PASS or NEEDS FIXES).

## Related

- [ak-knowledge:log skill](../../../plugins/ak-knowledge/skills/log/SKILL.md) -- Solution documentation skill
