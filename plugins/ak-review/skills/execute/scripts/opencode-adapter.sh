#!/bin/bash
set -euo pipefail

if [ $# -lt 3 ] || [ $# -gt 4 ]; then
  echo "Usage: opencode-adapter.sh <prompt-file> <model> [effort] <raw-output-file>" >&2
  exit 1
fi

PROMPT_FILE="$1"
MODEL="$2"

if [ $# -eq 4 ]; then
  EFFORT="$3"
  RAW_OUTPUT_FILE="$4"
else
  EFFORT=""
  RAW_OUTPUT_FILE="$3"
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "opencode-adapter.sh: prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

PROMPT_TEXT="$(cat "$PROMPT_FILE")"

# opencode can hang: the process sits near 0% CPU and emits no further events,
# indefinitely. Measured twice at over an hour, once at over two. SKILL.md has
# always specified a 20-minute ceiling, but as an instruction to the CALLING
# agent — and that is exactly the guarantee that breaks in an unattended run,
# where a harness may background the call and take the timer with it. Observed:
# a hung run went 83 minutes before a human asked about it.
#
# So the ceiling is enforced here instead, where it cannot be lost. A killed run
# is not a lost run: the JSON stream is written by the OS as the run goes, so the
# salvage path in SKILL.md Phase 3 recovers every finished sub-agent's findings
# from what is already on disk.
TIMEOUT_SECS="${AK_REVIEW_TIMEOUT_SECS:-1200}"
TIMEOUT_MARKER="${RAW_OUTPUT_FILE}.timed-out"
rm -f "$TIMEOUT_MARKER"

# GNU `timeout` is not on a stock macOS, so the watchdog is plain bash. It marks
# the file BEFORE signalling, so the wait below can tell a timeout kill from the
# tool's own non-zero exit — the exit status alone cannot ($? is 143 either way
# if the tool happens to die on SIGTERM).
#
# `set -m` is the load-bearing line. opencode is not one process: a real run
# spawns several, and signalling only the direct child leaves the rest alive —
# measured on the hung run this was written for, where the survivors had to be
# cleared with `pkill`. Job control puts the child in its own process group, so
# `kill -- -PID` reaches the whole tree. Without it the watchdog fires, the
# adapter returns, and the tool keeps running.
run_with_watchdog() {
  local had_monitor=0
  case "$-" in *m*) had_monitor=1 ;; esac
  set -m
  "$@" > "$RAW_OUTPUT_FILE" 2> "$STDERR_FILE" &
  local cmd_pid=$!

  # The watchdog is started while `set -m` is still in effect so it gets its own
  # process group, and is torn down by group below. The earlier version killed
  # only the subshell pid, which reaped the subshell but NOT the `sleep` it was
  # blocked in: that survived as an orphan holding whatever stdout it inherited.
  # Measured while building the codex adapter from this code: every completed run
  # left a `sleep 1200` behind, and because those orphans keep the caller's pipe
  # open, a caller reading this adapter's output through a pipe never sees EOF
  # and hangs for the full 20 minutes.
  #
  # The /dev/null redirection is the second half of the fix: no watchdog process
  # holds a descriptor on the caller's stdout at all, so even an orphan escaping
  # the group kill cannot wedge a pipe.
  (
    sleep "$TIMEOUT_SECS"
    touch "$TIMEOUT_MARKER"
    kill -TERM -- "-$cmd_pid" 2> /dev/null || kill -TERM "$cmd_pid" 2> /dev/null
    sleep 10
    kill -KILL -- "-$cmd_pid" 2> /dev/null || kill -KILL "$cmd_pid" 2> /dev/null
  ) < /dev/null > /dev/null 2>&1 &
  local watchdog_pid=$!

  [ "$had_monitor" -eq 1 ] || set +m

  local code=0
  wait "$cmd_pid" || code=$?

  kill -TERM -- "-$watchdog_pid" 2> /dev/null || kill -TERM "$watchdog_pid" 2> /dev/null
  wait "$watchdog_pid" 2> /dev/null || true

  return "$code"
}

# opencode reports denied permissions on stderr ("permission requested: ...;
# auto-rejecting") and keeps going, so a run that could not read the repo still
# exits 0 with a plausible-looking but uninformed JSON stream. Capture stderr
# next to the stream, or an unattended run's real failure reason is lost.
STDERR_FILE="${RAW_OUTPUT_FILE}.stderr"

# `set -e` would abort before the exit code could be captured and the warning
# emitted, so the invocation is deliberately guarded here instead.
set +e
if [ -n "$EFFORT" ]; then
  run_with_watchdog opencode run "$PROMPT_TEXT" --model "$MODEL" --variant "$EFFORT" --format json
else
  run_with_watchdog opencode run "$PROMPT_TEXT" --model "$MODEL" --format json
fi
EXIT_CODE=$?
set -e

# 124 is GNU timeout's convention, reused so a caller can branch on it without
# parsing text. Reported before the stderr dump below, because on a timeout the
# stderr file is usually empty and silence would read as "nothing happened".
if [ -f "$TIMEOUT_MARKER" ]; then
  rm -f "$TIMEOUT_MARKER"
  EXIT_CODE=124
  echo "opencode-adapter.sh: TIMEOUT - opencode exceeded ${TIMEOUT_SECS}s and was killed." >&2
  echo "opencode-adapter.sh: the partial stream is at $RAW_OUTPUT_FILE - run the salvage path (opencode-extract-subagents.sh FIRST, then opencode-extract-report.sh, then opencode-extract-cost.sh)." >&2
fi

if [ -s "$STDERR_FILE" ]; then
  cat "$STDERR_FILE" >&2
fi

if grep -q "auto-rejecting" "$STDERR_FILE" 2> /dev/null; then
  echo "opencode-adapter.sh: WARNING - opencode denied one or more permissions; the review ran without full repository access. See $STDERR_FILE" >&2
fi

exit "$EXIT_CODE"
