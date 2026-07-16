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

If no explicit bump type was given via arguments, analyze commits since the last git tag:

Run `git tag --sort=-v:refname` to find the latest tag, then `git log <tag>..HEAD --oneline` to get commits since that tag.

Determine bump type from commit messages:

- If any commit contains `BREAKING CHANGE` in the body/footer or uses `!:` (e.g., `feat!:`) → **major**
- If any commit starts with `feat:` or `feat(` → **minor**
- Otherwise (`fix:`, `docs:`, `refactor:`, `chore:`, etc.) → **patch**
- If no tags exist at all → **patch** (fallback)

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
grep -h '"version"' .claude-plugin/marketplace.json plugins/*/.claude-plugin/plugin.json \
  | sort -u
```

This must print exactly **one** distinct version line — the new one. More than one line means
a file was missed; fix it before proceeding. Also verify that the number of `marketplace.json`
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

### Step 8: Create git tag

After the commit is created, tag HEAD (the release commit) with an **annotated** tag:

```bash
git tag -a v<new-version> -m "Release v<new-version>"
```

For example: `git tag -a v1.1.3 -m "Release v1.1.3"`

Use annotated tags (`-a -m`), not lightweight tags — they carry tagger, date, and message metadata, which GitLab/GitHub release UIs and `git show <tag>` rely on.

Confirm the tag was created by showing the output of `git tag --sort=-v:refname | head -3`.

Finally, push the commit and tag together:

```bash
git push --follow-tags
```
