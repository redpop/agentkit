# AgentKit

Modular plugin marketplace for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — 10 plugins with 29 skills, 13 agents, and domain knowledge bases for Git workflows, security, React, TYPO3, and more.

## Plugins

| Plugin | Skills | Agents | Description |
|--------|--------|--------|-------------|
| [**ak-git**](#ak-git--smart-git-operations) | 1 | 2 | Smart commits, change analysis, conflict resolution |
| [**ak-improve**](#ak-improve--code-improvement) | — | 2 | Code refactoring and performance optimization agents |
| [**ak-js**](#ak-js--javascript-config-doctor) | 1 | 1 | JS config validation, 11 cross-file rules, monorepo-aware |
| [**ak-knowledge**](#ak-knowledge--solution-documentation) | 4 | 1 | Solution docs, knowledge maintenance, AGENTS.md tools |
| [**ak-meta**](#ak-meta--project-management-tools) | 4 | 2 | Discovery, changelog generation, AI context handoff, quality assessment, diagrams |
| [**ak-notifications**](#ak-notifications--macos-notifications) | — | — | macOS sound and banner notifications |
| [**ak-react**](#ak-react--react--nextjs-development) | 2 | — | React and Next.js best practices, performance optimization, code scanning |
| [**ak-review**](#ak-review--quality-assurance) | 9 | — | CodeRabbit review, code explanation, finalize workflow, workflow management, dependency update skill generation, external review delegation, unattended external-tool execution with guided setup, validation hooks |
| [**ak-security**](#ak-security--security-guidelines) | 3 | — | OWASP security guidelines, LLM security, Semgrep static analysis |
| [**ak-typo3**](#ak-typo3--typo3-v134-development) | 5 | 5 | TYPO3 v13.4 Content Blocks, SitePackage, extensions |

## Installation

Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code) v1.0.33 or later.

### Step 1: Add the marketplace

Open Claude Code and run:

```text
/plugin marketplace add redpop/agentkit
```

### Step 2: Install plugins

Install all plugins:

```text
/plugin install ak-review@ak-marketplace
/plugin install ak-git@ak-marketplace
/plugin install ak-meta@ak-marketplace
/plugin install ak-improve@ak-marketplace
/plugin install ak-js@ak-marketplace
/plugin install ak-knowledge@ak-marketplace
/plugin install ak-notifications@ak-marketplace
/plugin install ak-react@ak-marketplace
/plugin install ak-security@ak-marketplace
/plugin install ak-typo3@ak-marketplace
```

Or browse available plugins interactively with `/plugin` and go to the **Marketplaces** tab.

## Documentation

Detailed documentation for all components is available in the [`docs/`](docs/) directory:

- [Skills](docs/skills/) — All slash commands with usage examples
- [Agents](docs/agents/) — Specialized sub-agents and their capabilities
- [Hooks](docs/hooks/) — Automated actions on tool events

## Plugin Details

### ak-git — Smart Git Operations

Intelligent Git workflow assistance with smart commit messages, change
analysis, and conflict resolution.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| [`/ak-git:operations`](docs/skills/ak-git/operations.md) | Smart commits, PR/MR creation, conflict resolution, change review | `/ak-git:operations --ship` |

#### Agents

| Agent | Purpose |
|-------|---------|
| [git-conflict-specialist](docs/agents/ak-git/git-conflict-specialist.md) | Merge conflict analysis, resolution strategies, rebase issues |
| [git-workflow-specialist](docs/agents/ak-git/git-workflow-specialist.md) | Commit message generation, branch management, atomic commit strategies |

### ak-improve — Code Improvement

Code improvement agents for refactoring and performance optimization, with
a hypothesis-driven debugging framework for systematic root cause analysis.

#### Agents

| Agent | Purpose |
|-------|---------|
| [performance-optimizer](docs/agents/ak-improve/performance-optimizer.md) | Bottleneck identification, memory leak analysis, algorithmic optimization |
| [refactoring-expert](docs/agents/ak-improve/refactoring-expert.md) | Code refactoring with clean code principles and design patterns |

#### Knowledge

| File | Content |
|------|---------|
| hypothesis-debugging.md | Structured debugging with competing hypotheses, evidence standards, and arbitration |

### ak-js — JavaScript Config Doctor

JavaScript project configuration doctor: validates `package.json`, `tsconfig.json`,
framework configs, and enforces cross-file best practices with 11 custom rules.
Monorepo-aware from day 1.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| [`/ak-js:config-doctor`](docs/skills/ak-js/config-doctor.md) | Scan project configs and produce a scored report | `/ak-js:config-doctor` |

#### Agents

| Agent | Purpose |
|-------|---------|
| [framework-config-analyzer](docs/agents/ak-js/framework-config-analyzer.md) | Phase-2 worker for JS/TS framework config analysis |

### ak-knowledge — Solution Documentation

Capture solved problems as structured, searchable solution documents
and keep them up to date.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| [`/ak-knowledge:agents-md`](docs/skills/ak-knowledge/agents-md.md) | Convert CLAUDE.md files to AGENTS.md with symlinks | `/ak-knowledge:agents-md` |
| [`/ak-knowledge:agents-md-improver`](docs/skills/ak-knowledge/agents-md-improver.md) | Audit and improve AGENTS.md files with quality scoring | `/ak-knowledge:agents-md-improver` |
| [`/ak-knowledge:log`](docs/skills/ak-knowledge/log.md) | Log a recently solved problem for team knowledge | `/ak-knowledge:log` |
| [`/ak-knowledge:refresh`](docs/skills/ak-knowledge/refresh.md) | Review and maintain solution docs against current codebase | `/ak-knowledge:refresh` |

#### Agents

| Agent | Purpose |
|-------|---------|
| [solution-reviewer](docs/agents/ak-knowledge/solution-reviewer.md) | Validate generated solution docs for completeness and clarity |

### ak-meta — Project Management Tools

Discovery, changelog generation with automatic version detection, plugin quality
assessment, and AI context handoff for cross-session collaboration.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| [`/ak-meta:discover`](docs/skills/ak-meta/discover.md) | Generate and evaluate improvement ideas with adversarial filtering | `/ak-meta:discover blog content Q3` |
| [`/ak-meta:changelog`](docs/skills/ak-meta/changelog.md) | Update CHANGELOG.md with automatic version detection | `/ak-meta:changelog` |
| [`/ak-meta:handoff`](docs/skills/ak-meta/handoff.md) | Create context handoff documents for other AI sessions | `/ak-meta:handoff` |
| [`/ak-meta:quality`](docs/skills/ak-meta/quality.md) | Assess plugin component quality with 8-dimension scoring | `/ak-meta:quality plugins/ak-git/` |

#### Agents

| Agent | Purpose |
|-------|---------|
| [quality-assessor](docs/agents/ak-meta/quality-assessor.md) | Expert quality scoring for skills and agents on 4 dimensions |
| [diagram-creator](docs/agents/ak-meta/diagram-creator.md) | Creates Mermaid diagrams for architecture, flows, ERDs, and interactions |

### ak-notifications — macOS Notifications

Platform-specific notification hooks for Claude Code.

#### Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| [Sound alert](docs/hooks/ak-notifications/notification-hooks.md) | Permission prompt | Plays Glass.aiff sound |
| [Desktop banner](docs/hooks/ak-notifications/notification-hooks.md) | Idle prompt | Shows macOS notification |

### ak-react — React & Next.js Development

React and Next.js development with Vercel Engineering best practices
and automated code quality scanning.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| [`/ak-react:react-best-practices`](docs/skills/ak-react/react-best-practices.md) | React/Next.js performance optimization (65 rules from Vercel Engineering) | `/ak-react:react-best-practices` |
| [`/ak-react:react-doctor`](docs/skills/ak-react/react-doctor.md) | Scan React codebase for security, performance, and architecture issues | `/ak-react:react-doctor` |

### ak-review — Quality Assurance

Automated code review, task completion workflow, structured review
dimensions, and file validation hooks with markdown formatting.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| [`/ak-review:coderabbit`](docs/skills/ak-review/coderabbit.md) | Run CodeRabbit review on uncommitted or staged changes | `/ak-review:coderabbit` |
| [`/ak-review:finalize`](docs/skills/ak-review/finalize.md) | Run the task completion workflow (format, simplify, review) | `/ak-review:finalize` |
| [`/ak-review:workflow`](docs/skills/ak-review/workflow.md) | Generate or audit a task completion workflow | `/ak-review:workflow --audit` |
| [`/ak-review:deps`](docs/skills/ak-review/deps.md) | Generate or audit a project-specific dependency update skill | `/ak-review:deps --audit` |
| [`/ak-review:delegate`](docs/skills/ak-review/delegate.md) | Generate a self-contained code-review prompt for a foreign agent | `/ak-review:delegate --type uncommitted` |
| [`/ak-review:advise`](docs/skills/ak-review/advise.md) | Validate a foreign agent's review findings against the code | `/ak-review:advise --in findings.json` |
| [`/ak-review:explain`](docs/skills/ak-review/explain.md) | Explain a code snippet's purpose, mechanics, and notable patterns | `/ak-review:explain [code snippet]` |
| [`/ak-review:execute`](docs/skills/ak-review/execute.md) | Run delegate → external agent → advise → fix, unattended | `/ak-review:execute --type uncommitted` |
| [`/ak-review:setup`](docs/skills/ak-review/setup.md) | Configure the execute skill interactively | `/ak-review:setup --global` |

#### Hooks

| Hook | Trigger | Action |
|------|---------|--------|
| [markdown-format](docs/hooks/ak-review/validation-hooks.md) | After Write/Edit | Auto-formats .md files via markdownlint-cli2 |
| [json-validate](docs/hooks/ak-review/validation-hooks.md) | After Write/Edit | Validates JSON syntax |
| [shellcheck-validate](docs/hooks/ak-review/validation-hooks.md) | After Write/Edit | Lints shell scripts via ShellCheck |
| [skill-suggestions](docs/hooks/ak-review/validation-hooks.md) | After Write/Edit | Suggests relevant AgentKit skills |

#### Knowledge

| File | Content |
|------|---------|
| review-dimensions.md | 5 review dimensions with checklists — Security, Performance, Architecture, Testing, Accessibility |
| wcag-audit-patterns.md | Comprehensive WCAG 2.2 audit — 60+ criteria, remediation patterns, automated testing |
| dependency-update-methodology.md | Transferable dependency-update rules — baseline as numbers, tiering, verify-instead-of-assume, pinning, couplings |
| project-tooling-detection.md | Shared manifest, config-file and lockfile signals used by `workflow` and `deps` |

### ak-security — Security Guidelines

Security guidelines for writing secure code, LLM applications, and
static analysis scanning.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| [`/ak-security:code-security`](docs/skills/ak-security/code-security.md) | OWASP Top 10 security guidelines for 15+ languages | `/ak-security:code-security` |
| [`/ak-security:llm-security`](docs/skills/ak-security/llm-security.md) | OWASP Top 10 for LLM Applications security rules | `/ak-security:llm-security` |
| [`/ak-security:semgrep`](docs/skills/ak-security/semgrep.md) | Semgrep static analysis scanning and custom rule creation | `/ak-security:semgrep` |

### ak-typo3 — TYPO3 v13.4 Development

TYPO3 CMS development with Content Blocks, Fluid components, extension
scaffolding, and SitePackage generation.

#### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| [`/ak-typo3:content-blocks`](docs/skills/ak-typo3/content-blocks.md) | Generate Content Blocks v1.3 with modern field configs | `/ak-typo3:content-blocks Hero` |
| [`/ak-typo3:extension-kickstarter`](docs/skills/ak-typo3/extension-kickstarter.md) | Create extensions via ext-kickstarter or manual scaffolding | `/ak-typo3:extension-kickstarter` |
| [`/ak-typo3:fluid-components`](docs/skills/ak-typo3/fluid-components.md) | Generate Fluid v4 Components with Atomic Design patterns | `/ak-typo3:fluid-components Button` |
| [`/ak-typo3:make-content-block`](docs/skills/ak-typo3/make-content-block.md) | Wrapper for `make:content-block` with smart defaults | `/ak-typo3:make-content-block` |
| [`/ak-typo3:sitepackage`](docs/skills/ak-typo3/sitepackage.md) | Create a TYPO3 v13.4 SitePackage with Site Sets | `/ak-typo3:sitepackage my-site` |

#### Agents

| Agent | Purpose |
|-------|---------|
| [typo3-architect](docs/agents/ak-typo3/typo3-architect.md) | Enterprise CMS architecture, extension design, performance optimization |
| [typo3-content-blocks-specialist](docs/agents/ak-typo3/typo3-content-blocks-specialist.md) | Content Block creation, field configuration, backend previews |
| [typo3-extension-developer](docs/agents/ak-typo3/typo3-extension-developer.md) | Extension development, Extbase controllers, service configuration |
| [typo3-fluid-expert](docs/agents/ak-typo3/typo3-fluid-expert.md) | Fluid template architecture, ViewHelper development, rendering optimization |
| [typo3-typoscript-expert](docs/agents/ak-typo3/typo3-typoscript-expert.md) | TypoScript configuration, Site Sets, data processing chains |

## Recommended Tools

### Semgrep — Security Scanning

The `ak-security` plugin includes three security skills (`code-security`,
`llm-security`, `semgrep`) that teach AI agents to write and review secure
code. The `code-security` and `llm-security` skills work without external
dependencies — the agent uses the included OWASP knowledge directly.

For the `semgrep` skill, we recommend additionally installing **Semgrep CLI**
and the **Semgrep MCP Server** for automated static analysis scanning:

```bash
# Install Semgrep CLI
brew install semgrep          # or: python3 -m pip install semgrep
```

The [Semgrep MCP Server](https://github.com/semgrep/semgrep/tree/develop/cli/src/semgrep/mcp) provides tools like
`semgrep_scan` and `semgrep_findings` to the AI agent:

- **Claude Code**: Run `/plugin`, search for "Semgrep" in the Discover tab, and install

> **Note:** Semgrep is optional. The security skills work without it — the
> agent reviews code using the OWASP rules without automated scanning.

## Recommended Plugins

Official Claude Code plugins that work well with AgentKit. Install
via `/plugin` in Claude Code:

| Plugin | Description |
|--------|-------------|
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Browser automation, screenshots, and DevTools access. Requires Node.js v20.19+ and Chrome. |
| [Superpowers Extended](https://github.com/obra/superpowers) | Agentic skills framework with task management and structured development methodology. |

## Previous Version

The pre-plugin architecture (v6.x, `install.sh`-based) is archived at [redpop/claude-code-toolkit-legacy](https://github.com/redpop/claude-code-toolkit-legacy).

## License

MIT
