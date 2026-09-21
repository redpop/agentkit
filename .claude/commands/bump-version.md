# Bump Version

Cut an AgentKit release.

This is `/ak-git:operations --release` with this repository's own specifics filled in. The procedure
itself — boundary detection, bump type, changelog, the single release commit, annotated tags,
backfilling untagged releases, push — lives in that skill and is deliberately not repeated here: two
copies of a release procedure drift, and this repository ships the skill to others.

## Arguments

`$ARGUMENTS` may be `patch`, `minor` or `major`; empty means auto-detect; anything else is an error.
Pass it through unchanged.

## Execution

Invoke `/ak-git:operations --release $ARGUMENTS` and supply the two things that are specific to this
repository.

### The files that carry the version

Discover them, never work from a remembered list — a hardcoded list strands plugins added after it
was written:

```bash
ls -1 plugins/*/.claude-plugin/plugin.json
```

1. `.claude-plugin/marketplace.json` — the `"version"` of **every** entry in the `plugins` array; its
   entry count must equal the number of globbed `plugin.json` files
2. every `plugins/*/.claude-plugin/plugin.json` found above
3. `AGENTS.md` — the `(currently X.Y.Z)` reference in "Commit and PR guidelines"

### The release-commit pattern

`^chore: release v`. Every release here ends in such a commit, and that commit — not the last tag —
is the boundary the operation measures the release range from.
