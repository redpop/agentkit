---
name: refresh
description: Review and maintain solution docs in docs/solutions/ by updating, consolidating, replacing, or deleting stale entries against the current codebase. Use after refactors, migrations, dependency upgrades, or when a learning feels outdated.
---

# Refresh Solution Docs

Keep `docs/solutions/` trustworthy. This skill reviews existing solution documents against the current state of the codebase and applies targeted maintenance actions: keep what is still accurate, update what has drifted cosmetically, consolidate overlapping entries, replace guidance that has become misleading, and delete documents whose domain no longer exists. Pattern docs that synthesize multiple learnings are refreshed second, because their validity depends on the learnings beneath them.

## Usage

```text
/ak-knowledge:refresh
/ak-knowledge:refresh [scope hint]
/ak-knowledge:refresh mode:autofix
/ak-knowledge:refresh mode:autofix [scope hint]
```

Without arguments, the skill targets every document under `docs/solutions/`. A scope hint narrows the working set -- for example, `/ak-knowledge:refresh build-errors` limits review to that subdirectory, and `/ak-knowledge:refresh webpack` matches documents by frontmatter, filename, or content.

## Arguments

Parse arguments: `$ARGUMENTS`

Extract flags:

- `mode:autofix` -- run without user interaction (see Autofix Mode below)
- Everything remaining after flag extraction is treated as the scope hint

## Support Files

Three reference files define the schema and document structure. They live in the sibling `document` skill directory. Read them on-demand when a phase requires them -- do not load all three at the start.

| File | Purpose | Path |
|------|---------|------|
| **Schema** | Canonical frontmatter contract with track definitions and enum values | `${CLAUDE_PLUGIN_ROOT}/skills/document/references/schema.yaml` |
| **Schema Guide** | Category-to-directory mapping and quick validation reference | `${CLAUDE_PLUGIN_ROOT}/skills/document/references/schema-guide.md` |
| **Template** | Section structure for bug-track and knowledge-track documents | `${CLAUDE_PLUGIN_ROOT}/skills/document/assets/template.md` |

When spawning subagents that need schema context, pass the relevant file contents into the task prompt directly. This prevents redundant reads and guarantees every agent works from the same version.

---

## Mode Detection

The skill operates in one of two modes:

**Interactive** (default) -- presents recommendations and asks the user to confirm ambiguous decisions before making changes.

**Autofix** -- activated by `mode:autofix` in the arguments. Runs fully autonomously, applies all safe actions without prompting, and marks uncertain cases as stale rather than guessing.

---

## Autofix Mode Rules

When operating in autofix mode, follow these constraints strictly:

1. **No questions.** Never invoke AskUserQuestion. Every decision is made by the skill.
2. **Process everything in scope.** Do not skip documents because they seem fine at a glance -- run the full investigation pipeline.
3. **Apply safe actions directly.** Keep, Update, and Delete actions with clear evidence can be executed without confirmation.
4. **Mark the uncertain as stale.** When evidence is ambiguous -- a file path changed but you cannot determine whether the solution still applies -- add stale metadata to the document's frontmatter instead of guessing:

   ```yaml
   status: stale
   stale_reason: "Brief explanation of what could not be verified"
   stale_date: YYYY-MM-DD
   ```

5. **Do not consolidate or replace without strong evidence.** These are higher-risk actions. In autofix mode, if consolidation or replacement seems warranted but the evidence is not overwhelming, mark the documents as stale and note the recommendation in the report.
6. **Always produce a report.** The output must include two sections:
   - **Applied** -- actions that were executed during this run
   - **Recommended** -- actions that require human judgment, listed with rationale

---

## Interaction Principles (Interactive Mode Only)

When operating in interactive mode, follow these guidelines for user communication:

- **One question at a time.** Present a single decision via AskUserQuestion, wait for the response, then proceed.
- **Multiple choice preferred.** Offer concrete options rather than open-ended questions. The user should be able to pick from a short list, not compose an answer.
- **Lead with your recommendation.** State what you would do and why before presenting alternatives. The user can accept or override.
- **Evidence before questions.** Never ask the user for a decision before you have investigated the document and gathered concrete findings. The question should present those findings, not ask the user to do the research.
- **Minimize total questions.** If the evidence clearly supports an action, execute it. Only ask when the outcome genuinely depends on user judgment -- for example, when two valid consolidation targets exist and either could be canonical.

---

## Refresh Order

Process documents in this sequence:

1. **Learning documents first** -- these are the individual solution docs (bug fixes, best practices, workflow improvements) that live in the category subdirectories of `docs/solutions/`.
2. **Pattern documents second** -- these are derived syntheses that live under `docs/solutions/patterns/` and aggregate guidance from multiple learnings.

This order matters. Learnings are the primary evidence base. If a learning is stale or deleted, the pattern that references it may appear better-supported than it actually is. By resolving learnings first, you ensure that pattern evaluation operates on an accurate foundation.

---

## Maintenance Model

Every document under review receives exactly one outcome:

| Outcome | When to Apply | File Impact |
|---------|---------------|-------------|
| **Keep** | The document is still accurate -- code references check out, the solution remains valid, no meaningful drift detected | No file edit. Report it as reviewed. |
| **Update** | References have drifted but the core solution is still correct -- file paths moved, class names changed, API endpoints shifted, but the underlying approach is the same | Edit the document in place. Touch only what has actually changed. |
| **Consolidate** | Two or more documents cover substantially the same problem and solution, creating redundancy that increases maintenance cost and retrieval confusion | Merge unique content into a single canonical document. Delete the subsumed documents. Update any cross-references. |
| **Replace** | The documented guidance is now misleading -- the codebase has moved to a different approach, and you can verify the successor solution | Write a new document via a replacement subagent. Delete the old document. |
| **Delete** | The code that the document describes is gone, and the problem domain itself no longer exists in the project | Remove the file. Git history preserves the content if it is ever needed again. |

---

## Core Rules

These ten rules govern every decision throughout the refresh process.

1. **Evidence informs judgment.** Drift signals are inputs to analysis, not a mechanical scorecard. Three drifted file paths might mean a simple Update if paths merely relocated, or a full Replace if the migration changed the architecture. Weigh what each signal means in context.
2. **Prefer no-write Keep.** If a document is still accurate, leave it alone. Do not edit just to add a "last reviewed" timestamp or adjust formatting.
3. **Match docs to reality.** When code and document disagree, the code wins. Update the document to reflect current behavior. Never treat a stale doc as a spec the code should conform to.
4. **Be decisive, minimize questions.** When evidence clearly points to an action, take it. Reserve user questions for genuinely ambiguous situations where reasonable people would disagree.
5. **Avoid low-value churn.** Do not fix typos, reformat prose, or polish wording during a refresh. The goal is technical accuracy, not editorial perfection.
6. **Update only for meaningful drift.** An Update is warranted when concrete references have changed: file paths, module names, code snippets, dependency versions, API signatures. It is not warranted because a paragraph could be worded better.
7. **Replace only with real evidence.** You must have verified at least one of: the codebase contradicts the documented solution, a successor approach is confirmed in code, or a documented workaround was resolved by a proper fix. If you cannot verify, mark stale and recommend `/ak-knowledge:document` on next encounter.
8. **Delete when code AND domain are gone.** Both conditions must hold. A deleted React Native doc is appropriate after migrating to Flutter. A deleted database indexing doc is not appropriate just because one index was removed.
9. **Evaluate the document set, not just individual docs.** Two individually accurate documents describing the same solution from slightly different angles create retrieval confusion and drift risk. Catch redundancy, spot contradictions, identify the canonical document.
10. **Delete, don't archive.** Do not move files to an archive folder or add a deprecated prefix. Git history is the archive. Every file in `docs/solutions/` should be trustworthy and actionable today.

---

## Scope Selection

### Discovering Candidates

Find all Markdown files under `docs/solutions/`, excluding `README.md` files:

1. Use Glob with `docs/solutions/**/*.md`
2. Filter out any file named `README.md`
3. This produces the full candidate list

### Narrowing by Scope Hint

If `$ARGUMENTS` includes a scope hint (text remaining after flag extraction), attempt to match in this priority order, using the first strategy that produces results:

1. **Directory match** -- hint corresponds to a subdirectory name under `docs/solutions/`
2. **Frontmatter match** -- hint found in `module`, `component`, `problem_type`, or `tags` fields
3. **Filename match** -- hint appears as a substring in a candidate filename
4. **Content search** -- Grep finds the hint text within document bodies

If none produce matches, report that no documents matched and list available subdirectories.

---

## Phase 0: Assess and Route

Before diving into investigation, get a sense of the workload and choose the lightest process that fits.

### Step 1: Discover

Run scope selection (above) to produce the candidate list. Count the results.

### Step 2: Estimate Scope

Classify the workload into one of three tiers:

| Tier | Candidate Count | Approach |
|------|----------------|----------|
| **Focused** | 1-2 documents | Investigate each document directly in the main thread. No triage needed. |
| **Batch** | 3-8 documents | Investigate all candidates, then present grouped recommendations before executing. |
| **Broad** | 9+ documents | Triage before investigating. Build an inventory, cluster by likely impact, spot-check a few for drift, and recommend a starting area to the user. |

### Step 3: Route

- **Focused**: proceed directly to Phase 1.
- **Batch**: proceed to Phase 1, plan to present a consolidated recommendation table after investigation.
- **Broad**: triage first -- read all frontmatter to build an inventory table, cluster by module or domain, spot-check 2-3 documents from the largest cluster for drift. In interactive mode, present the inventory and recommend a starting cluster. In autofix mode, process all clusters sequentially, largest first.

---

## Phase 1: Investigate Learnings

For each learning document in scope, perform a thorough cross-reference against the current codebase. The goal is to determine whether the document still accurately reflects reality.

### Investigation Procedure

For each document:

1. **Read the full document** -- frontmatter and body. Note the problem_type, module, component, and any specific file paths, class names, or code snippets referenced.

2. **Cross-reference against the codebase across six dimensions:**

   **a. References** -- Do the file paths, class names, and module references in the document still exist? Use Glob and Grep to verify. A renamed file is drift; a deleted file is a stronger signal.

   **b. Recommended solution** -- Does the solution described in the document still match what the code actually does? Read the relevant source files. If the document says "add the `--legacy-peer-deps` flag" but the project now uses a different package manager, the solution has drifted.

   **c. Code examples** -- If the document includes code snippets, do they still reflect the current implementation? Check for changes in function signatures, method names, import paths, or configuration keys.

   **d. Related docs** -- Are documents listed in the Related section still present? Do they still cover what the cross-reference claims? A broken link to a deleted doc is a minor issue; a link to a doc that now contradicts this one is a significant finding.

   **e. Auto memory** -- Check the user's auto memory for notes in the same domain. If relevant entries exist, tag them with `(auto memory)` in your analysis. Memory entries can provide context about recent changes that the document has not yet absorbed.

   **f. Overlap** -- Are other documents in scope covering the same problem? Note potential consolidation candidates. Two docs about the same webpack configuration issue authored three months apart are a strong signal.

### Drift Classification

After investigating, classify any drift you found:

- **Update territory** -- the drift is cosmetic. Paths moved, names changed, an API version bumped, but the fundamental solution remains sound. The document needs targeted edits, not a rewrite.

- **Replace territory** -- the drift is substantive. The solution approach has changed, the recommended practice is no longer valid, or the fix described has been superseded by a different implementation. The document needs to be retired and a successor written.

**Boundary test**: if you would need to rewrite the Solution section (bug track) or Guidance section (knowledge track) to make the document accurate, that is Replace territory, not Update territory.

### Judgment Guidelines

- **Contradiction is the strongest Replace signal.** When the document says "do X" and the code now does "not-X" because the team deliberately changed approach, the document is actively harmful.
- **Age alone does not mean stale.** A two-year-old document about a stable database pattern may be perfectly accurate. Do not penalize documents for their date -- evaluate them against current code.
- **Check for successors before deleting.** If a document seems obsolete, search for whether a newer document already covers the same ground. If so, this is a consolidation or deletion candidate. If not, and the problem domain still exists, consider whether it needs a replacement rather than deletion.

---

## Phase 1.5: Investigate Pattern Docs

Pattern documents live under `docs/solutions/patterns/`. They synthesize guidance from multiple individual learnings into broader recommendations -- for example, "Error Handling Patterns in Payment Processing" might draw on three separate bug-fix learnings.

### How Pattern Investigation Differs

Patterns receive the same five outcomes (Keep, Update, Consolidate, Replace, Delete) but are evaluated as **derived guidance** rather than primary evidence. This means:

- A pattern is only as reliable as the learnings it builds on. If Phase 1 marked two of its three source learnings as stale, the pattern's foundation has weakened regardless of whether its own prose still reads well.
- A pattern with **no remaining supporting learnings** is a strong stale signal. The guidance may still be correct, but it can no longer be verified against documented evidence.
- When updating a pattern, check whether the set of learnings it should reference has changed. New learnings may have been added since the pattern was written; old ones may have been deleted or replaced.

### Investigation Steps

For each pattern document:

1. Read the document and identify which learnings it references or draws upon (explicit links, shared modules, overlapping problem domains).
2. Cross-reference those learnings against the results from Phase 1. How many are still Keep? How many were Updated, Replaced, or Deleted?
3. Evaluate the pattern's own claims against the codebase using the same six dimensions from Phase 1.
4. Classify the outcome using the same drift taxonomy (Update territory vs Replace territory).

---

## Phase 1.75: Document-Set Analysis

After investigating individual documents, step back and evaluate the collection as a whole. Individual accuracy is necessary but not sufficient -- the set must also be well-organized, non-redundant, and internally consistent.

### Overlap Detection

Compare documents across five dimensions:

1. **Problem statement** -- do two or more documents describe the same problem, even if worded differently?
2. **Solution approach** -- do they recommend the same fix or technique?
3. **Referenced files** -- do they point to the same source files or modules?
4. **Prevention strategy** -- do they suggest the same guardrails or tests?
5. **Root cause** -- do they identify the same underlying cause?

Documents matching on 3+ dimensions are strong consolidation candidates.

### Supersession Signals

Look for temporal patterns: same module and component but later date, newer solution contradicting or extending the older one, an older workaround replaced by a proper fix in the newer document.

### Canonical Doc Identification

When overlap exists, identify which document should be canonical -- the most current, broadest, and most accurate. The canonical doc survives consolidation; subsumed docs are merged into it and deleted.

### Retrieval-Value Test

Before consolidating, ask: would separate documents help a developer find the right answer faster? Two docs with overlapping solutions but different entry points (different error messages, different symptoms) may serve retrieval better as separate files. Consolidate when overlap creates confusion; keep separate when it improves discoverability.

### Cross-Doc Conflict Check

Scan for outright contradictions between documents. Two docs recommending opposite approaches to the same problem erode trust in the entire knowledge base. Flag conflicts as high-priority resolution targets.

---

## Subagent Strategy

Choose a delegation approach based on the scope and nature of the work.

| Strategy | When to Use | Description |
|----------|-------------|-------------|
| **Main thread only** | Small scope (1-2 docs), short documents | Handle everything in the orchestrator. No subagents needed. |
| **Sequential subagents** | 1-2 artifacts with many supporting files to cross-reference | Spawn one subagent at a time. Each finishes before the next starts. |
| **Parallel subagents** | 3+ independent artifacts with no cross-dependencies | Spawn investigation subagents simultaneously. Wait for all to complete before acting. |
| **Batched subagents** | Broad sweeps across many documents | Divide candidates into batches by directory or domain. Process batches in parallel, documents within each batch sequentially. |

### Two Subagent Roles

**Investigation subagents** -- read-only analysis. They examine documents, cross-reference the codebase, and return findings as structured text. They never write, edit, or delete files. Safe to run in parallel because they produce no side effects.

**Replacement subagents** -- write exactly one new document. They receive the contents of `${CLAUDE_PLUGIN_ROOT}/skills/document/references/schema.yaml`, `${CLAUDE_PLUGIN_ROOT}/skills/document/references/schema-guide.md`, and `${CLAUDE_PLUGIN_ROOT}/skills/document/assets/template.md`, along with the old document's content and investigation findings. They return a complete replacement document. Run these sequentially to avoid write conflicts.

**The orchestrator handles all deletions.** Subagents never delete files. This ensures deletion decisions remain centralized and auditable.

---

## Phase 2: Classify Action

After investigation completes, assign a recommended action to every document in scope. Each action has specific criteria and execution details.

### Keep

**Criteria**: all six investigation dimensions check out. No meaningful drift detected.

**Execution**: no file edit. Record the document as reviewed in the output summary.

### Update

**Criteria**: concrete references have drifted, but the core solution remains valid. The document's fundamental advice is still correct -- only supporting details need correction.

**Valid updates:** moved file paths, renamed classes/functions, changed import paths, advanced dependency versions, shifted API signatures (same approach), broken cross-doc links.

**Invalid updates:** rewording prose, reformatting code blocks, adjusting headings, adding new detail, fixing typos (unless they break a code reference).

**Execution**: edit in place. Touch only lines with drifted references. Preserve everything else.

### Consolidate

**Criteria**: two or more documents overlap substantially (3+ dimensions in overlap detection). Keeping them separate creates more drift risk than retrieval value.

**Execution**: identify the canonical document (most current, broadest, most accurate). Read all documents to consolidate. Merge unique content from subsumed docs into the canonical version. Update its Related section to note the merge. Delete subsumed docs. Update cross-references elsewhere in `docs/solutions/` to point to the canonical document.

### Replace

**Criteria**: the documented guidance is now misleading, AND you have verified evidence of the correct current approach. This is the highest-effort action and requires the strongest evidence.

**Execution when evidence is sufficient:** spawn a replacement subagent with the old document's content, investigation findings, and the contents of `schema.yaml`, `schema-guide.md`, and `template.md` from the support files. The subagent writes a successor document following the schema and template. The orchestrator then deletes the old document.

**Execution when evidence is insufficient:** do not guess. Mark the document as stale:

```yaml
status: stale
stale_reason: "Description of what appears to have changed and why verification failed"
stale_date: YYYY-MM-DD
```

In the output, recommend that the user investigate with `/ak-knowledge:document` the next time they encounter this problem, so the replacement can be written with full context.

### Delete

**Criteria**: the code the document references has been removed AND the problem domain no longer exists in the project. Both conditions must be true.

**Auto-delete criteria** (can be applied without user confirmation even in interactive mode):

- Every file path referenced in the document leads to a non-existent location
- The module or component named in frontmatter no longer appears anywhere in the codebase
- No other document references this one
- The problem_type's domain has no remaining presence in the project

**Execution**: remove the file. Check for and update any cross-references in other documents.

---

## Pattern Guidance

Patterns receive the same five outcomes, but the evaluation lens is different because patterns are derived artifacts:

- **Keep**: the pattern's underlying learnings are still valid, and the synthesized guidance accurately reflects them.
- **Update**: a learning was updated in Phase 1, and the pattern needs to reflect that change (e.g., a renamed module that the pattern also references).
- **Consolidate**: two patterns overlap substantially -- merge them following the same process as learning consolidation.
- **Replace**: the pattern's guidance has become incorrect because its foundation shifted. Replacement requires that the underlying learnings have already been resolved in Phase 1.
- **Delete**: all supporting learnings have been deleted, and the pattern covers a domain that no longer exists.

A pattern whose supporting learnings were all marked stale should itself be marked stale, not deleted -- the guidance might still be correct even if the evidence trail is broken.

---

## Phase 3: Ask for Decisions (Interactive Mode Only)

In autofix mode, skip this phase entirely -- all decisions were already made in Phase 2 using the autofix rules.

In interactive mode, most actions can be applied directly without asking. Only genuinely ambiguous situations warrant a question.

### When to Apply Directly

Keep, clear Updates, and Deletes meeting auto-delete criteria can all be applied without asking. The user sees the results in the commit diff.

### When to Ask

Ask for Consolidate when two plausible canonical candidates exist, for Replace when evidence is strong but not conclusive, and for any action where the user's domain knowledge would change the outcome (e.g., a module that appears deleted but may have moved to another repository).

### Question Format

Use AskUserQuestion. Structure: (1) state the finding, (2) state your recommendation, (3) present 2-4 alternatives as a numbered list, (4) ask exactly one question.

### Interaction Style by Tier

- **Focused** (1-2 docs): per-document questions with full context.
- **Batch** (3-8 docs): recommendation table first, then questions on ambiguous entries.
- **Broad** (9+ docs): triage summary, agreement on starting area, then batch-style within that area.

---

## Phase 4: Execute

With decisions finalized (from Phase 2 in autofix mode, or Phase 3 in interactive mode), apply the actions.

### Execution Order

Process actions in this order to avoid dependency issues:

1. **Updates** -- in-place edits first, since other actions may reference these documents
2. **Consolidations** -- merges and deletions of subsumed docs
3. **Replacements** -- new documents written, old ones deleted
4. **Deletions** -- standalone removals last

### Action Workflows

- **Keep**: no operation, log as reviewed.
- **Update**: apply targeted edits to drifted references, re-read to verify, do not reformat surrounding content.
- **Consolidate**: edit canonical doc to incorporate unique content from subsumed docs, delete subsumed docs, grep `docs/solutions/` for references to deleted filenames and update them.
- **Replace**: read support files, spawn replacement subagent, write new document to same category directory, delete old document, update cross-references.
- **Delete**: remove the file, grep `docs/solutions/` for references to deleted filename, update or remove those references.

---

## Phase 5: Commit Changes

After all actions are executed, handle version control.

### Check Git Context

Determine the current branch, check for uncommitted changes outside `docs/solutions/`, and identify whether you are on a feature branch or the main/default branch.

### Autofix Mode Commit Behavior

On main/default branch, create `knowledge-refresh/YYYY-MM-DD` and commit there. On a feature branch, commit directly. Use conventional format: `docs: refresh solution docs ([summary])`. Stage selectively -- only files under `docs/solutions/` and cross-reference updates in project instruction files.

### Interactive Mode Commit Behavior

Present options via AskUserQuestion: (1) commit to current branch, (2) create a new branch and commit, (3) leave uncommitted for manual review, (4) something else. Use the same selective staging approach regardless of choice.

---

## Discoverability Check

After executing changes, verify that `AGENTS.md` and/or `CLAUDE.md` in the project root semantically reference `docs/solutions/` as a knowledge source. If the directory is not mentioned, draft a minimal addition (e.g., `Check docs/solutions/ for previously documented fixes before debugging from scratch.`) and present it via AskUserQuestion in interactive mode, or apply directly in autofix mode if a clear insertion point exists.

---

## Output Format

### Summary Block

Always produce this summary at the end of execution:

```
Knowledge Refresh Summary
=========================
Scanned: N documents

Kept:         X
Updated:      Y
Consolidated: C (from M documents into N)
Replaced:     Z
Deleted:      W
Marked stale: S
```

### Per-File Detail

Below the summary, list each document with its outcome and a one-line rationale:

```
docs/solutions/build-errors/webpack-config-2024-11-15.md
  Action: Update
  Reason: webpack.config.js moved to config/webpack.config.js after project restructure

docs/solutions/runtime-errors/null-pointer-auth-2024-09-03.md
  Action: Delete
  Reason: auth module removed in migration to OAuth2 provider; problem domain no longer exists

docs/solutions/patterns/error-handling-payments.md
  Action: Marked stale
  Reason: 2 of 3 supporting learnings were replaced; pattern may need revision
```

### Autofix Report Sections

In autofix mode, the per-file detail is split into two clearly labeled sections:

**Applied** -- actions that were executed during this run, with details of what changed.

**Recommended** -- actions that require human judgment. Each entry includes the document path, the suggested action, the evidence gathered, and why automatic execution was not safe. End each recommendation with a concrete next step, such as "Run `/ak-knowledge:refresh docs/solutions/build-errors/webpack-config-2024-11-15.md` interactively to resolve."

---

## Relationship to /ak-knowledge:document

These two skills form a lifecycle pair:

- **document** captures new solutions when problems are freshly solved and context is rich
- **refresh** maintains those solutions as the codebase evolves

The boundary between them matters most at the Replace action. Refresh should only write a replacement document when the evidence gathered during investigation is strong enough to produce an accurate successor. When evidence falls short -- the code clearly changed but the correct current approach is not obvious from investigation alone -- mark the document as stale and recommend `/ak-knowledge:document` for the next time a developer encounters the problem. At that point, the full debugging context will be available, and the document skill can capture the solution properly.

This division keeps refresh focused on what it can verify through codebase analysis, and delegates deep problem-solving context to the skill designed to capture it.
