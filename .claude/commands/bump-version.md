# Bump Version

Synchronize version numbers across all AgentKit files.

## Arguments

Parse `$ARGUMENTS` for an optional bump type:

- If `$ARGUMENTS` is `patch`, `minor`, or `major` — use that as the bump type
- If `$ARGUMENTS` is empty — auto-detect from commits (see Step 2)
- Any other value — report an error and stop

## Execution

### Step 1: Read current version

Read `.claude-plugin/marketplace.json` and extract the current version from the first plugin entry's `"version"` field.

### Step 2: Determine bump type

If no explicit bump type was given via arguments, analyze the commits since the last release.

**The boundary is the last release commit, not the last tag.** Every release this repo makes
ends in a `chore: release vX.Y.Z` commit, and Step 8 tags it — but a tag can be missing while
the release itself happened, and then "since the last tag" spans several releases and counts
their commits again. Measured: four releases once went out untagged, after which the last tag
was three versions behind and a `feat:` already shipped two versions earlier would have forced
another minor. The release commit is the marker that always exists.

```bash
git log --format='%H %s' --grep='^chore: release v' -1
```

Take the commits after it:

```bash
git log <that hash>..HEAD --oneline
```

If no release commit exists at all, fall back to the last tag, and if there is none either,
use the full history.

Determine bump type from those commit messages:

- If any commit contains `BREAKING CHANGE` in the body/footer or uses `!:` (e.g., `feat!:`) → **major**
- If any commit starts with `feat:` or `feat(` → **minor**
- Otherwise (`fix:`, `docs:`, `refactor:`, `chore:`, etc.) → **patch**

**If that range is empty, there is nothing to release.** Say so and stop — do not bump.
An empty range means the working tree has been committed and the version already reflects it;
bumping anyway produces a version whose changelog entry has nothing to describe. Check whether
Step 8 is what is actually missing: `git tag --sort=-v:refname | head -1` against the current
version tells you whether the last release was ever tagged, and `git status -sb` whether it was
pushed. Offer to do that instead.

### Step 3: Calculate new version

Apply the semver increment to the current version:

- `patch`: 1.1.2 → 1.1.3
- `minor`: 1.1.2 → 1.2.0
- `major`: 1.1.2 → 2.0.0

### Step 4: Update every version-carrying file

**Never work from a hardcoded plugin list — discover the files first.** A hardcoded list
silently skips plugins added since the list was written, leaving them stranded on the old
version.

```bash
ls -1 plugins/*/.claude-plugin/plugin.json
```

Update ALL of these — do not skip any:

1. **`.claude-plugin/marketplace.json`** — update the `"version"` of **every** entry in the
   `plugins` array (one per plugin, must match the discovered count)
2. **Every `plugins/*/.claude-plugin/plugin.json`** found above — update the `"version"` field
3. **`AGENTS.md`** — update the version reference `(currently X.Y.Z)` in the
   "Commit and PR guidelines" section

### Step 4a: Verify no file was missed

Before continuing, confirm every version is identical and no plugin was left behind:

```bash
grep -ho '"version"[[:space:]]*:[[:space:]]*"[^"]*"' \
  .claude-plugin/marketplace.json plugins/*/.claude-plugin/plugin.json \
  | grep -o '[^"]*"$' | sort -u
```

This must print exactly **one** distinct version — the new one. More than one means a file was
missed; fix it before proceeding. Match only the value, not the whole line: `marketplace.json`
nests its entries deeper than `plugin.json`, so comparing raw lines reports a false mismatch on
indentation alone. Also verify that the number of `marketplace.json`
entries equals the number of `plugin.json` files.

### Step 5: Output summary

Display a summary in this format:

```
Version bump: X.Y.Z → A.B.C (bump-type)
Reason: <why this bump type was chosen>

Updated files:
  - .claude-plugin/marketplace.json (<N> entries)
  - <one line per discovered plugins/*/.claude-plugin/plugin.json>
  - AGENTS.md
```

List the plugin.json files that were actually updated, not a remembered set.

### Step 6: Run changelog

After the summary, invoke the `/ak-meta:changelog` skill to update the CHANGELOG.

### Step 7: Run git operations

After the changelog is updated, invoke the `/ak-git:operations` skill to create a smart commit.

### Step 8: Create git tags

After the commit is created, tag HEAD (the release commit) with an **annotated** tag:

```bash
git tag -a v<new-version> -m "Release v<new-version>"
```

For example: `git tag -a v1.1.3 -m "Release v1.1.3"`

Use annotated tags (`-a -m`), not lightweight tags — they carry tagger, date, and message metadata, which GitLab/GitHub release UIs and `git show <tag>` rely on.

**Then tag any earlier release that was never tagged.** This step is skipped whenever a release
is made outside this command, and the gap does not heal on its own: every version has a
changelog entry, so one without a tag is a release nobody can check out. List the release
commits and tag each one that has no tag yet:

```bash
git log --format='%H %s' --grep='^chore: release v' | while read -r hash subject; do
  v="${subject##* }"
  git rev-parse -q --verify "refs/tags/$v" > /dev/null || echo "untagged: $v $hash"
done
```

Tag each one on **its own** release commit, never on HEAD — a tag on the wrong commit is worse
than a missing one, because it looks correct:

```bash
git tag -a <version> -m "Release <version>" <that version's hash>
```

Confirm with `git tag --sort=-v:refname | head -5`, and check the tags are annotated
(`git for-each-ref refs/tags/<v> --format='%(objecttype)'` prints `tag`, not `commit`).

Finally, push the commit and tags together:

```bash
git push --follow-tags
```

`--follow-tags` pushes annotated tags reachable from what is being pushed, which covers the
backfilled ones as well.
