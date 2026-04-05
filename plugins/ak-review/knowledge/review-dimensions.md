# Structured Review Dimensions

Five review dimensions with concrete checklists for systematic, multi-angle code review.
Each dimension focuses on a distinct quality aspect. Use these to complement automated
tools like CodeRabbit with targeted human or agent review.

## Dimension Overview

| Dimension | Focus | Include When |
|---|---|---|
| **Security** | Vulnerabilities, auth, input validation | Code handles user input, auth, or sensitive data |
| **Performance** | Query efficiency, memory, caching | Changes touch data access paths or hot code paths |
| **Architecture** | SOLID, coupling, module boundaries | Structural changes, new modules, API changes |
| **Testing** | Coverage, isolation, edge cases | New functionality or changed behavior |
| **Accessibility** | WCAG, ARIA, keyboard navigation | UI or frontend changes |

## Recommended Combinations

| Change Type | Dimensions to Review |
|---|---|
| API endpoint changes | Security, Performance, Architecture |
| Frontend component | Architecture, Testing, Accessibility |
| Database migration | Performance, Architecture |
| Authentication changes | Security, Testing |
| Full feature review | Security, Performance, Architecture, Testing |

## Finding Severity Scale

| Severity | Impact | Likelihood | Examples |
|---|---|---|---|
| **Critical** | Data loss, security breach, total failure | Certain or very likely | SQL injection, auth bypass, data corruption |
| **High** | Significant functionality impact | Likely | Memory leak, missing validation, broken flow |
| **Medium** | Partial impact, workaround exists | Possible | N+1 query, missing edge case, unclear errors |
| **Low** | Minimal impact, cosmetic | Unlikely | Style issue, minor optimization opportunity |

### Severity Calibration Rules

- Security vulnerabilities exploitable by external users: always Critical or High
- Performance issues in frequently-executed code paths: at least Medium
- Missing tests for critical business logic: at least Medium
- Accessibility violations for core user-facing functionality: at least Medium
- Code style issues with no functional impact: Low

## Deduplication Rules

When multiple review angles flag the same location:

1. **Same file:line, same issue** — Merge into one finding, note all dimensions that flagged it
2. **Same file:line, different issues** — Keep as separate findings
3. **Same issue, different locations** — Keep separate but cross-reference
4. **Conflicting severity** — Use the higher rating
5. **Conflicting recommendations** — Include both with attribution

---

## Security Checklist

### Input Handling

- [ ] All user inputs validated and sanitized
- [ ] SQL queries use parameterized statements, no string concatenation
- [ ] HTML output properly escaped to prevent XSS
- [ ] File paths validated to prevent path traversal
- [ ] Request size limits enforced

### Authentication and Authorization

- [ ] Authentication required for all protected endpoints
- [ ] Authorization checks verify the user has permission for the specific action
- [ ] JWT tokens validated — signature, expiry, issuer
- [ ] Password hashing uses bcrypt or argon2, not MD5/SHA
- [ ] Session management follows current best practices

### Secrets and Configuration

- [ ] No hardcoded secrets, API keys, or passwords in source
- [ ] Secrets loaded from environment variables or a secret manager
- [ ] .gitignore includes sensitive file patterns
- [ ] Debug and development endpoints disabled in production

### Dependencies

- [ ] No known CVEs in direct dependencies
- [ ] Dependencies pinned to specific versions
- [ ] No unnecessary dependencies expanding the attack surface

---

## Performance Checklist

### Database

- [ ] No N+1 query patterns
- [ ] Queries use appropriate indexes
- [ ] No unbounded SELECT * on large tables
- [ ] Pagination implemented for list endpoints
- [ ] Connection pooling configured

### Memory and Resources

- [ ] No memory leaks — event listeners cleaned up, streams closed
- [ ] Large data sets streamed, not loaded entirely into memory
- [ ] File handles and connections properly closed
- [ ] Caching used for expensive or repeated operations

### Computation

- [ ] No unnecessary re-computation or redundant operations
- [ ] Algorithm complexity appropriate for expected data sizes
- [ ] Async operations used where I/O bound
- [ ] No blocking operations on the main thread or event loop

---

## Architecture Checklist

### Design Principles

- [ ] Single Responsibility — each module/class has one reason to change
- [ ] Open/Closed — extensible without modification of existing code
- [ ] Dependency Inversion — depends on abstractions, not concretions
- [ ] No circular dependencies between modules

### Structure

- [ ] Clear separation of concerns — UI, business logic, data access
- [ ] Consistent error handling strategy across the codebase
- [ ] Configuration externalized, not hardcoded
- [ ] API contracts well-defined and versioned where applicable

### Patterns

- [ ] Consistent patterns used throughout, no unnecessary pattern mixing
- [ ] Abstractions at the right level — not over-engineered, not under-engineered
- [ ] Module boundaries align with domain boundaries
- [ ] Shared utilities are actually shared, not duplicated

---

## Testing Checklist

### Coverage

- [ ] Critical business logic paths have test coverage
- [ ] Edge cases tested — empty input, null values, boundary values
- [ ] Error paths tested — what happens when things fail
- [ ] Integration points have integration tests

### Quality

- [ ] Tests are deterministic, no flaky tests
- [ ] Tests are isolated, no shared mutable state between test cases
- [ ] Assertions are specific, not just "no error thrown"
- [ ] Test names clearly describe what is being verified

### Maintainability

- [ ] Tests don't duplicate implementation logic
- [ ] Mocks and stubs are minimal and accurate
- [ ] Test data is clear and relevant to the scenario
- [ ] Tests are understandable without reading the implementation

---

## Accessibility Checklist

### Structure

- [ ] Semantic HTML elements used — nav, main, article, section, button
- [ ] Heading hierarchy is logical — h1, h2, h3 without skipping levels
- [ ] ARIA roles and properties used correctly where native semantics are insufficient
- [ ] Landmarks identify major page regions

### Interaction

- [ ] All functionality accessible via keyboard alone
- [ ] Focus order is logical and visible
- [ ] No keyboard traps — user can always navigate away
- [ ] Touch targets at least 44x44px on mobile

### Content

- [ ] Images have meaningful alt text (decorative images use empty alt)
- [ ] Color is not the sole means of conveying information
- [ ] Text meets minimum contrast ratios — 4.5:1 normal text, 3:1 large text
- [ ] Content remains readable and functional at 200% zoom

---

## Report Template

```markdown
## Code Review Report

**Target:** {files, PR, or directory reviewed}
**Dimensions:** {which dimensions were applied}
**Date:** {date}
**Files Reviewed:** {count}

### Critical Findings ({count})

#### [CR-001] {Title}
**Location:** `{file}:{line}`
**Dimension:** {Security | Performance | Architecture | Testing | Accessibility}
**Description:** {what was found}
**Impact:** {what could happen if not addressed}
**Recommendation:** {specific fix}

### High Findings ({count})
...

### Medium Findings ({count})
...

### Low Findings ({count})
...

### Summary

| Dimension | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| Security | | | | | |
| Performance | | | | | |
| Architecture | | | | | |
| Testing | | | | | |
| Accessibility | | | | | |
| **Total** | | | | | |

### Prioritized Actions
{Ordered list of recommended fixes, highest severity first}
```
