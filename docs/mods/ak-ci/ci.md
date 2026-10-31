# CI (`ak-ci`)

Shows the merge request (GitLab) or pull request (GitHub) of the current branch and how far its
checks are, as one segment. On GitHub a branch without a pull request shows the checks of its
pushed tip instead.

Requires Claude Code 2.1.309 or later (hooks-module support) and the command-line tool of your
host, installed and logged in: [gh](https://cli.github.com) (`gh auth login`) for GitHub,
[glab](https://gitlab.com/gitlab-org/cli) (`glab auth login`) for GitLab. You need only the one
your repository lives on. Switched per chat in the [Mods pane](../ak-mods/switcher.md).

## Why

While Claude works on a project, the question that most often leads out of the chat is about the
change: did the push start a pipeline or checks, are they running, how far along are they, how long
will they take, did they fail and where. The segment answers it without leaving the chat, and a
failure goes to Claude with one press.

## Which host

The mod reads the host from the repository's remote. The remote is the one the branch's upstream
names, else `origin`, else the first one there is.

| Host | Read through |
| --------- | --------- |
| `github.com` | `gh` |
| a self-hosted host that `gh auth status --hostname <host>` knows (GitHub Enterprise, such as `github.example.com`) | `gh` |
| any other host (such as `gitlab.example.com`) | `glab` |
| no remote, or one without a host | nothing, the mod shows no segment |

The answer for a self-hosted host is kept for the session, so `gh` is asked once for each.

## What it follows

- **GitLab:** the open merge request whose source is the current branch, and its head pipeline.
- **GitHub:** the open pull request whose head is the current branch, and the checks of its head
  commit. Without a pull request, the checks of the tip the branch has on its remote; with no
  upstream, or no check or status on that commit, there is no segment.

On GitHub the checks are every check run and every commit status of the commit, so an external
status such as a review bot counts beside GitHub Actions. They group by workflow; statuses from
outside Actions group as `status`.

## Band

It shows one segment in the band that [`ak-mods`](../ak-mods/switcher.md) draws above the prompt.
Its first word is the change: `!12` for a merge request, `#12` for a pull request, the branch name
(`main`, the upstream's branch) for a branch tip.

| Segment | Meaning |
| --------- | --------- |
| none | No open merge request or pull request for this branch, no checks on the pushed tip, or the host is not known |
| `!12 no pipeline` / `#12 no checks` (dim) | The change has no pipeline or checks yet |
| `!12 4/7 3:12/~5m` | Running: 4 of 7 jobs finished, 3:12 so far, about 5 minutes in all |
| `#12 ✗ markdownlint 2:48` | Failed in `markdownlint` after 2:48, in the error colour |
| `main ✓ 4:51` | Green after 4:51 (here the pushed tip of the GitHub branch `main`) |
| `!12 ⏸ deploy` | Held at the manual job or the check `deploy`, in the warning colour |
| `!12 canceled` (dim) | Canceled or skipped |

On the desktop app a running pipeline draws a ring filled to its finished jobs, `◔ 4/7 3:12 of
~5 min`, and a green one reads `✓ Pipeline 4:51` (GitLab) or `✓ Checks 4:51` (GitHub). The time
runs on between fetches. A finished job is one that succeeded, failed, was canceled or skipped,
and on GitLab a manual job the pipeline may pass by; a bridge to a downstream pipeline counts as
one job. On GitHub a job is a check run or a commit status.

When the band is short of room, the segment turns compact: `!12 4/7`, `!12 ✗`, `!12 ✓`. Its
priority is 6.

### States on GitHub

GitHub's check states map onto the states above. For a mix, the first line that matches wins:

| Checks | State |
| --------- | --------- |
| any check failed, timed out, needs action, or any status failed or errored | failed, as soon as the first one fails (GitHub turns red then, too) |
| any check queued, in progress, pending or requested | running |
| a check `waiting` (an environment waiting for approval) | held, `⏸ <name>` |
| all checks succeeded, are neutral or were skipped | green |
| all checks canceled, none failed | canceled |

So a `waiting` check beside running ones reads as running, and `⏸` shows once nothing else moves,
as on GitLab. A canceled check beside passed ones counts as passed, since GitHub cancels
superseded runs. Neutral and skipped checks count as passed and never block. Whether a check is
required by branch protection is not looked up: every failure blocks. Time runs from the earliest
start among the checks and ends at the latest completion.

### Estimate

On GitLab the estimate is the mean run of the project's last green pipelines. On GitHub it is the
mean of the last green runs of each workflow that runs on the commit, and the longest workflow's
mean counts as the whole, since they run in parallel. Commit statuses from outside GitHub Actions
have no history and do not feed it. Without any history the estimate is left out.

## Card

The button is **open**, which opens the merge request or pull request in the browser (for a
branch tip, the commit); after a failure it is **Get errors**. A press on the segment opens the
Mods pane at this mod, whose card lists:

- the change with its repository, `group/project !12 Title`, `owner/repo #12 Title`, or
  `owner/repo main` for a branch tip,
- its target branch and whether it is a draft (not for a branch tip, which is no pull request),
- the pipeline or the checks (on GitHub with the commit, short),
- each stage (GitLab) or workflow (GitHub) with its mark (`build ✓ · test ◐ · deploy ○`),
- the failed jobs, when they started and how long they ran.

The **⋯** menu of the card offers **open** and **Copy link**, whatever the button is.
**Copy link** copies the address **open** would open and says so in a toast; when no clipboard
takes it, the toast shows the address instead.

Without `ak-mods` (or when it refuses the mod, or a publish fails), the mod draws its own band
instead, never both.

The mod's texts follow Claude Code's `language` setting, else `LC_ALL`, `LC_MESSAGES` or `LANG`:
German or English. In German the buttons read **öffnen**, **Fehler holen** and **Link kopieren**,
the segment `!12 keine Pipeline`, `#12 keine Checks`, `!12 abgebrochen` and `3:12 von ~5 min`, and
the card calls its stages `Stages` on GitLab and `Workflows` on GitHub.

## Commands

| Command | Does |
| --------- | --------- |
| `/ci-open` | Opens the merge request, pull request or, for a branch tip, the commit's checks page in the browser (the **open** button) |
| `/ci-errors` | Puts an excerpt of the failed job's log in the prompt box (the **Get errors** button) |
| `/ci-link` | Copies the address **open** would open (**Copy link** in the card's menu) |

The excerpt holds the lines that look like errors, three lines around each, and the last 30 lines,
without colours or GitLab's section markers, under a sentence that names the change, job and
stage or workflow. It goes after what is already typed, as a draft: nothing is sent until you
press Enter.

### Which log

- **GitLab:** the job is the first one that failed the pipeline itself. When only a bridge failed,
  the mod follows it one level down to the downstream pipeline and takes that pipeline's first
  failed job. A log longer than 4 MiB is read up to that limit; the draft then says that its end
  is missing.
- **GitHub:** the job is the first failed check run that belongs to a GitHub Actions job; its log
  comes from `gh run view --job <id> --log-failed`. GitHub turns red at the first failure while
  other jobs still run, and gh refuses the log of a run in progress; the mod then reads the
  finished job's whole log through the API. A failed check from outside Actions (a review
  bot, say), or a job that failed before any step logged, has no log: a toast names the check and
  nothing goes into the prompt box. **open** still leads to it.

## How it works

- The host is read through `gh` or `glab`, which resolve the repository and the branch from the
  checkout and bring their own login. The mod holds no token and sends nothing to any other host.
- It asks every 15 seconds while checks run; every 2.5 minutes while a change or a branch tip is
  shown and its checks are settled or missing, since pushes also come from outside Claude; and at
  once on session start, on every prompt and main-loop turn, and after a `git checkout`,
  `git switch`, `git push`, `glab mr create` or `gh pr create` that Claude runs, and once more 10
  seconds later, when the host has attached the new pipeline. Without a change to show it waits
  for the next of those. Switched off, it asks nothing.
- A fetch that fails keeps the last segment. When the CLI is not logged in, the segment goes and a
  toast says so once; when it is missing or the host is not known, the mod stays silent.
- A toast says when the checks turn green, fail or stop at a manual job, once per state they
  reach. A pipeline or checks that had already finished before the session started gets none; one created
  later gets its toast even when it finished between two fetches.
  - GitLab: a retried job that turns the same pipeline green toasts again, and so does a second
    manual job. A pipeline held at the same manual job twice toasts once.
  - GitHub: failed checks toast once, when the first fails, while others still run. Checks seen
    running again (a re-run) may reach a state they had before and toast again.

## Known limits

- The tip of a branch without a pull request is the local remote-tracking ref (`@{u}`). A push made
  elsewhere shows after the next `git fetch`.
- A GitHub re-run that fails again between two slow polls (2.5 minutes) is never seen running, so
  it gives no second toast.
- Only the first 100 check runs and the first 100 commit statuses of a commit are read; more are
  not counted.

## Credit

Inspired by the feature set of a third-party GitLab plugin (MIT). No code is taken over: the mod
shows status, while the tools for creating, approving and merging merge requests and pull requests
are left to `glab`, `gh` and [`ak-git`](../../skills/ak-git/operations.md).
