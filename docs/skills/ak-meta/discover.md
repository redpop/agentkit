# discover

| Field | Value |
|-------|-------|
| Plugin | ak-meta |
| Invoke | `/ak-meta:discover [scope]` |

## Purpose

Surface and stress-test improvement opportunities across any project. Applies to code, content, product, or strategy — uncovers blind spots and produces a prioritized set of ideas before brainstorming.

## Usage

```text
/ak-meta:discover [scope]
```

The single optional `$ARGUMENTS` value narrows the exploration. It accepts any of:

- A **topic** — `DX improvements`, `blog content for Q3`
- A **file path** — `plugins/ak-security/`
- A **constraint** — `low-complexity quick wins`
- A **quantity hint** — `top 3`, `100 ideas`, `raise the bar`
- **Empty** — unconstrained exploration across the whole project

## Workflow

1. **Check for prior work** — Look for recent discovery docs in `docs/discover/`
2. **Gather project context** — Parallel sub-agents survey project shape, conventions, friction points
3. **Wide-angle exploration** — 4-6 parallel sub-agents with different lenses (Friction, Missing Capabilities, Simplification, Challenged Assumptions, Multiplier Effects, Demanding Users)
4. **Critical evaluation** — Challenger sub-agents stress-test candidates; orchestrator scores and ranks finalists
5. **Present finalists** — Ranked opportunities with description, rationale, trade-offs, confidence, effort
6. **Persist artifact** — Discovery document in `docs/discover/YYYY-MM-DD-<topic>-discover.md`
7. **Next steps** — Brainstorm a finalist, iterate on the discovery, or wrap up

## Examples

```text
/ak-meta:discover
```

Runs an unconstrained, project-wide exploration — no scope argument means every lens is fair game.

```text
/ak-meta:discover DX improvements
```

Focuses the lenses on developer-experience opportunities — the topic argument steers the candidate generation.

```text
/ak-meta:discover plugins/ak-security/
```

Scopes discovery to a specific directory — the file-path argument keeps findings grounded in that part of the
codebase.

```text
/ak-meta:discover top 3 low-complexity quick wins
```

Combines a quantity hint with a constraint — narrows the shortlist to the three easiest high-value wins.

## Related

- Brainstorming workflow (superpowers) — Takes a selected idea and defines it precisely
- `/ak-meta:handoff` — Capture session state for the next AI session
