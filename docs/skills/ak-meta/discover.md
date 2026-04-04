# discover

| Field | Value |
|-------|-------|
| Plugin | ak-meta |
| Invoke | `/ak-meta:discover [focus]` |

## Purpose

Surface and stress-test improvement opportunities across any project. Applies to code, content, product, or strategy — uncovers blind spots and produces a prioritized set of ideas before brainstorming.

## Workflow

1. **Check for prior work** — Look for recent discovery docs in `docs/discover/`
2. **Gather project context** — Parallel sub-agents survey project shape, conventions, friction points
3. **Wide-angle exploration** — 4-6 parallel sub-agents with different lenses (Friction, Missing Capabilities, Simplification, Challenged Assumptions, Multiplier Effects, Demanding Users)
4. **Critical evaluation** — Challenger sub-agents stress-test candidates; orchestrator scores and ranks finalists
5. **Present finalists** — Ranked opportunities with description, rationale, trade-offs, confidence, effort
6. **Persist artifact** — Discovery document in `docs/discover/YYYY-MM-DD-<topic>-discover.md`
7. **Next steps** — Brainstorm a finalist, iterate on the discovery, or wrap up

## Examples

```bash
/ak-meta:discover                        # Open-ended discovery
/ak-meta:discover blog content Q3        # Content ideas for blog
/ak-meta:discover DX improvements        # Developer experience focus
/ak-meta:discover top 3 quick wins       # Volume + constraint hint
```

## Related

- Brainstorming workflow (superpowers) — Takes a selected idea and defines it precisely
- `/ak-meta:handoff` — Hand off context to another AI session
