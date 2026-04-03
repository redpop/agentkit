# React Best Practices

> React and Next.js performance optimization guidelines from Vercel Engineering.

## Overview

Provides 65 performance rules across 8 categories, prioritized by impact from critical (eliminating waterfalls, bundle size) through high (server-side performance) to medium/low (re-renders, JavaScript performance). References a comprehensive knowledge base with detailed code examples for each rule.

## Usage

```text
/ak-react:react-best-practices
```

No arguments required. The skill loads the full guide from the plugin's knowledge base and applies rules contextually during code writing or review.

## When to Use

- Writing new React or Next.js components
- Reviewing existing React code for performance issues
- Refactoring to eliminate waterfalls or reduce bundle size
- Optimizing server-side rendering and data fetching patterns

## Best Practices

- Address critical-priority rules first: waterfalls and bundle size have the highest impact
- Avoid barrel imports (`index.ts` re-exports) -- they pull in entire modules
- Use dynamic imports (`next/dynamic`) for components not needed on initial load
- Prefer server-side caching (`React.cache`, LRU) over client-side fetching where possible
- Avoid inline component definitions inside render -- they cause unnecessary re-mounts

## Related

- [react-doctor](./react-doctor.md) -- automated scanning for React issues
- Knowledge base: `plugins/ak-react/knowledge/full-guide.md`
