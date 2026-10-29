# ak-gitlab

Shows the merge request of the current branch and how far its pipeline is. A mod: one segment in
the shared band above the prompt, `!12 4/7 3:12/~5m` while it runs, `!12 ✗ test:unit` when it
failed, `!12 ✓ 4:51` when it is green. Needs `ak-mods`, which installs with it, switches the mod on
or off per chat and draws the band.

Requires Claude Code 2.1.309 or later (hooks-module support) and `glab`, installed and logged in.

## Install

```text
/plugin install ak-gitlab@ak-marketplace
```

## Use

- The segment follows the open merge request whose source is the current branch. On the desktop app
  a running pipeline shows a ring of its finished jobs, the time so far and an estimate.
- **open** (`/gitlab-open`) opens the merge request; after a failure, **Get errors**
  (`/gitlab-errors`) puts an excerpt of the failed job's log in the prompt box as a draft.
- A toast says when the pipeline is green, failed or waits at a manual job.

See [the mod docs](../../docs/mods/ak-gitlab/gitlab.md).

## Credit

Inspired by the feature set of a third-party GitLab plugin (MIT). No code is taken over.

## Development

```bash
claude plugin validate plugins/ak-gitlab
claude plugin test plugins/ak-gitlab
```
