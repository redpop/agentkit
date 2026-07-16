---
name: react-best-practices
description: >
  React and Next.js performance optimization guidelines from Vercel Engineering. Use when writing,
  reviewing, or refactoring React/Next.js code to ensure optimal performance patterns.
---

# React Best Practices

Comprehensive performance optimization guide for React and Next.js applications, based on Vercel Engineering guidelines. Contains 66 rules across 8 categories, prioritized by impact.

See `${CLAUDE_PLUGIN_ROOT}/knowledge/full-guide.md` for all rules with detailed code examples.

## Rule Categories by Priority

| Priority | Category | Impact |
|----------|----------|--------|
| 1 | Eliminating Waterfalls | CRITICAL |
| 2 | Bundle Size Optimization | CRITICAL |
| 3 | Server-Side Performance | HIGH |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH |
| 5 | Re-render Optimization | MEDIUM |
| 6 | Rendering Performance | MEDIUM |
| 7 | JavaScript Performance | LOW-MEDIUM |
| 8 | Advanced Patterns | LOW |

## Quick Reference

**Critical — Eliminating Waterfalls:**
`async-defer-await`, `async-parallel`, `async-dependencies`, `async-api-routes`, `async-suspense-boundaries`

**Critical — Bundle Size:**
`bundle-barrel-imports`, `bundle-dynamic-imports`, `bundle-defer-third-party`, `bundle-conditional`, `bundle-preload`

**High — Server-Side:**
`server-cache-react`, `server-cache-lru`, `server-dedup-props`, `server-parallel-fetching`, `server-after-nonblocking`

**Medium — Re-renders:**
`rerender-defer-reads`, `rerender-memo`, `rerender-derived-state`, `rerender-functional-setstate`, `rerender-no-inline-components`
