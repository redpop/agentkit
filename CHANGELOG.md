# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.38.0] - 2026-09-25

### ✨ Added

- `ak-review:deps` — **detects release-age gates.** A minimum age for new versions changes what
  "the newest version" means, and the tools on one machine disagree about it. The first skill the
  generator produced for a real project made two wrong claims in a row about such a gate, which
  lived in the developer's user config rather than in the repository. Detection now reads the
  repository, the user's and global config and the update bot's config. It then checks the package
  manager's own "latest" against the registry, because a config listing can print nothing for a
  gate that is in effect. Only a difference counts as proof. When neither check finds a gate, the
  generated skill asks the question instead of claiming there is none. The table of settings for
  each manager lists only what the managers themselves document.

- `ak-review:deps` — **asks whether a lockfile-only change reaches production.** A deploy that
  builds from a subdirectory can skip every commit that changes nothing beneath it. Netlify with a
  base directory and Render with a root directory both do this by default, so a transitive security
  fix never ships. The generator reports this as a project finding, and the audit checks for it on
  every run.

- `ak-review:deps` — **proposes a per-run baseline where the project has none.** The generator no
  longer just records the missing visual baseline as a gap. It also proposes a procedure that fits
  the UI libraries it detected: magnitude-aware screenshot diffs, a repeatable DOM snapshot,
  rule-level CSS diffs, an A/B test of the formatting patterns in use.

### 🐛 Fixed

- `ak-review:deps` — **the generated skill prescribed a commit shape of its own.** The methodology
  put measured numbers and the story of a correction into the commit message, which the first
  project to use it forbids, as does this repository. The generator now reads the project's commit
  rules and adopts them. It asks where the numbers go only when it finds no rules. A merge request
  with a review bot now means every thread is dealt with before the merge. The handoff to the
  completion workflow now takes its step numbers and skips from that workflow instead of inventing
  them. The audit checks both.

- `ak-review:deps` — **recommended `pnpm update <pkg>@<ver>`.** Before pnpm 11.23 that command
  could re-resolve unrelated packages into the same commit. `pnpm add` is recommended now. The other
  managers' rows say where a targeted update reaches further than the package it names (Bundler
  without `--conservative`, Yarn `up -R`, Composer `-w`/`-W`, Go). The uv row gained the package
  argument it lacked.

- `ak-review:deps` — **the methodology trusted three things it now checks:**
  - An A/B comparison now confirms that the old side really runs the old version.
  - Tiers now have two exceptions. Packages that share internals move together, and a peer range
    can pull a patch into a minor.
  - Coverage examples are traced through the imports before they are written, because an importer
    can be dead code.

## [1.37.1] - 2026-09-22

### 🐛 Fixed

- `ak-review:coderabbit` — **CodeRabbit CLI 0.8.0 made two of the skill's claims false.**
  `--light` was listed as the cheaper review; 0.8.0 turned it into a hidden alias for an ordinary
  one, so a script still passing it pays full price under a flag that promises otherwise. The skill
  also held that an API-key session has no signal short of starting a review, because
  `coderabbit usage` refused the key; it now answers, with the included-review allowance — a quota,
  not an entitlement, since plan and seat stay invisible on that path. `--deep` is documented, and
  the skill is verified against 0.8.0.

- `ak-review:coderabbit` — **the skill and its solution doc offered the API key as the cure for the
  daily re-login, and on 2026-09-22 API-key sessions were refused.** Every review started from a key
  session that day failed with `Review organization does not match the authenticated session`, even
  where key, repository and plan shared one organization, while a browser login in the same minute
  reviewed the same tree. Both now say the path is blocked until a re-test shows otherwise. The skill stops and asks for a browser login rather
  than running `coderabbit auth login` itself — it opens a browser, which only the user can answer —
  and first rules out the case where the message is no fault at all: a key's organization is fixed,
  so a repository outside it fails on this path by design.

  The allowance notice at the top of a review is described as what it is: a late signal that can
  arrive only after the allowance is spent, not a free exit. The check before a run is
  `coderabbit usage`.

## [1.37.0] - 2026-09-21

### ♻️ Changed

- `ak-git:operations` — **a commit-message convention stated in the project's own instruction file
  now outranks the plugin's defaults.** The skill hardcoded Conventional Commits and
  `git-workflow-specialist` restated it unconditionally, so a repository whose `AGENTS.md` mandates
  a different subject shape received commits contradicting the very file its code reviewer reads as
  criteria. Both shapes are legitimate in their own repository; the plugin has no standing to pick
  one.

  Precedence is the instruction file, then the prefix style detected from branch history, then
  Conventional Commits — **applied point by point rather than source by source.** A section that
  fixes the subject shape while saying nothing about ticket prefixes has not decided the prefix
  question; reading that silence as a prohibition would drop a branch's ticket from its commits.
  The convention is copied into the dispatch prompt rather than referenced there, because whether a
  Task-dispatched subagent inherits the instruction files is not something a skill should depend on
  either way.

### 🐛 Fixed

- `ak-knowledge:agents-md-improver` — **the skill ordered an unconditional invocation of a skill
  that may not be installed.** "Always invoke `/ak-review:workflow --audit`", and three further
  delegations, assumed a plugin that installs independently of this one: the audit ships in
  `ak-knowledge`, the skill it delegates to in `ak-review`. Every invocation is now gated on the
  available-skills listing.

  The gap was invisible to whoever wrote the file, because a marketplace developer has every plugin
  installed and never meets the missing case. The fallback does not pass quietly either — where the
  skill is absent, the manual checks are **not** equivalent, so the report states that the workflow
  section was verified for stale commands only and its structure not at all. The audit already
  demanded this discipline of the project it audits; it now holds itself to it.

- `ak-review` — **three files claimed the CodeRabbit CLI rejects `--type`; it does not.**
  `--prompt-only` is genuinely gone, but `0.7` replaced `--type` with the named scope flags and
  left it parsing — unlisted in `--help` and with its value unvalidated. The `coderabbit` skill had
  this right; the claim had been copied into `ak-review:workflow`, the repository's own
  task-completion skill and the `coderabbit` doc page in the wrong form, where it sends a reader
  looking for a failure that never happens. Verified against the installed CLI rather than its help
  output, which is exactly where the two disagree.

## [1.36.0] - 2026-09-21

### ✨ Added

- `ak-git:operations` — **a `--release` flag, and with it a release procedure this repository
  ships instead of only running.** `/bump-version` lived in `.claude/commands/` and never left
  here, so AgentKit cut its releases with a command no installing project could use. The portable
  half is now the skill's `--release` operation — boundary, bump type, version files, changelog,
  one commit, annotated tag, backfill, push — and `bump-version` keeps only what is true here: the
  marketplace's version files and the `chore: release v` commit pattern.

  Two pieces of hard-won knowledge travel with it. **The release range is measured from the last
  release commit, not the last tag**, because a release can happen untagged and the range then
  spans several versions and counts their commits a second time — measured here, four untagged
  releases once left the last tag three versions behind, and a `feat:` that had shipped two
  versions earlier would have forced another minor bump. **And the files carrying a version are
  discovered rather than listed**, with "none found" a legitimate answer: Go and most Composer
  packages release from the tag alone, and a skill that insists on bumping a file there invents a
  wrong edit.

- `ak-meta:changelog` — **`--version` and `--since`, so a caller that has already decided can say
  so.** `ak-git:operations --release` writes the new version into the project's version files
  before invoking this skill; deriving the version a second time here would read those freshly
  bumped files back and answer with the number just written, over a tag-based range the caller had
  explicitly rejected. Both flags are final when given and skip the corresponding derivation.

- `ak-knowledge:agents-md-improver` — **a commit-message convention check, because nothing else in
  a toolchain bounds what an agent writes into `git log`.** No linter reads a commit message and
  no reviewer sees it before it lands, so the instruction file is the only place the bound can
  live. An agent writes one in nearly every session, has no reader in front of it, and spends
  everything it knows — measurements, test output, rebase history, rejected options.

  The check measures the project first (ticket prefix, subject lines over 72 characters, median
  and maximum body length) and fills those numbers into a four-bullet block. The operative rule is
  the exclusion list rather than the line ceiling, and the ceiling is calibrated rather than
  guessed: applying the exclusions to the two longest messages in a real project took them from
  411 and 401 words to 161 and 148, with every load-bearing reason intact. Two properties are
  recorded in the skill so a later audit does not undo them — the block stays inline because it
  must be in context when the message is written, and it carries a scoping line because reviewers
  act on diffs, not on commit messages.

## [1.35.0] - 2026-09-20

### ✨ Added

- `ak-knowledge:agents-md-improver` — **instruction files are audited as review criteria now, not
  only as instructions.** CodeRabbit's knowledge base discovers `**/AGENTS.md` and `**/CLAUDE.md` by
  default and applies them as review criteria; `ak-review:coderabbit` hands the same file to a CLI
  review with `-c`. Every line becomes something a reviewer acts on, silently, on every change.

  A vague line therefore produces vague findings — "keep the code clean" is harmless as advice and
  useless as a criterion, yielding a comment on every merge request and teaching the team to ignore
  the reviewer. A rule a linter already enforces produces duplicates instead. Discovery also looks
  for the other files a reviewer applies at the same time — `.cursorrules`,
  `.github/copilot-instructions.md`, `GEMINI.md`, `.windsurfrules`, `.clinerules/*`, `.rules/*` —
  which are usually left over from an abandoned tool and contradict the current file. And in a
  monorepo a rule that only holds for one package belongs in that package's own file, where it is
  scoped for agents and reviewers alike.

### 🐛 Fixed

- `ak-review:workflow` — **the template shipped a dead command to other projects.** It generated
  `coderabbit review --prompt-only --type uncommitted`; both flags were removed in CLI `0.7`. This
  repository's own workflow had been corrected and the template it hands to others had not — the
  exact failure `agents-md-improver`'s dogfooding check warns about, committed by the repository
  that wrote the warning.

- `ak-review:coderabbit` — **the cause of the daily re-login was still wrong here**, in the skill and
  on its documentation page: both blamed a CLI upgrade. Two credentials with two lifetimes sit
  behind one OAuth login — a bearer token measured 83 days from expiry, which keeps identity and the
  review alive, and a cookie session that the seat and usage endpoints require and that lives hours.
  Nothing renews the cookie; only the browser callback during `auth login` mints one. The re-login
  repairs it and must be repeated, and a repair that has to be reapplied on a schedule is describing
  its own cause. An API key removes the cookie from the path.

- `ak-review:coderabbit` — Phase 1 said "first" twice, telling the reader to read the plan and seat
  lines and only afterwards that under an API key they do not exist. The authentication type is
  asked first now and decides whether the rest of the check applies.

- `ak-review:coderabbit` — `path_filters` are out of the list of reasons a CLI review comes back
  empty; measured, they exclude nothing there. What belongs in that list is a scope that never
  contained the work.

## [1.34.0] - 2026-09-20

### ✨ Added

- `ak-review` — **a plugin-level `AGENTS.md`**, carrying the adapter contract: the three reserved
  exit codes and their opposite advice, the `null`-never-`0` rule for cost and token figures, and
  the standing suspicion that an empty result has causes unrelated to the code. The root
  `AGENTS.md` already anticipated this file ("each plugin directory can contain its own
  AGENTS.md"); CodeRabbit's knowledge base discovers `**/AGENTS.md` by default, so it reaches the
  hosted reviewer without configuration, a CLI run through `-c`, and any agent working in that
  directory by simply being there.

- `ak-review:coderabbit` — **a section on the same repository being reviewed twice.** Conventions
  reach the hosted reviewer on their own and a CLI run through `-c AGENTS.md`; scope is the
  opposite, with `path_filters` binding on the hosted side and nowhere else. Durable guidance
  therefore belongs in an `AGENTS.md` rather than in `path_instructions`, which work on one surface
  and silently do nothing on the other.

  With it, the instruction that is genuinely non-obvious: **when opening a merge request, put the
  ticket and the intent in the description.** A CLI review gets its requirements from the session
  through `-c`; a hosted review has no session and, without a ticket-system connection, no way to
  reach a ticket at all. The description is the only channel, and without it the reviewer checks
  the code against nothing.

### ♻️ Changed

- **`.coderabbit.yaml` loses its `path_instructions`.** Checking them against the root `AGENTS.md`
  showed four of five repeating it almost verbatim — hooks `exit 0`, the eleven-file version sync,
  `docs/` moving with the plugin, hunting stale claims — in the same file whose own header states
  that conventions are not repeated in it. The hosted reviewer had been reading them all along.
  The fifth moved to `plugins/ak-review/AGENTS.md`. What remains in the configuration is what only
  it can do: review scope for the hosted reviewer, and the profile.

## [1.33.6] - 2026-09-20

### 🐛 Fixed

- `ak-review:coderabbit` — **a configuration does not bound a CLI review, and this plugin claimed
  twice in two days that it does.** Measured over the same 14-file diff, twice: every file was
  reviewed, `CHANGELOG.md` included, with `!CHANGELOG.md`, `!**/CHANGELOG.md` and `!docs/**` all
  present in the repository's `.coderabbit.yaml`. Neither the root-file form nor the directory form
  — CodeRabbit's own documented example — excluded anything.

  The reason is in the CLI reference: a local review reads `.coderabbit.yaml` as *additional
  instructions*, the role the `-c` flag fills, whose help names `coderabbit.yaml` as an example of
  what to pass it. There is no enforcement layer on that path, only a model reading text. Filters
  state an intention that only the hosted reviewer acts on; `path_instructions` and `profile` arrive
  the same way, and whether the model follows a given instruction is a question of review quality
  rather than of configuration.

  With that goes the claim that filtering saves money on per-file billing: a CLI run pays for every
  changed file whatever the filters say. The condition table in the configuration section gains a
  column for where each key works, and says plainly that a terminal-only workflow loses the
  strongest reason to keep a configuration at all.

## [1.33.5] - 2026-09-20

### 🐛 Fixed

- `ak-review:coderabbit` — **three corrections, produced by the first real CodeRabbit run against
  this repository.** All three are to text shipped in the preceding two days.

  - **The ordering bug, found by CodeRabbit itself.** Phase 1 searched "the commits in scope" for
    ticket references *before* resolving the base — and what is in scope is exactly what the base
    decides, so the search ran against a range that did not exist yet. Introduced a day earlier
    while correcting a different claim about that paragraph's position. The base is resolved first
    now, and the step says why it comes second.
  - **API-key authentication reports no organization, plan or seat at all.** The entire output is
    `{"authenticated":true,"authType":"api_key","region":"us"}` — the *Review access* block is
    absent by design. Phase 1's staleness check would have fired on every run and sent the caller
    into a re-authentication that changes nothing. It is gated on the auth type now, with the
    companion gap named: `coderabbit usage` fails there with `Authorization header not found`,
    because the CLI does not send the key on that request.
  - **`path_filters` did not bound the review.** Measured: a 14-file diff came back as 14 files
    reviewed, `CHANGELOG.md` among them, with `!CHANGELOG.md` standing in the repository's
    `.coderabbit.yaml`. Whether that holds for every auth mode and CLI version is unverified, but
    the claim that a configuration silently limits a CLI review's scope cannot stand on this
    evidence. A configuration is information now, not a boundary: Phase 6 compares what the filters
    claim against the `reviewedFiles` the run reports and says which of the two is true.

## [1.33.4] - 2026-09-19

### 🐛 Fixed

- `ak-review:coderabbit` — **a full consistency pass over the skill, after several hours of
  additions to it.** Six findings, four of them introduced by those additions, and the first is the
  defect this repository names as its own most frequent.

  - **A count went stale.** Phase 3 claimed "four different ways for a run to produce no findings
    for reasons that have nothing to do with the code" and counted a heartbeat among them — which is
    not such a way, but a way to mistake liveness for completion. Phase 1 had meanwhile added a
    fifth, a scope cut down by the configuration's `path_filters`, which Phase 6 already treated as
    one. The count is now a list, introduced as one that keeps growing: a number is a promise the
    next addition breaks. The same sentence stood on the documentation page and was corrected there
    too — it was in two places, and the first fix reached only one.
  - **Phase 1's heading named two of the four things it does**, after requirements discovery and
    configuration detection were added to it. It names all four now.
  - **The requirements step claimed to run "before resolving anything else"** while sitting third.
    It runs before the base, and says that instead.
  - **Phase 3 contradicted itself about the rendered-output fallback** — warned against it at the
    top, prescribed it at the bottom. Both are right in different situations, which is now the
    distinction drawn: a failed whole-file parse looks like absent output and is not.
  - This skill's own `--type` argument and the CLI's hidden `-t/--type` are different things, and
    sat two paragraphs apart unremarked.
  - `coderabbit config validate` was recommended in one section while another noted it has dropped
    out of `config --help`. The recommendation carries that caveat and a fallback now.

## [1.33.3] - 2026-09-19

### 🐛 Fixed

- `ak-review:coderabbit` — **the requirements file now goes where the system says, not where the
  skill says.** 1.33.2 moved it out of the repository to a fixed path under `/tmp`, which fixed the
  part that could be committed and left two smaller problems.

  `/tmp` is world-readable (1777), and the file holds a ticket's summary and acceptance criteria
  from a private tracker — readable by every account on the machine. `mktemp -d` creates a per-user
  directory at mode 700 instead, verified here as `drwx------` under `/var/folders`. It also cannot
  collide with a second run in the same second, and the system reclaims it rather than letting
  timestamped directories pile up until a reboot.

  The divergence from `/ak-review:execute` is deliberate, and the reason is the point: that skill
  keeps artifacts at a predictable path because they are **evidence** — a raw stream and a report
  worth re-examining without paying for the run again. A requirements file is an **input**,
  reconstructed from the ticket in seconds and of no use afterwards, so the one argument for a
  predictable path does not apply and only its costs remain.

## [1.33.2] - 2026-09-19

### 🐛 Fixed

- `ak-review:coderabbit` — **the requirements file ended up inside the review it described.** 1.33.0
  said it was "written to a file" and named no location, so the obvious place is the repository —
  where it is untracked, and where `--include-untracked` is mandatory two paragraphs earlier. The
  file joined the change it was meant to describe: reviewed, commented on, billed as a reviewed file
  under usage-based pricing, and left behind in the working tree.

  It goes to `/tmp/ak-review-coderabbit/<timestamp>/` now — out of every scope the review can see,
  and beside where `/ak-review:execute` already writes its artifacts.

## [1.33.1] - 2026-09-19

### 🐛 Fixed

- `ak-review:coderabbit` — **the requirements had to be noticed before they could be passed.**
  1.33.0 said to send a change's acceptance criteria through `-c` "when the change belongs to a
  ticket or a spec" — a condition with no trigger. Nothing about a diff announces what it was meant
  to achieve, so an agent reviewing a repository it had not just written would never find out one
  existed.

  Phase 1 runs the discovery now, by pointing at `delegate`'s Phase 2.5 rather than repeating it:
  ticket IDs by pattern from the branch name and the commits in scope, deduplicated and capped, then
  summary, status, description and acceptance criteria; spec and task Markdown where no ticket
  system is reachable. One method, one place.

  Two limits belong to the calling session rather than to the tool, and are stated: reaching a
  ticket system needs an Atlassian MCP, and without one only the spec path is available — which
  Phase 6 reports, because a review that ran without requirements is not one that found nothing to
  say about them. And a long-lived branch carries several ticket IDs in its commits, most of them
  history rather than the requirement this change answers to.

## [1.33.0] - 2026-09-19

### ✨ Added

- `ak-review:coderabbit` — **a ticket can now reach the review, through `-c`.** CodeRabbit sees the
  diff and the repository; it does not see what the change was supposed to achieve. A review can
  therefore confirm that the code is correct and miss that it does the wrong thing — a defect class
  no amount of reading the diff finds.

  `/ak-review:delegate` closes this for the external-agent path by writing the requirements into the
  prompt it builds. This skill has no such prompt: it hands the CLI a scope and reads findings back,
  which left the same gap open on the path most reviews take here. `-c` accepts several files, so
  the acceptance criteria go in beside `AGENTS.md` as a file the session writes.

  The session is what fetches those requirements, from a ticket system or a spec, exactly as
  `delegate` does. Recorded with it, because the alternative looks tempting: CodeRabbit's platform
  can be given its own Jira connection, and that serves the hosted merge-request reviewer only — it
  does nothing for a review run from the terminal.

## [1.32.1] - 2026-09-19

### 🐛 Fixed

- `ak-review:coderabbit` — **a review ignored the configuration that bounded it.** The section added
  in 1.32.0 sat behind the workflow, and nothing in phases 1 to 6 referred to it, so a review in a
  project with a `.coderabbit.yaml` behaved as though the file were not there.

  `path_filters` remove whole trees from a review. The run then completes cleanly with nothing to
  say about them — indistinguishable from having looked and found nothing, which is the failure
  class this plugin keeps closing. Phase 1 checks for the file and reads what it excludes; Phase 6
  names those paths in the summary, the same treatment a partial run or a `review_skipped` already
  gets.

  Phase 6 also raises the opposite case: no configuration, and the run argued for one. It says so in
  a sentence and stops. Creating the file as a side effect of a review request would be a repository
  change nobody asked for, and it contradicts the section's own position — most projects need none,
  and the decision takes judgment about the repository rather than the aftermath of one review.

- `ak-review:coderabbit` — the skill states its **two jobs** at the top of the workflow. Its
  description has covered both since 1.32.0, and a review-shaped workflow followed by a setup
  section is otherwise an invitation to start reviewing when the question was about configuration.

## [1.32.0] - 2026-09-19

### ✨ Added

- `ak-review:coderabbit` — **a section on setting up a project's `.coderabbit.yaml`.** A different
  task from running a review, and one reliably overdone in the same direction: by writing too much.
  CodeRabbit already reads `AGENTS.md` and `CLAUDE.md` through its knowledge-base defaults, so a
  config that restates the conventions buys nothing and creates a second source that drifts.

  The section names the three conditions that earn a config — files that should never be reviewed,
  areas needing different attention, a wrong volume of nitpicks — and says to put only those in it.
  Usage-based reviews bill per reviewed file, which makes `path_filters` a cost lever rather than a
  tidiness one.

  **The schema is deliberately absent.** `coderabbit config --agent` is a read-only inspection that
  reports what exists, which format has authority, a `baseHash` for safe overwriting, and the URL of
  the schema in force — so it is read from there, in the version that applies, rather than from a
  copy that ages. On one day this CLI reworded a flag description, dropped a subcommand from its
  help and appeared to remove two fields it had not removed.

  What the section does carry is the part no generator can: derive the content from the repository
  at hand — its AGENTS.md, its layout, the mistakes its history records. A configuration copied from
  another project is worse than none, because it looks considered.

  Recorded with it: a `.coderabbit.yaml` takes precedence over a `.coderabbit.config.ts` when both
  exist, so adding the TypeScript form beside an existing YAML file produces something that silently
  does nothing.

## [1.31.8] - 2026-09-19

### 🐛 Fixed

- `ak-review:coderabbit` — **five corrections taken from CodeRabbit's own review skill**, which the
  vendor maintains as open source at `coderabbitai/skills`. The second is the failure class this
  plugin has spent a day closing elsewhere:

  - `--agent` emits **NDJSON**, one object per line. Phase 3 named no format, and a whole-file parse
    fails — after which the natural move is to fall back to the rendered text and throw away the
    structure the flag exists for.
  - **A `complete` event with `status: review_skipped` and zero findings means no review ran.** Not
    that the code is clean. A heartbeat says the process is alive, not that it finished. With a
    non-zero exit and a partial run, that is four ways to end with no findings for reasons that have
    nothing to do with the code — and two of them were unknown here.
  - **Severities are the CLI's scale** (`critical`, `major`, `minor`, `trivial`, `info`, `none`) and
    are passed through unrelabelled, so a reported finding traces back to what the tool said.
  - **Scope flags do not combine freely.** `--committed` and `--uncommitted` conflict,
    `--include-untracked` never goes with `--committed`, and it works standalone rather than
    requiring `--uncommitted`. The table was valid by luck; it now says what each row covers and
    why. A file-limit failure is reported rather than silently retried with a narrower scope.
  - **The CLI uploads the diff to CodeRabbit's API**, which this skill never mentioned. The resolved
    scope is checked for credentials before a run, and review output is treated as untrusted text
    rather than as instructions.

  Also corrected: `-t/--type` is hidden compatibility syntax, not a removed flag.

  Unchanged and still unique to this skill — the vendor's reference on authentication and accounts
  is 27 lines and mentions none of it: the entitlement preflight, the stale-login remedy, and the
  free-allowance fallback.

## [1.31.7] - 2026-09-19

### 🐛 Fixed

- `ak-review:coderabbit` — **a failed or interrupted review could be read as a clean one.** Phase 2
  said nothing about exit codes, so a review that exits non-zero — the CLI's signal since 0.7.7 that
  it failed — was indistinguishable from one that found nothing. An interrupted run is a second
  case: it writes what it had and declares itself partial, and an absent finding then says nothing
  about code the run never reached. Both are now named, along with the fact that findings and
  checkpoints survive a failed attempt, so a repeat resumes instead of starting over.

- `ak-review:coderabbit` — **unverified findings went through the same gate as verified ones.** The
  CLI has surfaced and counted them separately since 0.7.8. An unverified finding is a lead the tool
  did not stand behind; it can no longer reach *Apply* without confirmation against the code.

### ♻️ Changed

- `ak-review:coderabbit` — **project conventions are passed in rather than filtered out
  afterwards.** `-c <files...>` takes additional instruction files — the CLI's own help names
  `claude.md` as the example — so the skill passes `-c AGENTS.md` when the repository has one.
  Preventing a finding that contradicts the project's rules is cheaper than sorting it out in
  Phase 4. With the caveat stated: CodeRabbit's hosted reviewer already discovers `**/AGENTS.md`
  and `**/CLAUDE.md` through its knowledge-base defaults, and whether the CLI applies the same
  defaults is undocumented.

- `ak-review:coderabbit` — three corrections from the same pass: `--type all` compares **net**
  changes while `--committed` reads a Git snapshot; **changing the comparison base resets the saved
  review context**, so alternating between two bases pays for a full review each time; and `0.7`
  retired five flags (`--plain`, `--fast`, `--interactive`, `--cwd`, `--prompt-only`), not the two
  this skill named.

  Recorded with them: the published changelog is a lead, not a source. `coderabbit config validate`
  appears there as a 0.7.1 feature and is gone from `config --help` on 0.7.8, though it still runs.
  Every item above was checked against the installed CLI before being written down.

## [1.31.6] - 2026-09-19

### 🐛 Fixed

- `ak-review:coderabbit` — **1.31.5 recorded a symptom as a version difference.** It stated that
  0.7.8 had removed `Plan` and `Seat` from `coderabbit auth status` and rewrote Phase 1 around
  their absence. 0.7.8 prints both. They were missing because the stored login had gone stale under
  the CLI upgrade — and the conclusion was drawn from a single observation on that broken session.

  `coderabbit auth logout && coderabbit auth login` restores all of it at once: the two lines,
  `coderabbit usage`, and the plan itself. Throughout, the organization's trial had been running
  and the seat had been assigned; reviews were silently spending the free CLI allowance anyway.

  Phase 1 therefore reads plan and seat again, and now treats a missing line as a symptom with a
  one-command remedy. `coderabbit doctor` is documented as no help here — nine checks passed,
  authentication included, on a CLI with no entitlement. The check added in 1.31.5 stays as
  defence in depth: a run that announces a fallback to the free allowance is stopped, because a
  session can go stale between one run and the next.

## [1.31.5] - 2026-09-19

### 🐛 Fixed

- `ak-review:coderabbit` — **Phase 1 told the agent to read two fields the CLI no longer prints.**
  It checked the plan and the seat from `coderabbit auth status` and stopped if they were wrong;
  0.7.8 prints neither, in the rendered output or under `--agent`. The check was unfollowable, and
  an agent following it spent the free CLI allowance believing a paid plan applied.

  The previous release claimed the skill was verified against 0.7.8. Only `review --help` was
  re-run — `auth status` was not, and that was the surface that had changed. The *verified against*
  line now names both, and says why checking one of them is not enough.

  **Whether the paid plan applies cannot be established up front on 0.7.8 at all.** `coderabbit
  usage` may fail with an org-access error, which is a hint rather than a verdict, and `coderabbit
  doctor` passed nine checks, authentication included, on a CLI with no entitlement. The provider
  and organization are still printed and still worth checking, so that part stays; for the rest,
  the skill now reads the review's own opening lines and stops when a run announces the free
  allowance. Measured: the allowance is three reviews, and the message that the plan was never in
  play arrived only with the fourth.

## [1.31.4] - 2026-09-18

### 🐛 Fixed

- `ak-review:coderabbit` — **the audit in 1.31.3 ran against CLI 0.7.6 while 0.7.8 had already
  shipped.** The skill quoted `--uncommitted` as covering "staged changes and tracked edits"; 0.7.8
  rewords it to "Review uncommitted Git changes", so the quote described text that no longer exists.
  The claim holds and now rests on something steadier — the CLI ships a separate
  `--include-untracked` flag for "files that have not been added to Git", which is what proves they
  are outside the default scope.

- `ak-review:coderabbit` — the 1.31.3 rewrite dropped the note that `0.7` removed `--prompt-only`
  and `--type`, leaving no version reference at all. Both are back, as a *verified against* line in
  the shape `execute` uses for its adapters, with the instruction to check `--help` before trusting
  a flag named here. `--remote <owner/repo>` is named too, along with why this skill does not use
  it: it reviews the working tree you are in, and the flag is GitHub-only.

## [1.31.3] - 2026-09-18

### 🐛 Fixed

- `ak-review:coderabbit` — **the skill reviewed less than it claimed.** Its default scope,
  `--uncommitted`, covers "staged changes and tracked edits" in the CLI's own words, so a file
  never added to Git was not reviewed at all. Every new file in a change was skipped silently, and
  the result looked exactly like a clean review. `--include-untracked` now goes with it.

- `ak-review:coderabbit` — findings were scraped from the plain-text rendering although the CLI
  emits structured ones with `--agent` and says so unprompted when it detects an agent environment.
  Phase 3 reads the structured output now, with the rendering as a declared fallback rather than
  the silent primary path.

### ♻️ Changed

- `ak-review:coderabbit` — **Phase 1 checks who the CLI is before anything is spent.** The CLI
  signs in per provider: a GitHub login does not see GitLab groups and vice versa, and a repository
  belonging to neither runs on the free CLI allowance instead of the paid plan. That fallback is a
  single line at the top of the output. Measured: two full reviews ran on it while a paid plan sat
  unused under a different provider.

- `ak-review:coderabbit` — new arguments, all verified against CLI 0.7.6: `--base-commit <sha>` for
  a follow-up round that should only review what is new since the last one (the same reasoning
  `execute` gained in 1.31.1), and `--dir <path>` for reviewing one plugin of a monorepo without
  the rest. `coderabbit review findings` is documented as the way to reprint the last review
  without paying for a second one, and `--use-credits` carries a warning: it turns a run that would
  have stopped at the plan's limit into a billed one.

## [1.31.2] - 2026-09-18

### 🐛 Fixed

- `ak-review:execute` — **all three cost extractors could still report `0` for a figure
  nobody counted.** The "null, never 0" rule was enforced for the case of no source events
  at all, and undercut one level down: the sums are written `map(.field // 0) | add`, so a
  field absent from *every* event summed to 0 and was reported as a measurement — a run
  presented as free. `// 0` is still right for one absent field among present ones, which
  really is a zero contribution; what it cannot see is the field being absent everywhere,
  which is an absence. An explicit `0` in the stream is a measurement and stays `0`.

  A **mixed** stream — some events carrying the field, others not — is left alone
  deliberately. It has never been observed, and a branch for it would be a guess at which
  of the two the tool meant.

### ♻️ Changed

- `ak-review:execute` — **the completeness check is now one shared script**,
  `report-findings-check.sh`, instead of a copy in each of the three report extractors.
  Extractors are per-adapter because each tool emits its own event schema, and that reason
  ends where the schema does: by the time a report reaches this check it is plain markdown,
  and what counts as *finished* is delegate §8 — the same contract for every tool. Three
  copies meant one idea in three places; it was wrong in all three at once, then changed in
  all three on the same day. A copy left behind fails silently and in the direction that
  auto-fixes code from a model's narration. Each extractor keeps its own exit codes and
  messages. The Adapter Reference now states the split: anything that reads the tool's
  events belongs to the adapter, anything that judges the text those events carried does not.

- `ak-review:delegate` — **the prompt template now says what to do when sub-agents are not
  available.** §4 told every reviewer to dispatch one per dimension and said nothing about a
  tool that cannot — Codex has no sub-agents at all, and the instruction lands in its prompt
  too. The fallback is named: work the dimensions in sequence and say so in the report,
  rather than dropping any of them.

## [1.31.1] - 2026-09-18

### 🐛 Fixed

- `ak-review:execute` — **the completeness check let through the exact narration it was
  built to stop.** It tested for the substring `"findings"`, so a model writing «I'll end
  with a "findings" block as required» satisfied it and was handed on as a finished report:
  Phase 5 verifies that narration against the code, Phase 6 writes fixes from it. The check
  now parses the block and requires it to be **terminal** — the last non-whitespace thing in
  the output, which delegate §8 already demanded. Position is what separates a report from
  an announcement of one: a model that opens by echoing the schema and is then cut off has
  emitted a valid `findings` block and no review at all.

  The cost is accepted and pinned in tests: a finished report that appends anything after
  its findings block — a reproduction snippet, a closing sentence — is now reported as
  unfinished. That error is loud, keeps the prose and costs one run's auto-fix; the opposite
  error is silent and fixes code from narration.

- `ak-review:execute` — **the `opencode` adapter called a quota refusal a startup stall**
  whenever the refusal arrived before the first token. Measured: HTTP 429
  `Account.GoUsageLimit` after 74 ms with a `retry-after` of 9541 s, stdout empty, the
  process still alive. The startup probe reads stdout alone and the `126` detection parses
  the JSON stream, of which there was none — so the run came back as `125`, "transient, try
  again soon", after burning two retries against a wall that stood for two and a half hours.
  `125` and `126` exist precisely because they need opposite advice.

  stderr is now read while the stream is empty; a refusal found there wins over the stall
  heuristic, skips the retries and carries `retry-after` into the message. The pattern is
  deliberately narrow, and not because stderr is quiet — with `--print-logs --log-level
  DEBUG` a stalled run writes plenty. A bare `429` matches timestamps (`…:41.429Z`) and
  durations (`+15429ms`) in ordinary log traffic, which would turn every stall into a false
  refusal and invert the fix. Checked against real logs: **56 such substrings, none matched;
  13 real refusals, all matched.**

### 📝 Documentation

- `ak-review:execute` — Phase 4 had no instruction for a report extractor exiting `1`. Only
  exit `3` was described, so a paid run that produced no report at all continued to Phase 5
  with an empty findings list and was summarised as a clean review. Measured: an opencode
  run exited `0` after five tool calls and USD 0.006 with no report event in the stream.
- `ak-review:execute` — Phase 3's salvage rule, read literally, sent **every** run down the
  salvage path, including successful ones: it had been widened from "on `124`" to "not only
  on `124`" without a sentence bounding it to runs that failed.
- `ak-review:execute` — Phase 2 now says to review only the delta on a follow-up round.
  `--base` auto-detects a branch point, not a review history, so leaving it unset re-reviews
  everything each round. Measured on a sixth round over one ticket: 9 files and +2031/−88
  against the ticket base where only 5 files and +362/−87 were new.
- `ak-review:execute` — "no effort" reads as neutral but hands the level to the tool or its
  provider, which can pick the lowest. Observed on `opencode` with no `--variant`:
  `reasoningEffort: "low"`. Harmless for everyday runs, misleading when the result is being
  compared against a tool running at `xhigh`.
- `ak-review:execute` — the adapter contract still promised **two** reserved exit codes when
  there have been three since `126` was added, and `125` was still described as the only
  code that leaves nothing to salvage.
- `ak-review:delegate` — §8 now states that the JSON block must be the last thing in the
  response, with nothing after its closing fence, because `/ak-review:execute` checks that
  position.

## [1.31.0] - 2026-09-05

### ♻️ Changed

- `ak-review:execute` — **a figure the stream never carried is now reported as unavailable
  rather than as zero, across all three adapters.** The doctrine was already written down
  for money — "zero and 'not reported' are different claims, and only one of them is true" —
  but the adapter contract undercut it for everything else by requiring extractors to
  "degrade to zeros on a truncated stream". That sentence was about robustness, not
  meaning; both hold at once. Extractors still exit 0 so a salvaged report survives, and
  now return `null` for what was never measured.

  The case that prompted this: a codex run killed by a timeout. Its usage lives solely in
  the `turn.completed` event it never sent — verified absent end to end on a real stream —
  and codex reports no money, so the token count is the only figure it contributes. It was
  reporting `0 tokens` for a run that had spent twenty minutes working. Not a rounded
  answer, a wrong one.

  The same now applies to `opencode` (no `step_finish` at all) and `claude` (no
  `modelUsage`). **Measured runs are untouched** — every real stream on hand reports exactly
  the figures it did before.

  Phase 8 gains a third case to distinguish: the tool reports no money by design, nothing
  was measured, or the cost is only partly known. Each needs a different sentence, and none
  of them is `USD 0.00`.

## [1.30.2] - 2026-09-05

### 🐛 Fixed

- `ak-review:execute` — **the `claude` adapter reported a token count roughly two orders
  of magnitude too low.** `claude-extract-cost.sh` summed the result event's own `usage`,
  which covers the main agent only and leaves out the cache counters entirely. Anthropic
  reports `cache_read_input_tokens` and `cache_creation_input_tokens` separately from
  `input_tokens`, and a review prompt is mostly cached context — so this was not a rounding
  error but the bulk of the figure. Measured on a one-sub-agent probe: **1308 tokens
  reported against 155527 processed.** Tokens now come from `modelUsage`, summed across
  models and including both cache counters.

- `ak-review:execute` — **the `claude` preflight now checks authentication.** An
  unauthenticated run does not fail legibly, contrary to what the script's own comment
  claimed: measured, it exits 1 after writing 28 KB of stream with `subtype: "success"` and
  `total_cost_usd: 0`, whereupon the report extractor blames a usage limit, a timeout or a
  crash — three wrong places — and the cost extractor prints USD 0.00, which reads as a run
  that was free rather than one that never happened. `claude auth status` prints JSON with
  a boolean `loggedIn`, which is the machine-readable signal the adapter's rule required and
  Claude Code did not offer when the rule was written. Only an explicit `false` blocks;
  unparseable output passes, because being unable to answer the question is not the same as
  answering it "no".

### 📝 Documented

- **Claude Code's `total_cost_usd` does include sub-agent spend** — measured, closing the
  question 1.30.1 left open. `modelUsage`'s `costUSD` matched `total_cost_usd` to the cent
  while covering tokens the top-level `usage` did not. The money was whole all along; only
  the token count was not, which is the mirror image of the `opencode` problem and needed
  the opposite fix. The spend cap is Claude Code's own `--max-budget-usd` and binds against
  that same accounting.

- `subagent_stats.spawned` is carried into the cost file as `subagents_spawned`, so a
  claude run says how many sub-agents it used the way an opencode run now says how many it
  could not price.

## [1.30.1] - 2026-09-05

### 🐛 Fixed

- `ak-review:execute` — **OpenCode runs that used sub-agents no longer report a cost that
  is only part of the truth.** Sub-agents run in their own sessions and opencode emits
  `step_finish` only for the session that produced it, so summing the stream yields the
  parent's spend alone. The delegate prompt asks for one sub-agent per review dimension by
  default, which made the under-reporting the normal case rather than an edge one.

  Measured on a four-dimension review: 23 `step_finish` events, all under a single session
  id, against two completed sub-agents whose 32 KB of findings sat in the same stream. The
  extractor reported USD 0.8589. Across the two runs in one provider billing window the
  extractors reported USD 1.17 against USD 3.17 actually charged — a factor of 2.7, and the
  user went over quota without the reported figure ever hinting at it.

  `total_cost` is now `null` whenever a sub-agent ran, with the known part reported beside
  it as `parent_session_cost` and the number of uncounted sessions as `subagent_sessions`.
  Phase 8 reports that as "at least USD X, plus N sub-agent sessions the tool does not
  price" rather than as the run's cost. Zero, "not reported" and "partly known" are three
  different claims; presenting the third as the first was the failure here.

  **A run without sub-agents is unaffected** and still reports a real total, so the fix
  costs no accuracy where the sum was already complete.

### 📝 Documented

- The sub-agent session ids *are* in the stream, in the `task` part's
  `state.metadata.sessionId` — enough to count what is missing, which is what makes the
  partial figure honest instead of merely absent. The sessions themselves are not written
  to opencode's local storage, so the amount cannot be recovered after the run.

- Whether Claude Code's `total_cost_usd` includes sub-agent spend is recorded as
  **unverified**: the probe run that would settle it failed on an expired OAuth session
  before reaching the model. It matters less there than for opencode, because the spend cap
  is Claude Code's own `--max-budget-usd` rather than anything computed from the reported
  figure — both come from the same accounting, so the cap binds against exactly the number
  that gets reported. The `result` event carries `subagent_stats` and a per-model
  `modelUsage` breakdown, noted in the Adapter Reference as where to look if this needs
  answering.

## [1.30.0] - 2026-09-05

### ✨ Added

- `ak-review:execute` — **`effort` is now keyed by tool, because its vocabulary was never
  this plugin's to share.**

  ```json
  "effort": { "codex": "xhigh", "claude": "high" }
  ```

  The entry for the tool actually running applies; a tool the map does not name runs with
  no effort at all, which is valid under every adapter.

  `effort` used to be one scalar for every adapter, and that held together only while
  `tool` and `effort` came from the same config layer. `--tool` is overridable per run and
  `effort` was not, so switching adapters for a single run — which the skill explicitly
  invites — carried the configured level into a vocabulary that may not contain it. Nothing
  complained: codex hands the value to the API as a config value, and `opencode run --help`
  declares `--variant` as a plain string with no choices, so the review proceeded at a level
  nobody chose and failed, if at all, pointing somewhere else entirely.

  A plain string still works and now carries the meaning it always implied: "this level, for
  the tool configured beside it". Running a different tool stops with an error naming both
  tools and offering three ways out. Sharing a spelling is not sharing a meaning — codex's
  `xhigh` and Claude Code's `xhigh` name levels of unrelated scales — so a value is refused
  on a tool switch even when both enums contain it.

- `ak-review:execute` — **`--no-effort`**, to run once with no effort at all. `--tool` could
  be overridden per run and `effort` could not, and `--effort ""` looked like the way to
  even that up while silently not being one: an empty flag value was discarded before the
  merge and read as "not given", leaving the configured level in place. It is now an error
  pointing at `--no-effort`, and `--effort` together with `--no-effort` is refused rather
  than ranked — any precedence there would be a guess at what was meant.

- `ak-review:execute` — **adapters may declare the effort values they accept**, via a new
  optional `<tool>-efforts.sh` in the adapter contract. `resolve-config.sh` refuses anything
  outside that list before work starts. `codex` and `claude` ship one; the near-miss it
  exists for is `none` and `minimal`, real codex levels that Claude Code does not have,
  where the two enums otherwise agree. This is a second, narrower check than the one above:
  keying answers *is this value from the right vocabulary*, the list answers *is it one this
  tool accepts*.

### ♻️ Changed

- `ak-review:setup` reads `<tool>-efforts.sh` instead of offering levels of its own — which
  also fixes it never having mentioned the `claude` adapter — and writes `effort` keyed
  under the chosen tool, merging into an existing map rather than replacing it. A string
  left by an older version is converted, and the conversion is reported.

- Effort values are no longer repeated in adapter comments, `SKILL.md` and the docs. Each
  list now lives in exactly one file, the one the code actually reads.

### 📝 Documented

- `opencode` ships no `opencode-efforts.sh` and is not expected to: its `--variant` levels
  belong to the provider behind the model rather than to opencode, so any list would be a
  guess that silently narrows valid runs. A test asserts the file's absence. A value opencode
  itself does not understand therefore still reaches it — what no longer does is a value
  written for another adapter, which the tool-keying catches without needing a list.

## [1.29.0] - 2026-09-01

### ✨ Added

- `ak-review:execute` — **A consolidation pass that finishes a review the salvage path
  rescued.** When a run is killed near the end, the fan-out has long since completed and
  only the merge is missing — measured on the run that prompted this: five of six
  dimensions done, 60 KB recovered, and the one lost step was the most valuable. Phase 3b
  now runs the same adapter a second time with a prompt built from the recovered text.
  It needs no repository access and no write access, which is what makes it work under
  every adapter, including codex's read-only sandbox and claude's allowlist.

  It fires only when all three hold: `subagents.md` exists, the report extractor returned
  `3` (output present, merge missing), and the adapter did not return `126` — a refusal
  means a second call hits the same wall. The prompt is deliberately narrow: merge, do not
  review. The model may read a cited file to check a line number or drop a claim the code
  contradicts, but anything it adds that is not traceable to the recovered text is out of
  scope.

  Two limits travel with the result into Phase 8, because they change what it is worth:
  the severities are the sub-agents' own, assigned without seeing each other's work, so
  cross-dimension deduplication is weaker than in a run that merged normally; and coverage
  is whatever survived — a merge over five of six dimensions is not a complete review and
  is not summarised as one. The second call's cost is added to the run total.

  Credit where due: this came from the agent whose handoff prompted the 1.28.1 fixes. My
  original objection — that resumable consolidation needs writing sub-agents, which two
  adapters forbid — was aimed at the wrong thing. Persistence was never the gap: the
  extractor had already recovered everything from the stream without a single write. Only
  the merge was lost, and merging needs no more than the prose already on disk.

## [1.28.1] - 2026-09-01

Two real runs failed on 2026-08-31: a codex review that hit its usage quota after 25
minutes, and an opencode review that timed out just short of consolidation. The review
still happened, through the salvage path, but the way there exposed six defects.

### 🐛 Fixed

- `ak-review:execute` — **A cut-short run could hand its narration on as a finished
  report.** The extractors checked only whether output was *empty*. A model's running
  commentary ("I'll review this as a report-only audit…") is emitted as the same event
  type as the report itself, so a quota abort left 1441 bytes of narration passing as a
  review: exit 0, no error, no cost. Phase 5 would have verified narration against the
  code and Phase 8 called it a free success. The extractors now require the `findings[]`
  block that delegate §8 mandates, and exit **`3`** when it is missing. Deliberately a
  signal rather than a rejection — the prose is still printed, because discarding it
  would only invert the error: a model formatting the block differently would turn an
  expensive, useful run into a reported failure. Confidently wrong is dangerous;
  incomplete and labelled is merely expensive.

- `ak-review:execute` — **No adapter read the error events in its own stream.** Codex
  announced the quota exhaustion plainly, in a `turn.failed` event carrying the reason,
  and the adapter passed its bare exit 1 through — so the caller learned that something
  broke but never what. All three adapters now inspect their stream and exit **`126`**,
  reserved for "the tool refused", printing the tool's own words. Distinct from `125` on
  purpose: a stall is transient and worth retrying, a spent quota is not. The adapter's
  own markers still outrank it, since `124`/`125` record what it *did*, while an error
  event only reports what the tool *said*.

- `ak-review:execute` — **Salvage was keyed on exit `124` instead of on whether anything
  survived.** Harmless for codex, which has no sub-agents, but wrong in general: a quota
  refusal or a crash leaves as many finished sub-agents behind as a timeout does, and
  those were silently discarded. Salvage now runs whenever the adapter has a
  `-extract-subagents.sh` and the raw file is non-empty — with `125` as the one
  exception, where the file is empty by definition.

- `ak-review:execute` — **The opencode permission warning could not be weighed.** It said
  only that "one or more" requests were denied. A rejected `/tmp` scratch path is
  harmless; a rejected source directory means the review never read the code it
  describes. The warning now names the count and the rejected paths.

### 📝 Documented

- `ak-review:execute` — **Phase 2 now measures the scope and says when it is large.** 112
  files across 67 commits with six dimensions does not fit a fixed ceiling: that run
  spent 25 minutes of quota and a 30-minute timeout without reaching consolidation, and
  nothing flagged the size beforehand. The skill now reports files, commits and prompt
  size, names the applicable ceiling, and offers to split the work before starting rather
  than after failing. It deliberately does **not** rescale the timeout on its own — a
  limit that moves by itself is worse than one chosen knowingly.

- `ak-review:execute` — **The raw output does not survive a reboot, which the skill had
  promised it would.** `SKILL.md` offered it for re-running `/ak-review:advise` without
  repeating the paid call, but it lives in `/tmp`, which macOS clears at boot. Found the
  hard way: the evidence for both failed runs was gone before it could be examined.

### ✅ Tests

- Two new suites: one pinning the report-completeness signal across all three extractors,
  including that exit `3` still emits what it found; one pinning refusal detection per
  adapter and that `124` outranks it. Four existing tests were updated rather than worked
  around — they encoded the old behaviour, and a truncated stream is by definition an
  unfinished report.

### ⚠️ Considered and rejected

- **A quota preflight would not have helped.** The run was 25 minutes in when the limit
  hit; at launch the quota was there, so a probe would have reported green and the abort
  would have happened anyway. `codex` also exposes no quota command. Reading the stream
  solves this; a preflight cannot.
- **Sub-agents writing findings to disk incrementally** would make consolidation
  resumable, but needs write access — which codex (`--sandbox read-only`) and claude
  (allowlist) refuse structurally. That contract is worth more than resumability, and the
  salvage path already recovered 60 KB across five of six dimensions.

## [1.28.0] - 2026-08-27

### ✨ Added

- `ak-review:execute` — **per-model runtime settings via `model_overrides`.** A model that reliably
  runs longer than the adapter's 20-minute ceiling previously left only bad options: raise
  `AK_REVIEW_TIMEOUT_SECS` globally, which makes every faster model's hang that much more expensive to
  detect, or remember an env prefix at the prompt — and the run it is forgotten on is the one killed
  just short of finishing. Measured 2026-08-27: `opencode-go/glm-5.3-flash` completed a real review in
  898 s against a 900 s ceiling.

  `resolve-config.sh` now reads a `timeout_secs` key and a `model_overrides` map keyed by model id,
  merging the matching entry over the file layers before CLI flags. An entry may set `effort`,
  `fix_threshold` and `timeout_secs`; `tool` and `model` are rejected with an error rather than
  ignored, because the map is keyed on the model that has already been resolved and an entry able to
  change it would mean the applied entry is not the one the resolved model points at. A `null` value
  unsets an inherited setting instead of replacing it — without that, a per-model entry cannot be
  safe across tools, since effort vocabularies belong to the adapter and a `codex` `xhigh` inherited
  by an `opencode` run becomes a `--variant` that tool never defined. Also adds a `--timeout-secs`
  flag for one-off runs, validated here rather than in the adapter so the message names the flag the
  user typed instead of the env var it becomes.

  The adapter is unchanged and still owns enforcement — the resolved value only tells it which number
  to enforce, so the timer still cannot be lost by a harness that backgrounds the call. When nothing
  resolves a value, the variable stays unset and the adapter's own default applies, keeping that
  number in exactly one place. Five test cases cover the override applying, not applying to a
  different model, losing to an explicit flag, the flag's validation, the rejected key, and `null`
  unsetting an inherited value.

- `ak-review:setup` — writing the config now **preserves keys it did not ask about**. The skill asks
  four questions and writes the whole file, so `timeout_secs` and `model_overrides` would have been
  destroyed by a plain overwrite — a per-model timeout silently reverting to the adapter default is
  the kind of loss nobody connects back to having run setup.

## [1.27.0] - 2026-08-24

### 🗑️ Removed

- **`ak-typo3` plugin removed entirely** — 5 skills (`content-blocks`, `extension-kickstarter`,
  `fluid-components`, `make-content-block`, `sitepackage`), 5 agents (`typo3-architect`,
  `typo3-content-blocks-specialist`, `typo3-extension-developer`, `typo3-fluid-expert`,
  `typo3-typoscript-expert`), and its 13-file knowledge base. Marketplace goes from 10 plugins to 9;
  skill and agent counts drop from 29/13 to 24/8 across `AGENTS.md`, `README.md`, and `docs/`.

## [1.26.3] - 2026-08-23

### 🐛 Fixed

- `ak-review:execute` — **Every dollar figure in `SKILL.md` was corrupted whenever the skill was invoked
  with an argument.** `$0.26` looks like a positional parameter, so argument substitution replaced `$0`
  with the argument itself: invoking `/ak-review:execute --show` rendered the cost documentation as
  `--show.26–0.61` and `` `--show.01` ``. It hit all seven amounts — precisely the numbers that explain
  the spend cap. They are now written as `USD 0.26`, which no substitution can touch; a backslash escape
  was rejected because its behaviour here could not be verified. Found by a user's mistyped command,
  which is the only way this surfaces: the file reads correctly on disk.

### ♻️ Changed

- `ak-review:execute` — **`SKILL.md` was 499 lines, and it is loaded in full on every invocation.**
  The Adapter Reference alone was 213 of them, much of it duplicating the reasoning already recorded in
  the adapter scripts' comment headers — `opencode-adapter.sh` carries 126 comment lines of its own.
  Compressed to 371 lines by keeping what an executing agent needs at runtime (how to call it, what the
  exit codes mean, which failures are silent) and pointing at the script headers for the measurements
  and history behind each decision. Phase 3's exit-code semantics became a table. Verified afterwards
  that every warning and instruction survived, including the `auto-rejecting` search term that is the
  entry point for diagnosing a silently uninformed opencode review.

## [1.26.2] - 2026-08-23

### 📝 Documented

- `ak-review:execute` — **The runtime limits had no single place that listed them.** All five
  `AK_REVIEW_*` variables were documented, but each only inside the adapter section that uses it, so
  finding out what knobs exist meant reading all three. A table in Configuration now names every
  variable with its real default (read from the adapters, not from memory), which adapters honour it,
  and what it does — including the two facts a table cannot carry on its own: that the timeout bounds
  one *attempt* rather than the invocation, and that the budget cap is a ceiling that can be exceeded
  by up to one turn.

### ✨ Added

- `ak-review:setup` — **`--show` now reports the runtime limits actually in force.** They live in the
  environment rather than the config file, which makes them invisible to `resolve-config.sh` and easy
  to forget: an `AK_REVIEW_TIMEOUT_SECS` exported into a shell profile months ago silently governs
  every run since, and nothing surfaced it. `--show` now lists what is set, states that anything
  unlisted is at its default, and flags a variable belonging to an adapter other than the configured
  one — set, but inert.

## [1.26.1] - 2026-08-23

### ♻️ Changed

- `ak-review:execute` — **The claude adapter's spend cap is now on by default at $5**, rather than
  opt-in. It is by a wide margin the most expensive adapter (measured: $0.26–0.61 for a single trivial
  prompt) and the only one whose tool can stop itself on cost rather than on time — so an unattended
  review that quietly runs up an open-ended bill is a worse failure than one that stops and says why.
  Override with `AK_REVIEW_MAX_BUDGET_USD`; remove the cap with `AK_REVIEW_MAX_BUDGET_USD=none`, which
  is deliberately not `0` — that would read as "zero dollars" and abort instantly, the opposite of what
  anyone typing it means.

### 🐛 Fixed

- `ak-review:execute` — **Hitting the cap looked like a review that found nothing.** Claude Code ends
  such a run with `terminal_reason: budget_exhausted` and `result: null` — no report at all — so the
  extractor could only report that none was found, never that the cap was the reason. The adapter now
  detects it and says so, naming the *actual* spend, how to lift it, and that sub-agents finishing
  before the cap are still recoverable from the stream.

### 📝 Documented

- `ak-review:execute` — **The spend cap is a ceiling, not a guarantee, and now says so.** Claude Code
  checks spend *between* turns rather than before committing to one, so a run stops once it has already
  gone over. The overshoot is bounded by a single turn, not open-ended: measured, a `$0.01` cap ended a
  run at `$0.28` — after `turns=1`, so one turn, not a runaway. A cap therefore bounds spend to roughly
  *itself plus one turn*, which is worth knowing before setting one at the exact figure you cannot
  exceed. A cap below the price of one turn cannot bind at all, and the adapter now flags that rather
  than letting it look like protection. For a genuinely hard limit, the Anthropic Console's spend
  controls are the only thing outside both this plugin and the tool.

## [1.26.0] - 2026-08-23

### ✨ Added

- `ak-review:execute` — **A `claude` adapter, for running reviews through Claude Code headless.** It is
  the only adapter that combines both qualities the other two split between them: sub-agents per review
  dimension (which `codex` lacks) *and* monetary cost reporting straight from the tool (which `codex`
  also lacks), without `opencode`'s startup stall. On SWE-Atlas-QnA — the public benchmark closest to
  reviewing, since it measures multi-file code comprehension rather than patch-writing — Opus 5 scores
  63.2 against GPT-5.6-Sol's 46.0, a gap outside the confidence intervals. Verified against Claude Code
  `2.1.240`, including a live end-to-end run.

- `ak-review:execute` — **Read-only is enforced by an allowlist here, and the reason is a measurement,
  not a preference.** A probe run with `--permission-mode plan` alone *successfully created a file*:
  plan mode governs how Claude Code works, not what it may touch. The adapter therefore grants an
  explicit allowlist — `Read`, `Glob`, `Grep`, `Task`, `WebFetch` and four read-only `git` invocations —
  and denies `Write`/`Edit`/`NotebookEdit`. `Bash` is never granted wholesale, because an unrestricted
  shell is a write path no deny-list can close: `touch`, `>`, `sed -i` and the rest cannot be
  enumerated. With the allowlist in place the agent reports it has no permitted way to create a file,
  while `git log` and file reads work normally. `--permission-mode dontAsk` completes it: unattended,
  nothing may sit waiting for a prompt nobody will answer.

- `ak-review:execute` — **`AK_REVIEW_MAX_BUDGET_USD` caps a run's spend in dollars.** Claude Code is by
  a wide margin the most expensive adapter — measured at roughly **$0.26–0.61 for a single trivial
  prompt**, against about $0.002 for the same shape of work through `opencode`, because it loads
  substantial context before doing anything. It is also the only one of the three whose tool can stop
  itself on cost rather than on time, so the ceiling is offered where it actually exists.

- `ak-review:execute` — **The adapter warns when Claude Code was denied a tool call.** Denials are
  recorded in `permission_denials` and the run continues, so a review that could not read what it
  needed still exits 0 with a confident-looking report — the same silent failure `opencode`'s
  auto-rejection produces, and it gets the same explicit warning.

### 📝 Documented

- `ak-review:execute` — Every place that enumerated the adapters or assumed there were two of them:
  the ceiling paragraph ("Both `opencode` and `codex`"), the salvage comparison ("the two implemented
  adapters sit at opposite extremes"), the model-format sentences in `setup` and the docs page, and
  the adapter list in `resolve-config.sh`'s no-config message — which is the first thing a new user
  ever sees.

## [1.25.0] - 2026-08-23

### ✨ Added

- `ak-review:setup` — **`--show`: see what is configured and what is on offer, without changing
  anything.** Until now the only way to find out which models a tool exposes was to start a setup that
  always ends in a write — the wrong instrument for a look, so people read the JSON by hand instead
  and lost the precedence rules in the process. `--show` reports the resolved configuration *and which
  layer each value came from*, the installed adapters (discovered from the filesystem, never a list
  kept in prose), and the available models for every adapter that can list them. It writes nothing,
  asks nothing, and closes with the two commands that turn a listed value into a one-off run or a
  permanent default.

- `ak-review:setup` — **Every value can now be passed as a flag**, so switching models is one line:
  `/ak-review:setup --global --tool codex --model gpt-5.6-sol --effort xhigh`. Anything not passed is
  still asked, which keeps the interactive walk exactly as it was for anyone who wants it — the flags
  are shortcuts, not a second mode. A flag means the choice is already made, so the question is noise;
  it does **not** mean the safety nets go. A `--tool` that names no installed adapter is rejected
  rather than written and left to fail later inside `/ak-review:execute`, the previous file contents
  are still shown before and after a flag-driven overwrite so the change stays reversible, and the
  write is still verified to resolve. Speed is worth removing questions for, not proof.

### ♻️ Changed

- `ak-review:setup` — The skill described itself as **"Always interactive"**, which `--show` and the
  value flags made false in the same commit that introduced them. Rewritten to "interactive by
  default", along with the two other sentences that assumed a write always happens: the note claiming
  it "writes exactly one file", and the closing tip that hand-editing the JSON is faster than
  re-running the skill — which stopped being true the moment a one-line invocation existed.

## [1.24.3] - 2026-08-22

### 🐛 Fixed

All six items below came from an external review of `1.24.2`, run through `/ak-review:execute`'s own
codex adapter and verified against the code before being applied.

- `ak-review:execute` — **`SKILL.md` still told the calling agent that a startup stall is "not
  something to retry automatically", which `1.24.2` had just made false.** The adapter had gained a
  retry loop while the instruction describing the old behaviour stayed put — precisely the defect
  `AGENTS.md` warns about. Phase 3 now explains that a transient failure is retried *inside* the
  adapter, so a surfaced `125` already means every attempt stalled and retrying again would repeat a
  failed strategy.

- `ak-review:execute` — **A `125` from opencode itself was reported as the adapter's own "never
  started" signal.** `125` is reserved for the marker-confirmed startup stall; passing the tool's use
  of it straight through told the caller "every attempt stalled, nothing to salvage" about an ordinary
  tool failure. It is now remapped to `1` with an explicit note, and the tool's stderr still carries
  the real reason.

- `ak-review:execute` — **A run killed at the startup probe could lose output it had just produced.**
  The probe checks for an empty file and then signals the process; a tool that flushes while being
  signalled lands in that gap, and the next attempt's `>` truncated it. Worse, the run could end as
  `125` with a *non-empty* file, contradicting exactly what that code promises. Retry now requires the
  marker **and** a still-empty stream, and a killed run that did produce output is reported as `124`
  so the partial stream is salvaged.

- `ak-review:execute` — **A non-numeric `AK_REVIEW_*` value aborted mid-run with no diagnostic.** It
  reached `sleep`, failed under `set -e`, and killed the adapter before any of its error reporting
  ran. All four variables are now validated up front, naming the offending one.

- `ak-review:execute` — **A startup grace at or above the ceiling let the two watchdogs race**, so a
  genuine timeout could be recorded as a startup stall and retried. The adapter now rejects that
  configuration outright, since the startup probe is only meaningful if it fires first.

- `ak-review:execute` — **`AK_REVIEW_TIMEOUT_SECS` no longer bounds the whole invocation** once
  retries are enabled, which was true since `1.24.2` but undocumented. Each attempt gets a fresh
  ceiling and the retry waits sit outside it, so the worst case is
  `retries × (startup_grace + retry_wait) + timeout` — roughly 25 minutes at the defaults. Documented,
  with `AK_REVIEW_STARTUP_RETRIES=0` as the way to make the ceiling absolute again.

### ✅ Tests

- `ak-review:execute` — Four cases covering the above: a tool-originated `125`, a deterministic
  failure that must not be retried (stated in `1.24.2`'s commit message but never pinned), output
  flushed from a `SIGTERM` trap, and a rejected non-numeric env value. Existing timeout cases now set
  a startup grace explicitly, since they had relied on a combination the adapter now refuses.

## [1.24.2] - 2026-08-22

### ✨ Added

- `ak-review:execute` — **The opencode adapter now retries a startup stall instead of only reporting
  it.** `1.24.1` made that failure legible; this makes it survivable. The stall is transient — it
  appears in windows of minutes and then clears — so a retry is the one response that actually
  recovers the run. Two further attempts by default (`AK_REVIEW_STARTUP_RETRIES`, `0` disables), 60s
  apart (`AK_REVIEW_RETRY_WAIT_SECS`), which rides out a short window without the caller noticing.
  **Only exit `125` is retried.** A `124` already holds the partial stream that makes it salvageable
  and a retry would overwrite it; any other non-zero exit (bad model, missing credentials) is
  deterministic and would fail identically after the wait. Exit `125` now means every attempt stalled,
  and the message says how many were made.

### 📝 Documented

- `ak-review:execute` — **The codex adapter requires a git repository as its working directory**, which
  was true from the start but written down nowhere. Codex refuses to run outside one ("Not inside a
  trusted directory and `--skip-git-repo-check` was not specified") and the adapter deliberately does
  not pass that flag: reviewing an untracked directory is nearly always a wrong `cwd`, and failing in
  a fraction of a second with a clear message beats reviewing the wrong thing. Only affects
  `--path`/`--all` runs aimed outside a repository; any git-diff-based scope implies one already.

## [1.24.1] - 2026-08-22

### 🐛 Fixed

- `ak-review:execute` — **The opencode adapter could fail with zero bytes, no error, and a message
  that sent the reader after output which could not exist.** `opencode run` intermittently produces
  nothing at all and never returns; the adapter reported that as its ordinary 20-minute timeout, so
  every layer above it said "timed out — run the salvage path" against an empty file. It now caps
  *startup* separately (90s, `AK_REVIEW_STARTUP_GRACE_SECS`) and exits **`125`** instead of `124` when
  no bytes have arrived, stating plainly that the run never reached the model and there is nothing to
  salvage. A run that produces output and *then* hangs is unchanged: still `124`, still salvageable.

- `ak-review:execute` — **The adapter discarded the only diagnostic that exists for that failure.** On
  a stall, opencode's stderr is empty, which reads as "nothing went wrong" when in fact nothing
  happened. The adapter now passes `--print-logs --log-level DEBUG`; the output lands in
  `<raw-output-file>.stderr` and the JSON stream stays untouched (verified on a live run: every stdout
  line still parsed, 26 log lines went to the sidecar).

### 📝 Documented

- `ak-review:execute` — **Where the opencode stall actually happens**, which was previously unknown and
  is now pinned by measurement. The evidence is opencode's *own* log
  (`~/.local/share/opencode/log/opencode.log`), not the event stream: a healthy run logs `init` then
  immediately `created id=ses_…`; a stalled one logs `init` and stops forever. It therefore dies inside
  **session creation**, before the model is ever called — and `opencode serve` started during a stall
  failed with `database is locked`, pointing the same way. The root cause is upstream in opencode
  (seen on `1.18.21`) and is *not* fixed here. Ruled out by measurement, each with a paired control:
  the database, config and plugins, stale processes, run cadence, and a concurrent instance holding
  the DB. The Adapter Reference also records the methodological trap — the failure comes in windows of
  minutes during which everything stalls, so an unpaired comparison produces a confident wrong answer.

## [1.24.0] - 2026-08-22

### ✨ Added

- `ak-review:execute` — **A `codex` adapter, so the skill is no longer a one-tool abstraction.** The
  adapter convention existed from the start but had only ever been exercised by `opencode`, which meant
  a handful of `opencode`-shaped assumptions had quietly hardened into the contract. Codex differs in
  every one of them: a bare model name instead of `provider/model`, reasoning effort as
  `-c model_reasoning_effort=…` instead of a flag (`--reasoning-effort` was removed in codex v0.50),
  and a completely different event schema. Verified against `codex-cli 0.149.0`, including a live
  end-to-end run.

- `ak-review:execute` — **The codex adapter runs with `--sandbox read-only`.** `delegate`'s contract has
  always been that the external agent only reports and never edits, but with `opencode` that was an
  instruction the prompt gave and the permission config had to be trusted to honour. Codex can enforce
  it structurally: the agent cannot write to the repository even if something told it to. The adapter
  also passes `--ignore-user-config`, because a real `~/.codex/config.toml` drags MCP servers, hooks and
  plugins into the run — measured on one, that meant failing auth handshakes and the review's own
  context being crowded out by *"skill descriptions were shortened to fit the skills context budget"*.

- `ak-review:execute` — **`codex-preflight.sh` checks authentication, which `opencode-preflight.sh`
  deliberately does not.** That is not an inconsistency. opencode's auth check was removed in 1.17.1
  because the only available signal was human-readable TUI output, and parsing it hard-blocked correctly
  authenticated users; the rule that came out of it was "no auth check without a machine-readable
  signal". `codex login status` supplies exactly that — exit `0` authenticated, exit `1` not — so the
  verdict comes from an exit code and never from parsed text.

### ♻️ Changed

- `ak-review:execute` — **The output extractors are now part of the adapter, and named for it.**
  `extract-report.sh`, `extract-cost.sh` and `extract-subagents.sh` read `opencode`'s event schema and
  nothing else, but their generic names and unqualified call sites in `SKILL.md` presented them as
  shared infrastructure. Pointing one tool's extractor at another tool's stream does not error — it
  returns an empty report, which is indistinguishable from a clean review. They are now
  `opencode-extract-*.sh`, joined by `codex-extract-*.sh`, and the adapter contract table lists them
  alongside the adapter and preflight scripts.

- `ak-review:execute` — **Cost reporting no longer assumes the tool reports cost.** Codex emits token
  counts and no monetary figure at all, so `codex-extract-cost.sh` returns `"total_cost": null` and
  Phase 8 now says the tool reports no cost instead of printing `$0.00`. Zero and "not reported" are
  different claims and only one of them is true.

- `ak-review:setup` — **The model and effort prompts no longer describe only `opencode`'s formats.**
  Phase 4 presented `provider/model` as *the* shape a model identifier has, and Phase 6 named
  `--variant` as *the* effort mechanism. Both are per-adapter: codex takes a bare model name and one of
  `none|minimal|low|medium|high|xhigh|max`. Codex has no non-interactive model listing, so it uses the
  existing typed-entry fallback rather than shipping a `codex-models.sh` that could not work.

### 🐛 Fixed

- `ak-review:execute` — **The adapter watchdog leaked a `sleep` process on every single run, and could
  wedge a piped caller for 20 minutes.** Tearing the watchdog down killed the subshell but not the
  `sleep` it was blocked in, which survived as an orphan still holding whatever stdout it inherited. A
  caller reading the adapter's output through a pipe therefore never saw EOF and hung until the orphan
  timed out. Found while building the codex adapter from this code, where it turned the new test suite
  from failing into hanging. The watchdog now runs in its own process group and is killed by group, with
  its descriptors pointed at `/dev/null` so no watchdog process holds the caller's stdout at all. Fixed
  in both `opencode-adapter.sh` and `codex-adapter.sh`.

## [1.23.1] - 2026-08-20

### 🐛 Fixed

- `ak-review` — The plugin's markdown-format hook pinned `MD049` (italic emphasis) to `asterisk`,
  fighting any project that runs Prettier on Markdown: Prettier emits `_italic_`, so the two tools
  rewrote each other's output on every pass whenever a file's existing style happened to start with
  an asterisk. `MD049` now pins to `underscore`, matching Prettier's default, so the hook's `--fix`
  and Prettier agree on direction instead of taking turns overwriting one another. Projects that
  don't use Prettier for Markdown are unaffected in intent but will see existing `*italic*` text
  rewritten to `_italic_` on the next hook run. Documented alongside the existing `"fix": false` and
  `.prettierignore` alternatives in [validation-hooks.md](docs/hooks/ak-review/validation-hooks.md),
  now with calibrating the rules to Prettier's output as the primary recommendation.

## [1.23.0] - 2026-08-19

### ♻️ Changed

- `ak-meta:handoff` — **The skill only ever fit one moment: being stuck.** It looked for "the current
  unresolved problem", explicitly discarded anything already resolved, and had nothing to say about a
  session that simply ended. That covers the rarest case and misses the ordinary one — a session that
  reached its goal, or stopped half-way, and whose successor needs to know what was settled just as much
  as what is open. The skill now captures a *session*, not a problem, and detects which of three states
  it is in: `Blocked` (a problem that resisted several attempts), `In Progress` (moving but unfinished),
  or `Complete` (goal reached). The state shifts the document's emphasis; `--blocked`, `--wip` and
  `--done` override the detection when it guesses wrong. Resolved work is now recorded rather than
  dropped.

- `ak-meta:handoff` — **The handoff had no way to say what should happen next.** It described where the
  work stopped and left the successor to infer the rest, which is exactly the part a human already knows
  and the next agent cannot guess. `$ARGUMENTS` is now the mission for the next session, passed through
  verbatim — `/ak-meta:handoff continue with ABC-123` puts that instruction at the top of the document,
  ahead of any next step the skill would have derived on its own.

### ✨ Added

- `ak-meta:handoff` — **Three sections that answer what a fresh session actually asks first.** *Current
  State* records the Git side — branch, uncommitted changes, commits made this session — which is the
  most common blind spot on a session switch: what sits on disk versus what is committed. *Files
  Touched* names each file with one sentence on why. *Decisions & Assumptions* separates a deliberate
  choice from an unverified premise, so the next agent neither re-litigates a settled question nor
  trusts something that was never checked.

- `ak-meta:handoff` — **A fixed home for the document.** Handoffs are written to
  `docs/handoffs/YYYY-MM-DD-<slug>.md`, mirroring `ak-meta:discover`'s `docs/discover/`, and a name
  collision appends `-2` rather than overwriting. The safety rule is restated to match: code and Git are
  read only, and the handoff document is the single file the skill writes — the old wording ("NEVER
  modify code") would have read as forbidding the write it now performs.

## [1.22.3] - 2026-08-19

### 🐛 Fixed

- `ak-review:execute` — **The 20-minute ceiling on an external review run was never enforced anywhere it
  could hold.** It existed only as an instruction to the calling agent in the skill, which is exactly the
  guarantee that breaks in an unattended run: a harness may background the call and take the timer with it.
  A hung `opencode` then ran for 83 minutes before a human asked about it. The ceiling now lives in the
  `opencode` adapter itself, which kills the run at 20 minutes (override with `AK_REVIEW_TIMEOUT_SECS`) and
  exits `124`, GNU `timeout`'s convention, so a caller can branch on the code instead of parsing text. The
  adapter contract records this as an adapter's job rather than a caller's.

- `ak-review:execute` — **A timeout killed one process and left the rest running.** `opencode` is several
  processes, not one; signalling only the direct child left survivors that had to be cleared by hand with
  `pkill`. The adapter now runs the tool in its own process group and signals the whole tree. A killed run
  is still not a lost run — the JSON stream is written as the run goes, so the existing salvage path
  recovers every finished sub-agent's findings from what is already on disk. The second stalled run held
  31832 characters of sub-agent findings behind a 416-character report, which is why a short report must
  never be read as "nothing was found".

## [1.22.2] - 2026-08-19

### 🐛 Fixed

- `ak-review` markdown-format hook — **The config detection listed two file names that
  `markdownlint-cli2` does not read.** `.markdownlint-cli2.json` and `.markdownlint-cli2.yml` have no
  such form (only `.jsonc`, `.yaml`, `.cjs`, `.mjs` do), yet the hook accepted both as a project
  config and therefore dropped the plugin config. The linter then ignored the file too, so a project
  using either name silently lost both rule sets and fell back to bare markdownlint defaults. The
  same list was missing `.markdownlint.cjs` and `.markdownlint.mjs`, which are valid. Both halves are
  corrected and the list now carries a note to keep it in sync with what the tool actually reads.

### ✨ Added

- `ak-review` docs — **How to override the Markdown rules per project.** The hook has always deferred
  to a project's own markdownlint config, but nothing said so. The hook documentation now covers the
  resolution order, the valid config file names, and the fact that a project config *replaces* the
  plugin config rather than merging with it — including why `extends` cannot be used to inherit the
  AgentKit defaults.

- `ak-review` docs — **Running Prettier alongside the hook.** Projects that format Markdown with
  Prettier could end up in a rewrite loop with the hook. The cause is a single rule: the plugin
  config pins `MD049` to `asterisk` while Prettier emits `_italic_`; markdownlint's own defaults are
  Prettier-compatible. The documentation now shows both resolutions — `"fix": false` to make the hook
  report-only, or `*.md` in `.prettierignore` to keep the hook as the formatter — and names `fix` as
  the switch that decides which tool writes.

## [1.22.1] - 2026-08-16

### 🐛 Fixed

All three findings come from the first real run of `--audit` against a project whose hand-written
dependency skill predates the generator.

- `ak-review:deps` — **The audit could only see changes, never standing gaps.** Every check compared
  the project against what the skill already recorded, so a package that was *never* pinned looked
  identical on every run and stayed invisible. The real run showed this exactly: Biome and Playwright
  were pinned exactly in both installs while TypeScript carried a caret in both — a compiler, whose
  version decides the result rather than merely what installs, and precisely what the methodology
  says to pin. Detection now asks the question outright by crossing the result-determining tools
  against the exact-pin list, and the audit table carries it as a standing check rather than a
  change check. It is reported as a project finding; the skill never pins anything as a side effect
  of writing a document.

- `ak-review:deps` — **Nothing stopped the generator from writing claims that expire.** The audited
  skill named a ticket as "the current one" for major bumps; that ticket had since closed, and the
  document had no way to notice. The audit now checks the status of any ticket, issue or milestone a
  skill calls current, and — the deeper half — the generator is told not to write such a claim in the
  first place, because the next ticket makes any number stale again. State the rule; cite closed
  tickets only where they are introduced as past examples.

- `ak-review:deps` — **The language rule was left unstated**, the same gap `setup` closed in 1.21.0.
  `deps` both interviews a person and writes a file, so it needed the rule more than either skill
  that already had it: the interview and the audit report follow the invoking session's language,
  while the generated file follows the target project's own instruction files and defaults to
  English. A generated skill outlives the session that produced it.

## [1.22.0] - 2026-08-16

### ✨ Added

- `ak-review:deps` — New skill that **generates a project-specific dependency update skill** at
  `.claude/skills/dependency-update/SKILL.md`, mirroring the generator/executor split that
  `workflow` and `finalize` already use. It never updates a dependency itself; it produces the
  procedure that does.

  The reason it generates rather than generalizes: a generic dependency skill can say "take a
  baseline", but not *which* baseline — and that is where the safety lives. A dependency bump can
  pass every behavioural test and still be wrong, because tests assert behaviour and a CSS
  framework bump that moves a border leaves a full E2E suite green. Only a project that knows it
  has a pixel comparison can be told to run it.

  Detection covers four axes the existing tooling scan did not: **install boundaries** (manifests
  with their own lockfiles are separate projects), **the baseline** including a deliberate hunt for
  a *second* kind of baseline (visual regression, bundle-size budget, benchmark, structural
  snapshot, Lighthouse budget) together with what each one fails to cover, **exact pins** versus
  ranges, and **couplings** — the same version string duplicated across manifests, CI config,
  Dockerfiles and documentation.

  What detection cannot find, it asks: at most six questions, and only those whose trigger actually
  fired. Where the user does not know an answer, it is written into the generated skill as an open
  question with the command to settle it — never as an invented rule.

  `--audit` re-runs detection against an existing skill and separates **project drift** (a coupling
  the skill guards has actually come apart — a real bug) from **skill drift** (the document is
  stale). Only the second is edited automatically.

  Verified against a real project whose hand-written equivalent was the model for this skill: the
  detection reconstructs both separate installs, the visual baseline via the `*-snapshots/` signal,
  and all five locations of the pinned package-manager version — including a CI header comment and
  an AGENTS.md prose line, the two that a manifest-only analysis would miss.

- `ak-review` knowledge — Two new reference files. `dependency-update-methodology.md` holds the
  transferable rules (baseline as numbers not pass/fail, three-tier classification, verify-instead-
  of-assume commands per ecosystem, one logical step per commit, pin what determines the result,
  and the fold-back loop that lets a generated skill accumulate project findings).
  `project-tooling-detection.md` holds the manifest, config-file and lockfile signals.

### ♻️ Changed

- `ak-review:workflow` — Step 3's manifest and config-file detection tables moved into the new
  shared `project-tooling-detection.md` rather than being duplicated into `deps`. Both skills now
  detect identically and the tables have one place to be maintained. No behavioural change to
  generated workflows.

### 📝 Docs

- The root `README.md` header claimed 24 skills and its `ak-review` knowledge table listed only the
  two original files. Both corrected alongside the new skill — 29 skills, four knowledge files.

## [1.21.1] - 2026-08-16

### 📝 Documentation

- `AGENTS.md` — New convention: when you add a case to something, hunt down every sentence that still
  describes only the old one. Derived from this repo's own history rather than from principle: the
  pattern occurred five times while building the `setup` skill for 1.21.0 — a stale claim left in a
  contract table, in a doc page, in an adjacent paragraph, in a phase that consumed the changed
  output — every one caught by a review and none by the author, and the fifth created by the fix for
  the fourth. Adding the branch is the easy half.

## [1.21.0] - 2026-08-16

### ✨ Added

- `ak-review:setup` — New skill that configures `ak-review:execute` interactively. No configuration
  ships with the plugin, deliberately, so the first run always fails with a guidance message; this
  turns that dead end into a guided setup. It asks where the config should live (global, the file you
  copy to another machine, or project-local), which model to use — picked from the list the tool
  itself reports, never one this plugin suggests — and how aggressive auto-fixing should be. Then it
  writes the file, reads it back from disk, and proves it resolves, because a config written without
  proof is how a typo ships. It is a separate skill rather than a flag on `execute`, following the
  `workflow`/`finalize` precedent in this plugin: the generator is not the consumer.

  **`setup` is always interactive; `execute` still never is.** A missing config in `execute` fails
  fast rather than prompting — a prompt would hang a cron or remote run forever. Interactivity is
  opted into by invoking `setup`, never inferred from the session.

- **Adapter preflight**, wired into `execute`'s Phase 1, so a missing tool is caught before the prompt
  is built and any repository is read. It checks whether the tool is on PATH and **deliberately does
  not check authentication** — that check existed and was removed after three attempts. `opencode auth
  list` exits 0 in both states, so only its ANSI-decorated output distinguishes them, and three
  successive escape-stripping patterns were each defeated by a different escape class, every time by
  wrongly hard-blocking a *correctly authenticated* user. Deriving a gate from human-readable TUI
  output is unbounded. An unauthenticated tool fails instantly and for free and says so itself, so the
  check bought a nicer message at the cost of the worst failure mode there is.

- **A three-script adapter convention** — `<tool>-adapter.sh`, `<tool>-preflight.sh`, `<tool>-models.sh`
  — documented in `execute`'s Adapter Reference. The filesystem is the registry: adding a tool needs no
  list updated anywhere. Preflight and models are optional, and the skills handle their absence.

- `extract-subagents.sh` — recovers findings from a run that hung. The external tool dispatches one
  sub-agent per review dimension and merges them only at the end, so a stalled run still holds
  everything the finished sub-agents produced — in `tool_use` parts the report extractor cannot see.
  Measured on a real stalled run of this very branch: the report extractor recovered 91 characters of
  narration while 4085 characters of findings sat unread. `execute`'s Phase 3 now has an explicit
  timeout branch that salvages instead of falling through.

### 🐛 Fixed

- `docs/README.md` had drifted since 1.18.0 — 9 plugins (10), 21 skills (28), 10 agents (13),
  `ak-meta` at 3 skills (4), and `ak-js` missing from the table entirely. Every number re-counted from
  the filesystem rather than copied from another document.

## [1.20.1] - 2026-08-16

### 🐛 Fixed

- `ak-review:execute` — The "no tool or model configured" message is now enough to act on. No
  config ships with the plugin, deliberately, so this message is what every new user meets first,
  and it previously said only which keys were missing. It now names both config paths and which
  one wins, shows a copy-pasteable skeleton, lists the adapters that exist (`opencode`) and says how
  to find models for one (`opencode models`) — but still names **no** model, because printing one
  would be the default this design exists to avoid.

## [1.20.0] - 2026-08-16

### ✨ Added

- `ak-review:execute` — New skill running the full **delegate → external agent → advise → fix**
  loop unattended, closing the manual hand-off that `delegate` and `advise` deliberately left open.
  It builds the review prompt with `delegate`'s logic, runs it against an external coding-agent CLI,
  verifies every finding against the real code with `advise`'s logic, auto-fixes the confirmed
  high-value ones using `coderabbit`'s Apply/Adapt/Skip framework, validates with the project's own
  tests, and reports one compact summary. `--report-only` reduces it to report-and-verify.

  **The external tool and model are never hardcoded.** They resolve from CLI flags, then a project
  `.claude/ak-review.local.json`, then a global `~/.claude/ak-review.local.json` — and the skill stops
  with guidance when unresolved rather than defaulting. Installing or updating this plugin therefore
  never forces a specific tool or model on anyone. `fix_threshold` defaults to `high` (matching
  `coderabbit`); `effort` has no default at all, being adapter-specific.

  Ships one adapter, `opencode`, as four small guarded shell scripts under `skills/execute/scripts/`.
  Two of its properties come from failures observed while building it, not from theory:
  `opencode run` **auto-rejects** permission-gated paths instead of prompting, reports it only on
  stderr, and still exits 0 — so a review that never read the repository would have produced a
  confident, uninformed report. The adapter now captures stderr beside the JSON stream and warns on
  `auto-rejecting`. And a run can hang after its sub-agents finish, so the report and cost extractors
  tolerate a truncated stream rather than dying on it, making the documented salvage path real.
  `--auto` is never passed: it would approve the destructive commands a user's own OpenCode config
  deliberately gates.

## [1.19.1] - 2026-08-13

### 🐛 Fixed

- `ak-review` markdown-format hook — `plugins/ak-review/hooks/config/.markdownlint-cli2.jsonc`
  had a top-level `"globs": ["**/*.md"]` field, which markdownlint-cli2 merges with (rather
  than overrides for) the single file path the hook passes on the command line. Every
  Write/Edit/MultiEdit on one Markdown file therefore triggered a `--fix` pass across every
  `.md` file in the repo, silently reformatting unrelated files (observed repeatedly reflipping
  `_underscore_` emphasis to `*asterisk*` in unrelated CHANGELOG.md sections while editing
  AGENTS.md). Removed the `globs` field so the hook's own file-path argument is authoritative;
  `ignores` alone does not reintroduce repo-wide scanning.

## [1.19.0] - 2026-08-13

### ✨ Added

- `ak-review:workflow` — Generate and Audit modes now produce a "pointer form" Task
  Completion Workflow: the full step list is written to
  `.claude/skills/task-completion/SKILL.md` (a lazy-loaded skill body, read only when
  invoked) instead of being inlined into AGENTS.md/CLAUDE.md, which is resent in full on
  every prompt regardless of whether the workflow is needed that turn. Audit mode still
  recognizes the old inline form, flags it as a Conciseness gap, checks drift between the
  pointer's step-name summary and the skill file, and offers to migrate it to pointer
  form. This repo's own `AGENTS.md` was migrated to pointer form as the reference example.
- `ak-review:finalize` — Resolves the pointer automatically (reading
  `.claude/skills/task-completion/SKILL.md`) before parsing and executing workflow steps,
  and now stops with an explicit error instead of silently executing zero steps when the
  pointer is broken or the section has no actionable content.
- `ak-knowledge:agents-md-improver` — The Task Completion Workflow check now accepts
  pointer form as passing and flags a still-inline workflow as a Conciseness finding,
  pointing at `/ak-review:workflow --audit` for the fix.

## [1.18.3] - 2026-08-12

### 🐛 Fixed

- `ak-review:coderabbit` — CodeRabbit CLI 0.7.0 removed the `--prompt-only`, `--type` and
  `--plain` flags (plain text is the default output now), so the skill's documented review
  command errored with `unknown option '--plain'`/`'--type'`. `--type uncommitted|committed|all`
  now maps to the CLI's own `--uncommitted`/`--committed`/no-flag scope. The same stale command
  was still referenced as the "Other tools" fallback in this repo's own `AGENTS.md`, fixed
  alongside it.

## [1.18.2] - 2026-07-16

### 🐛 Fixed

- `ak-react:react-best-practices` — The guide's dynamic-import examples used `ssr: false`
  in files without a `'use client'` directive. In "Defer Non-Critical Third-Party
  Libraries" the example marked **Correct** placed it next to a `RootLayout`, which is
  always a Server Component, so the recommended code threw at runtime
  (`ssr: false is not allowed with next/dynamic in Server Components`) while the
  **Incorrect** example above it worked — the guide advised trading working code for
  breaking code. The Correct example is now split into a `'use client'` module that the
  layout imports, keeping the layout a Server Component, and the section states outright
  that `ssr: false` throws in Server Components. The Monaco example in "Dynamic Imports
  for Heavy Components" gained the missing directive.
- `ak-js:config-doctor` — The analyzer listed a missing `autoprefixer` as a PostCSS
  finding without any version qualifier. Tailwind v4 prefixes via Lightning CSS inside
  `@tailwindcss/postcss` and needs no autoprefixer, so the check could produce wrong
  advice on v4 projects — which have no `tailwind.config.*` but do have a
  `postcss.config.*`. Both v4 markers were already in the analyzer's input, so the
  exception costs no extra scanning.
- `ak-react:react-best-practices` — Corrected the rule count: the skill claimed 65 rules
  and the guide abstract still said "40+"; both now say 66, matching the guide.

## [1.18.1] - 2026-07-08

### 🐛 Fixed

- `ak-review:explain` — Bare `/ak-review:explain` (no pasted snippet) failed with "no code
  was given" even when the user had text selected in a connected IDE (e.g. the VS Code
  extension), because the skill only checked `$ARGUMENTS` and never looked for the
  IDE-injected selection context. The skill now checks for an IDE selection first, falls
  back to typed/pasted input, and only asks the user to select or paste code when neither
  is present.

## [1.18.0] - 2026-07-03

### ✨ Added

- `ak-review:explain` — New skill that explains a code snippet to a developer: what it
  does, why it's built that way, and what's notable about it. Ported from the pt-ai
  `explain` skill. Explains the current editor selection, or whatever is passed as
  arguments (an optional introductory sentence before the snippet is ignored). Output
  follows a fixed structure — Purpose, How it works, and an optional Noteworthy section
  — capped at ~250 words, without improvement suggestions or assumptions beyond the
  visible code.

## [1.17.0] - 2026-06-06

### ✨ Added

- `ak-review:delegate` — New **Phase 2.5: Discover Requirements Context** automatically
  discovers and embeds requirements context in every generated review prompt — no flags
  needed. Three sources are checked in order:
  1. **Jira tickets** — searches branch name and commit messages for ticket IDs
     (pattern `[A-Z]{2,}-\d+`) and fetches details via Atlassian MCP (summary,
     type/status, description, acceptance criteria). Skipped if MCP is unavailable.
  2. **Spec / task Markdown files** — scans the working tree for files whose name or
     directory matches task/spec patterns (`TODO`, `TASK`, `SPEC`, `tasks/`, etc.)
     and any Markdown files modified in the current diff scope.
  3. **Fallback summary** — when neither source yields results, synthesizes a one-paragraph
     summary from commit messages so the review agent always has requirements context.

  Fetched content is always embedded directly in the generated prompt to keep it
  self-contained, regardless of whether the reviewing agent has its own Atlassian MCP
  access. The generated prompt uses composable sub-sections (Jira tickets, Specification
  documents, Summary) that are included or omitted based on what was discovered.

## [1.16.1] - 2026-06-06

### 🔄 Changed

- `ak-review:delegate` — Generated prompt now includes a dedicated **Approach** section
  (section 3) instructing the foreign agent to dispatch one sub-agent per review dimension
  (Security, Performance, Tests, …) and merge findings before producing the final report.
- `ak-review:advise` — Phase 2 now recommends dispatching one sub-agent per group of ≤8
  tightly related findings (for lists >5), replacing the previous "internal groups of ≈8"
  workaround. This avoids cross-issue context mixing and enables parallel validation.

## [1.16.0] - 2026-06-05

### ✨ Added

- `ak-knowledge:agents-md` — After creating a symlink (converted or consolidated), the skill
  now automatically inserts a notice `` > `CLAUDE.md` is a symlink pointing to this file. ``
  at the top of `AGENTS.md` (directly after the `# AGENTS.md` heading, skipped if already
  present).

### 🐛 Fixed

- `ak-review:workflow` + `AGENTS.md` — Review workflow bullet renamed from
  **"Optional delegated review"** to **"Delegated review"**: the "Optional" label caused
  agents to skip the entire bullet (including the mandatory user prompt) rather than just
  making the *execution* optional. Asking the user is now framed as a required step.
- `ak-knowledge:agents-md-improver` — Added Common Issues item 8: checks that `AGENTS.md`
  carries the symlink notice when `CLAUDE.md` is a symlink pointing to it. Removed a
  redundant prose block in Phase 1 that duplicated the same rule already expressed in
  the checklist.

## [1.15.2] - 2026-06-04

### 🐛 Fixed

- `ak-knowledge:agents-md-improver` — workflow audit is now mandatory: agents must always
  invoke `/ak-review:workflow --audit` when a workflow section exists, rather than relying
  on manual command checks that miss template drift (e.g., new optional steps, changed
  bullet structure). Both the skill and its docs were updated to enforce this.

### 🔄 Changed

- `README.md` — Semgrep MCP Server link updated to point to the GitHub source repository.

## [1.15.1] - 2026-06-04

### 🔄 Changed

- `ak-review` workflow step extended: local `/ak-review:coderabbit` review is now the explicit
  default, with an optional delegated review prompt via `/ak-review:delegate` for external
  agents (Kimi, Codex, etc.). Applied to both `AGENTS.md` and the `ak-review:workflow` skill
  template so generated workflows include this pattern automatically.

## [1.15.0] - 2026-06-04

### ✨ Added

- `ak-review:delegate` — Generates a self-contained, project-specific code-review prompt for
  any foreign coding agent (Kimi, Codex, etc.). Analyzes the current project (instructions,
  languages, test/lint commands, docs) and the requested scope, then emits a ready-to-paste
  prompt. Scope flags mirror CodeRabbit semantics (`--type all|committed|uncommitted`,
  `--base <ref>`) plus `--path`/`--all`; report-only by default, `--fix` opts into direct
  fixing, `--out <path>` writes the prompt to a file. The prompt forces a Markdown + JSON
  findings report consumable by `ak-review:advise`.
- `ak-review:advise` — Validates a foreign agent's code-review findings against the real code
  and returns a per-finding verdict (`confirmed`, `false_positive`, `needs_more_context`,
  `uncertain`) with confidence and a fix hint. Read-only: never modifies code and never
  invents new findings. Accepts findings via `--in <path>` or pasted content. Together with
  `delegate` this forms a two-agent review loop (foreign agent reviews → Claude validates →
  foreign agent fixes).

## [1.14.0] - 2026-05-17

### ✨ Added

- `ak-git:operations` — Auto-detects the commit-prefix style already used on the current
  branch and continues it consistently. If any prior commit on the branch matches
  `^\[<ticket-id>\]` (e.g., `[FOO-1] feat: ...`), new commits use bracket style
  (`[ABC-1234] type(scope): description`); otherwise plain style is used
  (`ABC-1234 type(scope): description`). Style detection uses `git merge-base` against
  `origin/HEAD`, `origin/main`, or `origin/master` — with a graceful fallback to the
  last 10 commits when no common ancestor is resolvable.

### 🔄 Changed

- `ak-git:operations` — Branch-name pattern matching now explicitly covers bare
  ticket refs with a description suffix (e.g., `FOO-123_description`) in addition to
  the existing `fix/ABC-1234` and `feature/FOO-99_description` patterns.
- `docs/skills/ak-git/operations.md` — Updated overview and best-practices to document
  the new bracket-vs-plain style auto-detection behavior.

## [1.13.4] - 2026-05-10

### 🗑️ Removed

- `ak-review` validation hooks — removed the **Skill Suggestion prompt hook** (`PostToolUse`
  on `Write|Edit|MultiEdit`) that asked Claude after every file edit whether an AgentKit
  skill would be a helpful next step. The hook interrupted mid-workflow executions, causing
  Claude to stop continuation instead of proceeding. The three command-based validation
  hooks (Markdown, JSON, ShellCheck) are unaffected.

## [1.13.3] - 2026-05-02

### 🔄 Changed

- `ak-review:workflow` — Significantly expanded optional-step detection: the skill now
  scans for a `docs/` directory (activates a Docs step) and for `CHANGELOG.md` /
  multi-file `version` field patterns (activates a Version & Changelog step with
  "release commit MUST be final" note). Template updated with `/bump-version` and
  `/ak-meta:changelog` as preferred/fallback invocations. Adaptation rules extended with
  `{typecheck_cmd}`, `{project_specific_validations}`, and step-number skip-clause
  guidance. Audit-mode checklist updated to verify optional steps and correct skill
  references (`/simplify` instead of `code-simplifier:code-simplifier`).
- `ak-review:finalize` — Removed the duplicated inline workflow template; the skill now
  delegates directly to `/ak-review:workflow` when a new workflow needs to be created,
  keeping the single source of truth in one place.
- `ak-knowledge:agents-md-improver` — Added a dogfooding-check reminder: when auditing
  a project that ships workflow templates to others (e.g., AgentKit itself), verify that
  the project's own `AGENTS.md` workflow reflects its latest published template.
- `docs/solutions/best-practices/skill-shell-absolute-paths-2026-04-07.md` — Added
  Rule 7: always run a live `zsh` test in the target shell before marking a skill as
  released, to catch shell-portability regressions that unit-style reviews miss.

## [1.13.2] - 2026-04-07

### 🐛 Fixed

- `ak-js:config-doctor` Phase 0 Step 2 — **exit-code propagation**. The workspace-type
  detection block ended with a chain of `test -f` commands (`lerna.json`, `turbo.json`,
  `nx.json`). When the last-checked file did not exist, the whole Bash tool call
  returned a non-zero exit status and was reported as a failure — even though the
  detection correctly printed the detected workspace kind. Each test is now wrapped in
  `|| true` and the block ends with a `true` terminator. Added an "exit-code
  discipline" note describing the rule for all future bash blocks.
- `ak-js:config-doctor` Phase 0 Step 3 — **shell glob / brace expansion rejected by
  zsh**. Patterns like `tsconfig.*.json` and `next.config.{js,mjs,ts}` are aborted by
  zsh (the macOS default) with `no matches found` **before** the command runs, because
  the `nomatch` option is on by default — which means `2>/dev/null` cannot suppress
  the error. Replaced all glob/brace patterns in Phase 0 Step 3 with `find -name … -o
  -name …` chains, which are POSIX-portable and treat "no match" as an empty result.
  Explicit path lists (fixed filenames) remain safe and are kept as-is.
- `ak-js:config-doctor` Phase 0 Step 3 monorepo scan — added `vitest.config.{js,ts}`
  to the framework config scan (discovered during the same live test).
- `docs/solutions/best-practices/skill-shell-absolute-paths-2026-04-07.md` — extended
  to 6 rules with the two new shell-portability lessons (Rule 5: use `find`, not shell
  globs; Rule 6: end conditional-detection blocks with `true`).

## [1.13.1] - 2026-04-07

### 🐛 Fixed

- `ak-js:config-doctor` Phase 0 Step 3 — **shell `cd` stacking bug** that produced broken
  paths like `packages/web/packages/web` on real-world monorepos. The inventory scanner
  now captures `PROJECT_ROOT` once and always uses absolute paths; monorepo package scans
  run inside subshells so `cd` state never leaks between packages.
- `ak-js:config-doctor` Phase 1a Parse Check — **JSONC false-positives** on
  `tsconfig.json`, `tsconfig.*.json`, `biome.jsonc`, and `*.jsonc` files. TypeScript
  officially allows `//` and `/* */` comments in tsconfig files, and several configs use
  the `.jsonc` extension by convention. Added a string-aware JSONC stripper that removes
  comments and trailing commas while preserving comment-like substrings inside string
  literals, and documented the list of JSONC-by-convention file patterns.
- `ak-js:config-doctor` inventory scanner now picks up `tsconfig.*.json` variants
  (`tsconfig.base.json`, `tsconfig.app.json`, etc.) via an explicit glob.

## [1.13.0] - 2026-04-07

### ✨ Added

- New plugin `ak-js` — JavaScript project configuration doctor
  - New skill `/ak-js:config-doctor` — zero-config audit of JS/Node project configuration files
    with a 0-100 scored report, A-F grade, and severity-grouped findings (Critical / High /
    Medium / Suggestion)
  - New agent `framework-config-analyzer` — Phase-2 worker for JS/TS framework config
    analysis (Next.js, Vite, Astro, Nuxt, SvelteKit, Tailwind, ESLint Flat Config, PostCSS)
  - 10 bundled JSON Schemas from SchemaStore / canonical upstreams (package.json,
    tsconfig.json, biome.json, vercel.json, turbo.json, nx.json, prettierrc, web-manifest,
    eslintrc, pnpm-workspace) with SchemaStore fallback for extended coverage
  - `.npmrc` INI-format validator with 145-entry npm config keys whitelist and plaintext
    credential detection (flags `_authToken`, `_password`, etc. as Critical)
  - 11 custom cross-file rules catching mismatches no single-file tool sees: missing script
    deps, incompatible `engines.node` vs `tsconfig.target`, `packageManager` lockfile drift,
    publishable-field checks, `type: module` consistency, workspace glob validity, multiple
    lockfile detection, and workspace dependency version drift for singleton libs
    (react/react-dom/vue/svelte/solid-js/rxjs/zustand)
  - Monorepo-aware from day 1 — auto-detects npm/pnpm/yarn/bun/lerna/turbo/nx workspaces
    and reports per-package + workspace-wide findings
  - Read-only by design — never modifies files; fixes are applied by Claude in the
    surrounding conversation
- Marketplace now lists 10 plugins (was 9); top-level description updated to reflect the
  new JavaScript plugin

## [1.12.0] - 2026-04-07

### 🔄 Changed

- Extended `agents-md-improver` skill (ak-knowledge) with Task Completion Workflow check
  - Phase 2: audits existing workflow sections for stale commands, removed skills, renamed tools, and redundant steps
  - Phase 4: delegates missing or stale workflow generation/audit to `/ak-review:workflow` (or `--audit` mode) instead
    of duplicating detection logic
  - Common Issues: new entry #8 for missing or outdated task completion workflow
- Overhauled Task completion workflow in `AGENTS.md` with explicit Validate, Re-validate, and Version & Changelog steps
  - Step 1 Validate: documents JSON/shellcheck/markdown validation explicitly
  - Step 2 Simplify: prefers `/simplify` skill over `refactoring-expert` agent fallback
  - Step 3 Review: adds critical CodeRabbit evaluation reminder
  - Step 6 Version & Changelog: delegates to `/bump-version` (full automation: 11 files + changelog + commit + tag) with
    `/ak-meta:changelog` as manual fallback

## [1.11.0] - 2026-04-05

### ✨ Added

- New skill `quality` in ak-meta for assessing plugin component quality across 8 weighted dimensions
  - Two-layer assessment: instant structural review (Layer 1) + expert agent scoring (Layer 2)
  - `--quick` mode for fast structural feedback during development
  - `--compare` mode for side-by-side component comparison with delta analysis
  - Tier ratings: Platinum (90+), Gold (80+), Silver (70+), Bronze (60+)
  - Detects 7 quality issues (RIGID_LANGUAGE, WEAK_DESCRIPTION, MISSING_ACTIVATION, etc.)
- New agent `quality-assessor` in ak-meta for expert scoring on 4 dimensions with anchored rubrics
- New agent `diagram-creator` in ak-meta for Mermaid diagram generation (flowcharts, sequences, ERDs, state diagrams,
  C4, and more)
- New knowledge file `hypothesis-debugging.md` in ak-improve with structured root cause analysis framework (6 failure
  mode categories, evidence standards, arbitration protocol)
- New knowledge file `review-dimensions.md` in ak-review with 5 structured review dimensions (Security, Performance,
  Architecture, Testing, Accessibility) and 58 checklist items
- New knowledge file `wcag-audit-patterns.md` in ak-review with comprehensive WCAG 2.2 coverage across all 4 POUR
  principles (60+ criteria, remediation patterns, automated testing)

## [1.10.1] - 2026-04-04

### 🔄 Changed

- Renamed `document` skill to `log` in ak-knowledge for clearer intent (`/ak-knowledge:log`)
- Removed `--compact` mode from `log` skill (ak-knowledge) — single execution mode only
- Removed all arguments from `handoff` skill (ak-meta) — simplified to zero-config usage
- Updated all cross-references, documentation, and agent paths for the skill rename

## [1.10.0] - 2026-04-04

### ✨ Added

- New skill `workflow` in ak-review for generating and auditing Task Completion Workflows
  - Default mode: scans project tooling and generates a tailored 6-step workflow for AGENTS.md
  - Audit mode (`--audit`): verifies existing workflow against current project state
  - Detects build tools, test runners, linters, formatters, type checkers, and review tools
  - Falls back to self-review when CodeRabbit CLI is not available

## [1.9.1] - 2026-04-04

### 🔄 Changed

- Rewrote `discover` skill (ak-meta) with fresh terminology and unique phrasing
- Rephrased `performance-optimizer` and `refactoring-expert` agents (ak-improve) with distinct wording
- Simplified root README and expanded AGENTS.md conventions
- Updated ak-git:operations skill documentation for `--` prefixed arguments
- Added hyperlinks to skills, agents, and hooks in README plugin tables
- Aligned discover skill documentation with new terminology

## [1.9.0] - 2026-04-03

### Added

- New plugin `ak-security` with 3 skills (code-security, llm-security, semgrep) and 43 knowledge files covering OWASP
  Top 10, LLM security, and Semgrep static analysis
- New plugin `ak-react` with 2 skills (react-best-practices, react-doctor) and Vercel Engineering performance guide
- New skill `discover` in ak-meta for divergent idea generation with adversarial filtering
- New skill `agents-md-improver` in ak-knowledge for auditing and improving AGENTS.md files
- New operation `pr` / `ship` in ak-git:operations for commit-push-PR in one step with adaptive PR descriptions
- Git provider auto-detection (GitHub `gh` / GitLab `glab`) in PR creation workflow
- Commit classification (feature vs fix-up) for cleaner PR descriptions

### Changed

- ak-git:operations now supports 5 operations: commit, review, resolve, pr, ship
- ak-meta now has 3 skills (added discover alongside changelog and handoff)
- ak-knowledge now has 4 skills (added agents-md-improver)
- Marketplace expanded from 7 to 9 plugins
- bump-version command updated from 7 to 11 files

## [1.8.0] - 2026-04-03

### Changed

- **BREAKING**: Dissolved `ak-core` plugin — components redistributed to focused plugins
- `ak-review` now includes `finalize` skill and file validation hooks (from ak-core)
- `ak-knowledge` now includes `agents-md` skill (from ak-core)
- Consolidated `validate-all` into `finalize` workflow

### Added

- New plugin `ak-improve` with refactoring-expert and performance-optimizer agents
- New plugin `ak-notifications` with macOS sound and banner notification hooks

### Removed

- Plugin `ak-core` (replaced by ak-review, ak-improve, ak-notifications)
- Standalone `validate-all` skill (consolidated into finalize)

### Migration

Users with ak-core installed should:

1. Uninstall ak-core
2. Install ak-review, ak-improve, ak-notifications

## [1.7.0] - 2026-03-03

### Added

- ✨ ak-git: Automatic ticket detection from branch names — extracts issue IDs (e.g., `ABC-1234`) and prefixes commit
  messages automatically

## [1.6.0] - 2026-02-27

### Added

- ✨ ak-git: `--force-push` flag for operations skill — uses `git push --force-with-lease` for safe force pushes

### Changed

- 🔄 ak-meta: Changelog skill now commits by default — replaced `--commit` with `--no-commit` opt-out, removed `--fast`
  and `--update-version` flags
- 📝 README: Added Superpowers Extended to recommended plugins

## [1.5.0] - 2026-02-24

### Added

- ✨ ak-core: agents-md skill now consolidates both CLAUDE.md and AGENTS.md when both exist — identifies the more
  comprehensive file as base and merges unique sections from the other

## [1.4.0] - 2026-02-22

### Added

- ✨ README: New "Recommended Plugins" section with Chrome DevTools MCP as first companion plugin

### Fixed

- 🐛 README: Corrected ak-core skill count from 1 to 3 (finalize, validate-all, agents-md)
- 🐛 README: Added language specifiers to fenced code blocks (MD040)
- 🐛 markdownlint: Disabled MD060 table column style rule — incompatible with standard Markdown table formatting

## [1.3.0] - 2026-02-22

### Added

- ✨ ak-core: Finalize skill now offers to create a task completion workflow when none exists — detects project tooling
  and generates project-specific steps

## [1.2.1] - 2026-02-22

### Fixed

- 🐛 ak-core: Removed `Read` from prompt hook matcher — prevents false security blocks when reading .env files

## [1.2.0] - 2026-02-22

### Added

- ✨ ak-core: New `/ak-core:agents-md` skill — converts CLAUDE.md files to AGENTS.md with backward-compatible symlinks
- ✨ Bump-version command now creates git tags after committing

### Changed

- 🔄 Skill count updated from 11 to 12 across the marketplace

## [1.1.3] - 2026-02-22

### Fixed

- 🐛 ak-core: Removed unreliable Stop hook that caused intermittent "JSON validation failed" errors

### Added

- ✨ Project-local `/bump-version` command for synchronized version management across all 7 files

## [1.1.1] - 2026-02-21

### Fixed

- 🐛 ak-core: Changed notification sound to Glass and lowered volume to 50%
- 🐛 ak-core: Strengthened Stop hook JSON response instruction for reliability

### Changed

- 🔄 ak-core: Simplified new hooks and validate-all skill after review

## [1.1.0] - 2026-02-21

### Added

- ✨ JSON syntax validation hook — blocks saving broken JSON files (PostToolUse)
- ✨ ShellCheck validation hook — lints shell scripts on save (PostToolUse)
- ✨ Notification hooks — sound on permission prompt, macOS notification on idle
- ✨ validate-all skill — bundles markdown, JSON, and shell script validation in one command
- ✨ GitHub MCP server recommended as user-global integration

### Changed

- 🔄 ak-core now provides 2 skills (finalize, validate-all) and 3 file validation hooks
- 🔄 Skill count updated from 10 to 11 across the marketplace

## [1.0.1] - 2026-02-21

### Fixed

- 🐛 README.md: Corrected plugin installation instructions (use `/plugin` commands, not CLI)
- 🐛 Stop hook: Fixed JSON validation error by adding required `{"ok": true/false}` response format for prompt-type hooks

## [1.0.0] - 2026-02-21

Initial release as AgentKit — a lean, audited plugin marketplace for Claude Code.

### Added

- ✨ 5 plugins: ak-core, ak-git, ak-meta, ak-review, ak-typo3
- ✨ 10 skills across all plugins
- ✨ 9 specialized agents with active Edit/Write capabilities
- ✨ Markdown formatting hook (markdownlint-cli2)
- ✨ Context-aware skill suggestion hook
- ✨ Quality gate hook for task completeness

### Changed

- 🔄 Rebranded from Claude Code Toolkit to AgentKit
- 🔄 All agents upgraded from read-only to active (Edit/Write tools enabled)
- 🔄 Finalize skill streamlined (removed unused flags and phases)
- 🔄 Skill suggestion prompt generalized (no longer hardcoded skill names)
- 🔄 CKEditor knowledge files referenced in sitepackage skill

### Removed

- 🗑️ ak-security plugin (secure skill, debugging/security agents, Semgrep MCP)
- 🗑️ ak-frontend plugin (frontend/tailwind agents, Alpine.js/Tailwind knowledge)
- 🗑️ ak-core: 4 skills (understand, improve, create, ship)
- 🗑️ ak-core: 10 agents (code-architect, project-planner, documentation-specialist, and others)
- 🗑️ ak-meta: mcp skill and manage-mcp.sh script
- 🗑️ ak-typo3: project-setup-context.md knowledge file
