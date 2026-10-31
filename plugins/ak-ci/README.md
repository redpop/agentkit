# ak-ci

Shows the merge request (GitLab) or pull request (GitHub) of the current branch and how far its
checks are. A mod: one segment in the shared band above the prompt, `!12 4/7 3:12/~5m` while it
runs, `#12 ✗ markdownlint` when it failed, `main ✓ 4:51` when it is green. Needs `ak-mods`, which
installs with it, switches the mod on or off per chat and draws the band.

Requires Claude Code 2.1.309 or later (hooks-module support) and the CLI of your host, installed
and logged in: `gh` for GitHub, `glab` for GitLab.

## Install

```text
/plugin install ak-ci@ak-marketplace
```

## Use

- The segment follows the open merge request (GitLab) or pull request (GitHub) whose source is the
  current branch. On GitHub a branch without a pull request shows the checks of its pushed tip,
  named by the upstream's branch. On the desktop app a running pipeline shows a ring of its
  finished jobs, the time so far and an estimate.
- **open** (`/ci-open`) opens the change; after a failure, **Get errors** (`/ci-errors`) puts an
  excerpt of the failed job's log in the prompt box as a draft. The card's **⋯** menu offers
  **open** and **Copy link** (`/ci-link`).
- A toast says when the pipeline or the checks are green, failed or wait at a manual job.

See [the mod docs](../../docs/mods/ak-ci/ci.md).

## Credit

Inspired by the feature set of a third-party GitLab plugin (MIT). No code is taken over.

## Development

```bash
claude plugin validate plugins/ak-ci
claude plugin test plugins/ak-ci
```
