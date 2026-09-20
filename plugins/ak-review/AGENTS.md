# AGENTS.md — ak-review

> `CLAUDE.md` in this directory is a symlink pointing here.

Plugin-specific context for the review tooling. The root `AGENTS.md` still applies; this file adds
what only holds inside `plugins/ak-review/`.

It is placed here rather than in `.coderabbit.yaml` on purpose: CodeRabbit's knowledge base
discovers `**/AGENTS.md` by default, so a file here reaches the hosted reviewer without
configuration — and reaches a CLI review, and any other coding agent working in this directory, by
the same text. One source, every surface.

## The adapter contract is a contract

`skills/execute/scripts/` holds one adapter per external tool. Its rules are written down in the
execute skill's **Adapter Reference**, and three of them are easy to break without noticing:

**Three reserved exit codes, and they carry opposite advice.** `124` — ran, then hung; a partial
stream exists and is worth salvaging. `125` — produced nothing and never started; nothing to
recover, usually transient. `126` — the tool itself refused; retrying now hits the same wall. A new
failure path has to pick the code whose advice matches what a caller should do, not the one that
describes what went wrong internally. Getting this backwards has cost a day here: a quota refusal
reported as `125` told the caller to come back soon, against a wall that stood for hours.

**A figure nobody measured is `null`, never `0`.** Cost and token extractors report `null` for
anything the stream did not carry. A zero claims a run was free, or consumed nothing, when the truth
is that nobody counted — and a partial sum presented as a total is worse still. Watch for `// 0` in
`jq` filters, which reintroduces exactly that: it silently turns an absent field into a measurement.

**Scripts here must stay shellcheck-clean and run under both bash and zsh.** The test suite in
`skills/execute/scripts/tests/` is the gate; every adapter behaviour that was ever wrong has a test
pinning it, and those tests exist because the behaviour was wrong once.

## A review that found nothing is not the same as a clean run

This is the defect class this plugin keeps closing, in its own code and in the tools it drives. An
empty result has many causes that have nothing to do with the code: a run that failed, one that was
interrupted and reported as partial, one whose scope excluded what mattered, an extractor that
parsed nothing, a review that never started. Before anything here reports "no issues found", it
rules those out and names the one that applied.

Treat the same suspicion as a review criterion for changes in this directory: a new code path that
can end quietly needs to say which quiet ending it was.
