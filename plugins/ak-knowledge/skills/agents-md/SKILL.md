---
name: agents-md
description: Convert CLAUDE.md files to AGENTS.md with symlinks. Use when the user asks to "convert claude.md", "create agents.md symlinks", "rename claude.md to agents.md", or wants CLAUDE.md files replaced by AGENTS.md with backward-compatible symlinks.
---

# agents-md

Rename all `CLAUDE.md` files to `AGENTS.md` and create `CLAUDE.md` symlinks pointing to them.

## Current State

- Working directory: !`pwd`

## Execution Workflow

### 1. Find CLAUDE.md Files

```bash
find . -name "CLAUDE.md" -not -path "*/node_modules/*" -not -path "*/.git/*" | sort
```

### 2. Process Each File

For each found `CLAUDE.md`, apply the following decision logic:

| CLAUDE.md state | AGENTS.md exists? | Action |
|---|---|---|
| Already a symlink → AGENTS.md | — | Skip |
| Regular file | No | Rename → AGENTS.md, create symlink |
| Regular file | Yes, regular file | **Consolidate**: merge unique content from CLAUDE.md into AGENTS.md, then replace CLAUDE.md with symlink |

### 3. Consolidation (when both files are regular files)

When both CLAUDE.md and AGENTS.md exist as regular files:

1. Read both files and compare their content
2. Identify the more comprehensive file (larger, more sections)
3. Check for unique content in the smaller file that is missing from the larger one
4. If the larger file already covers everything: keep it as AGENTS.md
5. If the smaller file has unique sections: append them to AGENTS.md under a clear heading
6. Replace CLAUDE.md with a symlink to AGENTS.md
7. Report what was consolidated

### 4. Simple Cases (no consolidation needed)

```bash
FOUND=0
CONVERTED=0
SKIPPED=0
CONSOLIDATED=0

while IFS= read -r file; do
  [ -z "$file" ] && continue
  FOUND=$((FOUND + 1))
  dir=$(dirname "$file")

  if [ -L "$file" ]; then
    echo "[skipped] $file — already a symlink"
    SKIPPED=$((SKIPPED + 1))
  elif [ -f "$dir/AGENTS.md" ]; then
    echo "[consolidate] $file — both files exist, needs consolidation"
    CONSOLIDATED=$((CONSOLIDATED + 1))
  else
    mv "$file" "$dir/AGENTS.md" && ln -s AGENTS.md "$file"
    echo "[converted] $file → AGENTS.md + symlink"
    CONVERTED=$((CONVERTED + 1))
  fi
done < <(find . -name "CLAUDE.md" -not -path "*/node_modules/*" -not -path "*/.git/*" | sort)

echo ""
echo "Summary: $CONVERTED converted, $CONSOLIDATED to consolidate, $SKIPPED skipped (of $FOUND found)"
```

### 5. Consolidation Execution

For each `[consolidate]` result:

1. Read both files with the Read tool
2. Compare content — identify the more comprehensive file as the base
3. Check for unique sections/information in the other file
4. If unique content exists, merge it into AGENTS.md
5. Remove CLAUDE.md and create symlink: `rm CLAUDE.md && ln -s AGENTS.md CLAUDE.md`
6. Report: `[consolidated] path — merged N unique sections into AGENTS.md + symlink`

### 6. Add Symlink Notice

After creating any symlink (converted or consolidated), insert the following notice into `AGENTS.md` directly after the `# AGENTS.md` heading (or as the first line if no heading is present):

```markdown
> `CLAUDE.md` is a symlink pointing to this file.
```

Only add the notice if it is not already present.

## Output Format

```markdown
## agents-md Results

- [converted]    /path/to/CLAUDE.md → AGENTS.md + symlink
- [consolidated] /path/to/CLAUDE.md — merged into AGENTS.md + symlink
- [skipped]      /sub/CLAUDE.md — already a symlink

**Summary**: X converted, Y consolidated, Z skipped
```

If no `CLAUDE.md` files are found, report: "No CLAUDE.md files found in the project."
