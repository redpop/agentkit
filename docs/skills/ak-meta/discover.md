# discover

| Field | Value |
|-------|-------|
| Plugin | ak-meta |
| Invoke | `/ak-meta:discover [focus]` |

## Purpose

Generate and critically evaluate improvement ideas for any project through divergent thinking and adversarial filtering. Works for code, content, product, or any creative direction.

## Workflow

1. **Resume check** — Look for recent ideation docs in `docs/ideation/`
2. **Project context scan** — Parallel sub-agents gather project shape, patterns, pain points
3. **Divergent ideation** — 4-6 parallel sub-agents with different frames (Pain, Unmet Needs, Inversion, Assumption-Breaking, Leverage, Edge Cases)
4. **Adversarial filtering** — Skeptical sub-agents attack candidates; orchestrator scores survivors
5. **Present survivors** — Ranked ideas with description, rationale, downsides, confidence, complexity
6. **Write artifact** — Durable ideation doc in `docs/ideation/YYYY-MM-DD-<topic>-ideation.md`
7. **Next steps** — Brainstorm a selected idea, refine, or end session

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
