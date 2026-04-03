---
name: document
description: >
  Document a recently solved problem to build searchable team knowledge. Use when a fix is verified,
  after debugging sessions, or when trigger phrases like "it's fixed" or "working now" appear.
---

# Document Solution

Capture a verified solution as a structured Markdown file in `docs/solutions/`, with YAML
frontmatter that enables fast searching and filtering. Every documented fix becomes a reusable
asset — the next time a similar problem surfaces, the answer is already written and discoverable.
Over time, these documents compound into a knowledge base that accelerates every debugging session.

## Usage

```text
/ak-knowledge:document
/ak-knowledge:document [context hint]
```

When called without arguments, the skill examines the current conversation to identify the solved
problem. An optional context hint narrows the focus — for example,
`/ak-knowledge:document the CORS header fix` tells the skill which resolution to capture when a
session covered multiple topics.

## Arguments

Parse arguments: `$ARGUMENTS`

Extract flags:

- `--compact`: Run in compact-safe mode (single-pass, no subagents)
- Remaining text after flags is the context hint

## Support Files

Three reference files define the schema and structure. Read them on-demand as each phase needs
them — do not bulk-load all files at the start of execution.

| File | Purpose | Path |
|------|---------|------|
| **Schema** | Canonical frontmatter contract with track definitions and enum values | `${CLAUDE_PLUGIN_ROOT}/skills/document/references/schema.yaml` |
| **Schema Guide** | Category-to-directory mapping and quick validation reference | `${CLAUDE_PLUGIN_ROOT}/skills/document/references/schema-guide.md` |
| **Template** | Section structure for bug-track and knowledge-track documents | `${CLAUDE_PLUGIN_ROOT}/skills/document/assets/template.md` |

When spawning subagents, pass the relevant file contents directly into the task prompt rather than
instructing agents to read files themselves. This avoids redundant file reads and ensures each agent
operates on the same version of the schema.

## Execution Strategy

By default, the skill runs in **full mode** — a multi-phase pipeline that uses parallel subagents
for thorough research before assembling the document. For lightweight documentation of
straightforward fixes, pass `--compact` to run in compact-safe mode (described below).

---

## Full Mode

### Critical Requirement: Single File Output

The primary deliverable is **one Markdown file** written to
`docs/solutions/[category]/[filename].md`. Phase 1 subagents exist purely to gather and analyze
information — they return text data only and must **never** use Write or Edit tools. Only the
orchestrator (this skill) writes files. This constraint prevents race conditions, conflicting
writes, and partial documents.

### Phase 0.5: Memory Scan

Before launching research, check for relevant context in the user's auto memory.

1. Read `MEMORY.md` from the Claude auto memory directory (typically `~/.claude/` or the
   project-specific memory path)
2. Scan entries for keywords related to the solved problem — error messages, component names,
   recurring patterns
3. If relevant entries exist, prepare a labeled excerpt to pass into Phase 1 task prompts
4. Tag any content sourced from memory with `(auto memory)` so the final document distinguishes
   recalled context from conversation-derived facts

If no relevant memory entries are found, proceed to Phase 1 without a memory excerpt.

### Phase 1: Parallel Research

Launch three subagents **in parallel** using the Task tool. Each receives the conversation history,
any memory excerpt from Phase 0.5, and the context hint (if provided). Each agent returns structured
text — never files.

#### 1. Context Analyzer

**Goal**: Classify the problem and determine where the document belongs.

Task prompt must include the full contents of `references/schema.yaml` and
`references/schema-guide.md`.

Responsibilities:

- Identify whether this is a **bug track** or **knowledge track** problem by matching the situation
  against track definitions in the schema
- Select the appropriate `problem_type` enum value — must be an exact match from the schema, never
  an invented value
- Determine `component`, `severity`, and `module` fields
- Map `problem_type` to the correct `docs/solutions/` subdirectory using the category mapping table in the schema guide
- Propose a filename following the pattern `[descriptive-slug]-[YYYY-MM-DD].md`
- Construct a YAML frontmatter skeleton with all required fields for the identified track

Returns: YAML frontmatter skeleton, category directory path, proposed filename, identified track (bug or knowledge).

#### 2. Solution Extractor

**Goal**: Pull the essential narrative from the conversation.

Task prompt must include the full contents of `references/schema.yaml` so the agent can determine
which track governs the section structure.

The output structure depends on the track:

**Bug track sections:**

- **Problem** — What went wrong, stated concisely
- **Symptoms** — Observable indicators (error messages, broken behavior, failed tests)
- **What Didn't Work** — Approaches that were tried and discarded, with brief reasons
- **Solution** — The fix that resolved the issue, with code snippets where they add clarity
- **Why This Works** — Root cause explanation and why the solution addresses it
- **Prevention** — Concrete practices, tests, or guardrails to stop recurrence

**Knowledge track sections:**

- **Context** — The situation, gap, or friction that prompted this guidance
- **Guidance** — The practice, pattern, or recommendation
- **Why This Matters** — Rationale and consequences of ignoring it
- **When to Apply** — Conditions and situations where this applies
- **Examples** — Concrete before/after demonstrations or usage illustrations

Returns: Section content as structured text, organized by heading.

#### 3. Related Docs Finder

**Goal**: Discover existing documentation that overlaps with, or is affected by, this solution.

Responsibilities:

- Extract 3-5 keywords from the problem and solution (component names, error messages, affected
  modules)
- Search `docs/solutions/` using a grep-first approach:
  1. Run Grep with extracted keywords to find candidate files
  2. Read frontmatter of matched files to check `problem_type`, `component`, `module`, and `tags`
  3. Score each candidate on five overlap dimensions: problem statement, root cause, solution
     approach, referenced files, prevention strategy
- Classify overlap level:
  - **High** (4-5 dimensions match) — likely a duplicate or superseding document
  - **Moderate** (2-3 dimensions match) — related but distinct; worth cross-linking
  - **Low** (0-1 dimensions match) — no meaningful connection
- Search GitHub issues via the `gh` CLI for related reports:
  `gh issue list --search "[keywords]" --limit 5`
- Identify any existing docs that may need refreshing based on this new solution (e.g., an older
  doc that describes a workaround now replaced by a proper fix)

Returns: List of related document links, refresh candidates, overlap assessment per candidate,
relevant GitHub issue links.

### Phase 2: Assembly and Write

Wait for all three Phase 1 subagents to complete, then assemble the document.

#### Step 1: Evaluate Overlap

Review the Related Docs Finder results:

- **High overlap** — Instead of creating a new file, update the existing document with the new
  information. Preserve the original document's filename and location. Note the update in the
  document body.
- **Moderate overlap** — Create a new document but add cross-references in the Related section.
  Flag the overlap to the user in the output summary.
- **Low overlap or no related docs** — Create a new document without special handling.

#### Step 2: Build the Document

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/document/assets/template.md` to get the section structure for
   the identified track
2. Merge the Context Analyzer's frontmatter skeleton with the Solution Extractor's narrative content
3. Populate the Related section with links from the Related Docs Finder
4. Include any GitHub issue links discovered during search

#### Step 3: Validate YAML Frontmatter

Before writing, verify the assembled frontmatter against the schema:

- All shared required fields are present (`module`, `date`, `problem_type`, `component`, `severity`)
- Bug-track documents include `symptoms`, `root_cause`, and `resolution_type`
- All enum values match the allowed values exactly — no invented or approximate values
- `date` follows `YYYY-MM-DD` format
- `tags` are lowercase and hyphen-separated
- Array fields respect `min_items` and `max_items` constraints

#### Step 4: Write the File

Create the directory if needed, then write the document:

```bash
mkdir -p docs/solutions/[category]
```

Write to `docs/solutions/[category]/[filename].md`.

### Phase 2.5: Selective Refresh Recommendation

After writing, evaluate whether existing documents need updating based on the Related Docs Finder
results.

**Recommend** running `/ak-knowledge:refresh` when:

- The new fix contradicts guidance in an older document
- This solution supersedes a previously documented workaround
- A refactor has invalidated file paths or code references in related docs
- The Related Docs Finder flagged specific refresh candidates

**Do not recommend** when:

- No related documents were found
- Related documents are still consistent with the new solution
- The overlap is purely topical without any conflicting content

When recommending, include a narrow scope hint so the refresh targets only the affected documents —
for example: "Consider running
`/ak-knowledge:refresh docs/solutions/build-errors/webpack-config-2024-11-15.md` to update the
superseded workaround."

### Phase 3: Documentation Review

Invoke the `solution-reviewer` agent using the Task tool with `subagent_type="solution-reviewer"`:

"Review the solution document at `docs/solutions/[category]/[filename].md`.

Evaluate:

1. **Completeness** — Are all required sections present and substantive?
2. **Schema conformance** — Does the YAML frontmatter satisfy all validation rules?
3. **Clarity** — Can a developer unfamiliar with this codebase understand the problem and apply the
   fix?
4. **Code quality** — Are code snippets syntactically correct and appropriately scoped?
5. **Actionable prevention** — Does the Prevention section (bug track) or When to Apply section
   (knowledge track) give concrete, implementable guidance?

Return a list of findings with severity (error, warning, suggestion) and specific fix instructions."

Apply any error-level findings automatically. Present warnings and suggestions to the user.

### Discoverability Check

After the document is written, verify that the project's instruction files surface the
`docs/solutions/` directory so future AI sessions can find it.

1. Read `AGENTS.md` and/or `CLAUDE.md` in the project root
2. Assess whether the content semantically references `docs/solutions/` as a knowledge source —
   look for mentions of the directory, solution documentation, or knowledge base lookup instructions
3. If the directory is not referenced:
   - Identify a suitable insertion point (typically near project structure or knowledge sections)
   - Draft a minimal addition, such as:
     `Check docs/solutions/ for previously documented fixes before debugging from scratch.`
   - Present the proposed addition to the user via AskUserQuestion and apply it only with approval

---

## Compact-Safe Mode

Activated with the `--compact` flag. Designed for quick capture of straightforward solutions where
full parallel research would be disproportionate to the complexity of the fix.

### Behavior

Single-pass execution with no subagents:

1. **Extract** — Read the conversation to identify the problem, solution, and relevant context
2. **Classify** — Read `references/schema.yaml` and `references/schema-guide.md` to determine
   track, `problem_type`, and category directory
3. **Build** — Read `assets/template.md` and construct a minimal document with frontmatter and core
   sections. Bug track: Problem, Solution, Prevention. Knowledge track: Context, Guidance, When to
   Apply. Optional sections (What Didn't Work, Examples, etc.) are omitted unless the conversation
   provides clear material for them.
4. **Validate** — Check frontmatter against schema rules
5. **Write** — Save to `docs/solutions/[category]/[filename].md`

### Limitations

- No related-docs search, so duplicates or overlaps may go undetected
- No memory scan, so previously noted patterns are not incorporated
- No documentation review phase
- Sections may be thinner due to single-pass extraction

### Output Note

Include this notice in the output summary:

```text
This document was created in compact-safe mode with abbreviated research.
For thorough coverage, re-run: /ak-knowledge:document [context]
```

---

## Common Mistakes

| Mistake | Why It Matters | Correct Approach |
|---------|---------------|-----------------|
| Subagent writes a file | Creates race conditions and partial documents | Subagents return text only; orchestrator writes |
| Assembling before all subagents finish | Missing data leads to incomplete documents | Wait for all Phase 1 results before Phase 2 |
| Creating a second file for the same problem | Fragments the knowledge base | Check overlap assessment first; update existing doc when overlap is high |
| Inventing enum values | Breaks search and filtering | Read schema.yaml and use exact enum values only |
| Skipping frontmatter validation | Invalid YAML causes downstream tool failures | Always validate before writing |
| Bulk-loading all reference files at start | Wastes context on files not needed yet | Read files on-demand as each phase requires them |

---

## Success Output

After all phases complete, present a structured summary:

```markdown
## Solution Documented

**Subagent Results:**
- Context Analyzer: [track] track, [problem_type], category: [directory]
- Solution Extractor: [N] sections extracted
- Related Docs Finder: [N] related docs ([overlap level] overlap), [N] GitHub issues

**File Created:** `docs/solutions/[category]/[filename].md`
**Track:** [Bug | Knowledge]
**Review:** [N] errors fixed, [N] warnings, [N] suggestions

---

**What's next?**
```

Then present options to the user via AskUserQuestion:

1. Continue working on the current task
2. Link related documentation together
3. Update AGENTS.md or CLAUDE.md references
4. View the created document
5. Something else

---

## Auto-Invoke

This skill may be triggered automatically when the conversation contains phrases indicating a
problem has been resolved. Watch for:

- "that worked"
- "it's fixed"
- "working now"
- "problem solved"
- "that did the trick"
- "all green"

When detected, confirm with the user before proceeding: "It sounds like that resolved the issue.
Would you like to document this solution for future reference?"

---

## Preconditions

These are advisory, not enforced — the skill will still run if conditions are not perfectly met,
but the output quality depends on them:

- **Problem is solved** — The fix should be identified and applied. Documenting an unsolved problem
  produces speculative content.
- **Solution is verified** — The fix has been tested or confirmed working. Unverified solutions
  risk documenting incorrect approaches.
- **Non-trivial resolution** — Trivial fixes (typos, missing semicolons) generally do not warrant
  full documentation. Use `--compact` for borderline cases, or skip documentation entirely for
  one-character fixes.
