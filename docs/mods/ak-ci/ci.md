# CI (`ak-ci`)

Shows the merge request of the current branch and how far its pipeline is, as one segment.

Requires Claude Code 2.1.309 or later (hooks-module support) and [glab](https://gitlab.com/gitlab-org/cli),
installed and logged in (`glab auth login`). Switched per chat in the
[Mods pane](../ak-mods/switcher.md).

## Why

While Claude works on a GitLab project, the question that most often leads out of the chat is about
the merge request: did the push start a pipeline, is it running, how far along is it, how long will
it take, did it fail and where. The segment answers it without leaving the chat, and a failure goes
to Claude with one press.

## Band

The mod follows the open merge request whose source is the current branch, and its head pipeline.
It shows one segment in the band that [`ak-mods`](../ak-mods/switcher.md) draws above the prompt:

| Segment | Meaning |
| --------- | --------- |
| none | No open merge request for this branch, or the repository is not on GitLab |
| `!12 no pipeline` (dim) | The merge request has no pipeline yet |
| `!12 4/7 3:12/~5m` | Running: 4 of 7 jobs finished, 3:12 so far, about 5 minutes in all |
| `!12 ✗ test:unit 2:48` | Failed in `test:unit` after 2:48, in the error colour |
| `!12 ✓ 4:51` | Green after 4:51 |
| `!12 ⏸ deploy` | Held at the manual job `deploy`, in the warning colour |
| `!12 canceled` (dim) | Canceled or skipped |

On the desktop app a running pipeline draws a ring filled to its finished jobs, `◔ 4/7 3:12 of
~5 min`, and a green one reads `✓ Pipeline 4:51`. The time runs on between fetches. The estimate
is the mean run of the project's last green pipelines; without any, it is left out. A finished job
is one that succeeded, failed, was canceled or skipped, and a manual job the pipeline may pass by;
a bridge to a downstream pipeline counts as one job.

When the band is short of room, the segment turns compact: `!12 4/7`, `!12 ✗`, `!12 ✓`. Its
priority is 6.

The button is **open**, which opens the merge request in the browser; after a failure it is
**Get errors**. A press on the segment opens the Mods pane at this mod, whose card lists the
merge request, its target branch, draft, the pipeline, each stage with its mark (`build ✓ · test ◐ ·
deploy ○`), the failed jobs, when it started and how long it ran.

Without `ak-mods` (or when it refuses the mod, or a publish fails), the mod draws its own band
instead, never both.

The mod's texts follow Claude Code's `language` setting, else `LC_ALL`, `LC_MESSAGES` or `LANG`:
German or English. In German the buttons read **öffnen** and **Fehler holen**, and the segment
`!12 keine Pipeline`, `!12 abgebrochen` and `3:12 von ~5 min`.

## Commands

| Command | Does |
| --------- | --------- |
| `/ci-open` | Opens the merge request in the browser (the **open** button) |
| `/ci-errors` | Puts an excerpt of the failed job's log in the prompt box (the **Get errors** button) |

The excerpt holds the lines that look like errors, three lines around each, and the last 30 lines,
without colours or GitLab's section markers, under a sentence that names the merge request, job and
stage. It goes after what is already typed, as a draft: nothing is sent until you press Enter.

The job is the first one that failed the pipeline itself. When only a bridge failed, the mod follows
it one level down to the downstream pipeline and takes that pipeline's first failed job. A log
longer than 4 MiB is read up to that limit; the draft then says that its end is missing.

## How it works

- GitLab is read through `glab api`, which resolves the project and the branch from the repository
  and brings its own login. The mod holds no token and sends nothing to any other host.
- It asks every 15 seconds while a pipeline runs; every 2.5 minutes while a merge request is open
  and its pipeline is settled or missing, since pushes also come from outside Claude; and at once on
  session start, on every prompt and main-loop turn, and after a `git checkout`, `git switch`,
  `git push` or `glab mr create` that Claude runs, and once more 10 seconds later, when GitLab has
  attached the new pipeline. Without an open merge request it waits for the next of those.
  Switched off, it asks nothing.
- A fetch that fails keeps the last segment. When glab is not logged in, the segment goes and a
  toast says so once; when glab is missing or the repository is not on GitLab, the mod stays silent.
- A toast says when the pipeline turns green, fails or stops at a manual job, once per state it
  reaches: a retried job that turns the same pipeline green toasts again, and so does a second
  manual job. A pipeline that had already finished before the session started gets none; one
  created later gets its toast even when it finished between two fetches.

## Credit

Inspired by the feature set of a third-party GitLab plugin (MIT). No code is taken over: the mod
shows status, while the tools for creating, approving and merging merge requests are left to `glab`
and [`ak-git`](../../skills/ak-git/operations.md).
