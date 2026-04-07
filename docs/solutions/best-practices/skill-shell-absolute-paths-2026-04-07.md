---
title: Shell portability rules for skill bash commands
date: 2026-04-07
category: best-practices
module: skill-development
problem_type: best_practice
component: plugin
severity: high
applies_when:
  - Writing a skill that scans or operates on multiple directories
  - Writing a skill that walks monorepo workspace packages
  - Writing a skill that chains several bash commands across different paths
  - Writing a skill that uses glob patterns or brace expansion for file discovery
  - Writing a skill with conditional detection commands (test -f, grep -q, etc.)
tags:
  - skill-development
  - plugin-development
  - monorepo
  - bash
  - zsh
  - subshell
  - shell-portability
---

# Shell portability rules for skill bash commands

## Context

When a skill instruction contains multiple bash commands that operate on different
directories, the naive approach is to `cd` into each directory and run a command. This
works for a single scan, but **breaks on the second call**: the LLM executing the skill
has already mutated its shell state with the first `cd`, so the second `cd packages/web`
runs relative to the current (already-changed) working directory — producing a broken
path like `packages/web/packages/web`.

This was discovered during the first live run of `/ak-js:config-doctor` v1.13.0 on a real
pnpm monorepo. Phase 0 Step 3 scanned the root workspace successfully, then tried to scan
`packages/web` with a bare `cd packages/web && ls -1 ...`. The LLM, still at the root,
did the first `cd` successfully — but on a subsequent attempt, after intermediate tool
calls had not reset the cwd, the `cd packages/web` landed in `packages/web/packages/web`.
The skill reported `Searched for 2 patterns, listed 3 directories` from the wrong
directory and had to recover with `cd /abs/path && pwd && ls` to reorient.

Static subagent tracing (paper-test) did **not** catch this bug because Python-level
fixture simulation can't model bash state leakage across tool calls. Only live testing
surfaced it.

## Guidance

**Rule 1: Capture the project root once.** At the start of any skill that does
multi-directory work, capture `PROJECT_ROOT=$(pwd)` and refer to it explicitly for every
subsequent file lookup.

**Rule 2: Pass absolute paths to `ls`, `find`, `grep`, etc.** Don't rely on `cd` to set
context:

```bash
# ❌ WRONG — relies on mutable cwd
cd packages/web
ls -1 package.json tsconfig.json

# ✅ RIGHT — absolute paths, cwd-independent
PROJECT_ROOT=$(pwd)
ls -1 "$PROJECT_ROOT/packages/web/package.json" \
      "$PROJECT_ROOT/packages/web/tsconfig.json"
```

**Rule 3: Use subshells for multi-package iteration.** When a skill must scan many
directories in turn (e.g., monorepo workspace packages), run each scan inside a subshell
`( ... )` so `cd` state is scoped to that subshell and does not leak:

```bash
# ✅ RIGHT — subshell isolation
PROJECT_ROOT=$(pwd)
for PKG_PATH in "$PROJECT_ROOT"/packages/web "$PROJECT_ROOT"/packages/admin; do
  (
    cd "$PKG_PATH"
    ls -1 package.json tsconfig.json biome.json 2>/dev/null
  )
done
```

The subshell's `cd` affects only the inner shell; the outer `for` loop keeps its original
cwd between iterations.

**Rule 4: Never assume cwd between tool calls.** The LLM runtime between Bash-tool
invocations may or may not preserve working directory depending on the harness. Absolute
paths are the only reliable way to address files.

**Rule 5: Don't use shell globs or brace expansion for discovery — use `find`.** The
default shell on macOS is zsh, and zsh has the `nomatch` option enabled by default. If a
glob like `tsconfig.*.json` or a brace expansion like `next.config.{js,mjs,ts}` matches
no files, zsh aborts the command **before it runs**, with a `no matches found` error
that `2>/dev/null` cannot suppress because the error happens at shell-expansion time,
not at command-execution time. Use POSIX-portable `find` instead:

```bash
# ❌ WRONG — breaks on zsh when no tsconfig variants exist
ls -1 "$PROJECT_ROOT"/tsconfig.*.json 2>/dev/null

# ❌ WRONG — same problem with brace expansion
ls -1 "$PROJECT_ROOT"/next.config.{js,mjs,ts} 2>/dev/null

# ✅ RIGHT — find handles "no match" as an empty result
find "$PROJECT_ROOT" -maxdepth 1 -type f -name "tsconfig.*.json" 2>/dev/null

# ✅ RIGHT — find with -o chain replaces brace expansion
find "$PROJECT_ROOT" -maxdepth 1 -type f \
  \( -name "next.config.js" -o -name "next.config.mjs" -o -name "next.config.ts" \) \
  2>/dev/null
```

Explicit path lists (`ls -1 "$PROJECT_ROOT/package.json" "$PROJECT_ROOT/tsconfig.json"`)
remain safe because zsh only expands globs, not literal paths — but you must still end
the block with `true` (see Rule 6) because `ls` returns non-zero when any listed file
is missing.

**Rule 6: End any block with conditional detection in a `true` terminator.** Commands
like `test -f`, `grep -q`, and `ls` on missing files return non-zero exit codes by
design. If such a command is the last in a block, the whole block's exit code is
non-zero — and the Bash tool reports the step as failed even though the detection
itself worked correctly. Close every conditional-detection block with `true` (or wrap
each test in `{ test -f foo && echo hit; } || true`):

```bash
# ❌ WRONG — returns exit 1 when nx.json is absent, Bash tool reports FAILURE
test -f pnpm-workspace.yaml && echo "pnpm_workspace"
test -f lerna.json && echo "lerna"
test -f turbo.json && echo "turbo"
test -f nx.json && echo "nx"

# ✅ RIGHT — each test is isolated AND a final `true` guarantees exit 0
{ test -f pnpm-workspace.yaml && echo "pnpm_workspace"; } || true
{ test -f lerna.json && echo "lerna"; } || true
{ test -f turbo.json && echo "turbo"; } || true
{ test -f nx.json && echo "nx"; } || true
true
```

**Rule 7: Always run at least one zsh live test before the first release.** Static
subagent tracing (paper-tests that simulate phases against fixtures) catches logic bugs
but **cannot** catch shell-portability bugs — the LLM doing the trace has no shell,
just Python. A skill that passes static validation can still fail catastrophically on
the user's actual shell if you only tested it in your head.

The critical observation: **zsh is the default shell on macOS**, not bash. macOS users
— including most Claude Code users — run zsh. Any skill author who only mentally
imagines bash semantics will ship skills that crash on zsh due to `nomatch` (Rule 5)
and other zsh defaults that diverge from bash.

Mandatory pre-release validation steps:

1. **Static subagent trace** (paper-test) against 2-3 fixtures covering the main
   code paths. Catches logic bugs. Example: `config-doctor` static validation caught
   3 blocking logic bugs before v1.13.0 shipped.
2. **Live zsh run** against a real project, ideally a monorepo with edge cases.
   Catches shell-portability bugs that static tracing cannot see. Example:
   `config-doctor` needed 2 patch releases (1.13.1, 1.13.2) after the live zsh runs
   because each run surfaced bugs that static tracing missed — cd stacking, shell
   glob `nomatch`, brace-expansion rejection, exit-code propagation.
3. **Re-run after each fix.** Don't assume the first fix is complete; the second and
   third runs in the `config-doctor` series each found new bugs. Rule of thumb: keep
   live-testing until you get a clean run with **zero Bash-tool error markers** and
   **consistent high-severity findings across two consecutive runs**.

Neither step alone is sufficient; both are cheap compared to a patch-release cycle.

## Why This Matters

Skills are executed by an LLM interpreting bash instructions. Unlike a real shell script
that runs top-to-bottom in one process, skill steps are separate tool calls with
potentially different shell contexts. Any bug that relies on persistent cwd state is a
latent failure waiting for the first real-world monorepo.

The cost of this bug in practice:

- On the first live run of `config-doctor` on `todoist-tools`, the skill had to do
  **four corrective tool calls** (`pwd`, absolute `ls`, re-navigating) to recover from
  the broken cwd before it could proceed. A skill that should "just work" instead looked
  unreliable.
- A user unfamiliar with the plugin would not understand why the tool is listing
  `packages/web/packages/web` and would likely abandon the skill or report it broken.
- The fix required a point-release (1.13.0 → 1.13.1) less than an hour after 1.13.0
  shipped.

Following the absolute-path pattern from day 1 is dramatically cheaper than shipping and
patching.

## When to Apply

- Any skill that reads or writes files in more than one directory
- Any skill that walks workspace globs (`packages/*`, `apps/*`, `libs/*`)
- Any skill that combines `cd`, `ls`, `find`, `grep`, and/or `python3` across multiple
  tool calls
- Any skill with a "monorepo-aware" claim in its description

**Not strictly required** for:

- Single-directory skills that operate only in `$(pwd)` without ever descending
- Skills that use `Glob` or `Grep` tool wrappers (which accept path arguments directly
  and don't rely on shell state)

## Examples

### Negative example — the original `config-doctor` Phase 0 Step 3 (v1.13.0)

```bash
ls -1 package.json tsconfig.json biome.json ... 2>/dev/null

# Later, for monorepo:
cd packages/web
ls -1 package.json tsconfig.json ... 2>/dev/null
# Next iteration compounds the path: packages/web/packages/web
```

Result: skill crashed with wrong path, had to recover manually with `cd /abs/path`.

### Positive example — the `config-doctor` Phase 0 Step 3 after 1.13.1

```bash
PROJECT_ROOT=$(pwd)

# Root scan uses absolute paths
ls -1 "$PROJECT_ROOT"/package.json \
      "$PROJECT_ROOT"/tsconfig.json \
      "$PROJECT_ROOT"/biome.json \
      "$PROJECT_ROOT"/biome.jsonc \
      2>/dev/null

# Monorepo iteration uses subshells
for PKG_PATH in "$PROJECT_ROOT"/packages/web "$PROJECT_ROOT"/packages/admin; do
  (
    cd "$PKG_PATH"
    ls -1 package.json tsconfig.json biome.json 2>/dev/null
  )
done
```

Result: works on arbitrary nesting depth, safe against cwd drift, testable on any
monorepo.

### The git commits that introduced the fixes

- `v1.13.1` (2026-04-07): `fix(ak-js): use absolute paths and support JSONC in
  config-doctor` — introduced Rules 1-4 (absolute paths, `PROJECT_ROOT`, subshells,
  cwd discipline) in `plugins/ak-js/skills/config-doctor/SKILL.md`.
- `v1.13.2` (2026-04-07): `fix(ak-js): use find instead of shell globs and fix
  exit-code propagation` — added Rules 5-6 (no shell globs/brace expansion, `true`
  terminators for conditional detection blocks) after the second live test on zsh
  surfaced two more bugs the first fix didn't anticipate.
- Rule 7 was added after the third consecutive live-test run of v1.13.2 came back
  clean (0 Bash-tool errors, consistent high-severity findings) — formalizing the
  "static trace + mandatory zsh live test + re-run until clean" pre-release gate
  that the v1.13.x patch series itself demonstrated was necessary.

## Related

- `plugins/ak-js/skills/config-doctor/SKILL.md` — the skill where this pattern was
  codified after the live-test discovery
- [CHANGELOG.md v1.13.1](../../../CHANGELOG.md) — the release notes describing the fix
- Meta-lesson worth capturing separately: **"Skill validation requires both static
  subagent tracing AND live testing"** — the static trace caught 3 Phase-0/Phase-1c bugs
  before release, but the `cd`-stacking bug only surfaced in the live monorepo run. Each
  layer catches a different class of problem; neither is sufficient alone.
