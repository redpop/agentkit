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

# There is a SECOND failure mode, and it is not a slow run: opencode 1.18.21
# intermittently produces zero bytes and never returns. Reproduced repeatedly on
# 2026-08-22 across every model, provider, prompt shape and working directory,
# including an empty one.
#
# What localises it is opencode's OWN log (~/.local/share/opencode/log/opencode.log),
# not the stream. A healthy run logs:
#
#   message=init
#   message=created id=ses_...      <- session created
#   message=loop ... step=0
#   message=stream providerID=...   <- model called
#
# A stalled run logs `init` and then nothing, ever. So it dies inside SESSION
# CREATION — a database write — before the first event and before the model is
# reached. `opencode serve` started during one stall failed outright with
# "database is locked", which points the same way.
#
# The root cause is upstream and was not isolated here: the DB was ruled out by
# moving it aside (still stalled), config and plugins by running with an empty
# XDG_CONFIG_HOME (still stalled, once the result was re-tested rather than
# trusted), stale processes by checking for survivors (none), and a concurrent
# instance by holding the DB open from a second process (no effect). It comes
# and goes in windows of minutes, during which EVERYTHING stalls — so any single
# comparison is worthless unless paired with a control run in the same minute.
#
# What the adapter can do is fail honestly and fast. A run that has emitted
# nothing has not started, and burning the full 20-minute ceiling on it wastes
# the caller's time and tells them the wrong thing.
STARTUP_GRACE_SECS="${AK_REVIEW_STARTUP_GRACE_SECS:-90}"
NEVER_STARTED_MARKER="${RAW_OUTPUT_FILE}.never-started"
rm -f "$NEVER_STARTED_MARKER"

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

  # The startup probe. Same process-group discipline as the ceiling watchdog
  # above, for the same reason. It checks ONE thing: did the run emit any bytes
  # at all within the grace period? An empty stream at that point means opencode
  # never got past session creation, so waiting out the remaining ceiling can
  # only waste time — there is no partial result accumulating.
  #
  # `-s` on the raw output file is the whole test, and it is deliberately not a
  # check for well-formed JSON: any byte proves the run started, and parsing
  # here would just be a second thing that can be wrong.
  (
    sleep "$STARTUP_GRACE_SECS"
    if [ ! -s "$RAW_OUTPUT_FILE" ]; then
      touch "$NEVER_STARTED_MARKER"
      kill -TERM -- "-$cmd_pid" 2> /dev/null || kill -TERM "$cmd_pid" 2> /dev/null
      sleep 5
      kill -KILL -- "-$cmd_pid" 2> /dev/null || kill -KILL "$cmd_pid" 2> /dev/null
    fi
  ) < /dev/null > /dev/null 2>&1 &
  local startup_pid=$!

  [ "$had_monitor" -eq 1 ] || set +m

  local code=0
  wait "$cmd_pid" || code=$?

  kill -TERM -- "-$watchdog_pid" 2> /dev/null || kill -TERM "$watchdog_pid" 2> /dev/null
  wait "$watchdog_pid" 2> /dev/null || true
  kill -TERM -- "-$startup_pid" 2> /dev/null || kill -TERM "$startup_pid" 2> /dev/null
  wait "$startup_pid" 2> /dev/null || true

  return "$code"
}

# opencode reports denied permissions on stderr ("permission requested: ...;
# auto-rejecting") and keeps going, so a run that could not read the repo still
# exits 0 with a plausible-looking but uninformed JSON stream. Capture stderr
# next to the stream, or an unattended run's real failure reason is lost.
STDERR_FILE="${RAW_OUTPUT_FILE}.stderr"

# `set -e` would abort before the exit code could be captured and the warning
# emitted, so the invocation is deliberately guarded here instead.
#
# `--print-logs --log-level DEBUG` is not noise: on a stall, stderr is EMPTY,
# which reads as "nothing went wrong" when in fact nothing happened. These flags
# are the only thing that produced any diagnostic at all while investigating the
# zero-byte stall, and they cost nothing on a healthy run. The output lands in
# the stderr sidecar, never in the JSON stream, so the extractors are unaffected.
#
# The startup stall is TRANSIENT — it appears in windows of minutes and then
# clears — so retrying is the one response that actually recovers the run
# instead of merely reporting it well.
#
# Retried ONLY on 125. Not on 124: that run holds partial output which is the
# whole reason 124 is salvageable, and a retry would overwrite it. Not on any
# other non-zero exit either: a bad model or missing credentials fails
# identically every time, so retrying just burns the wait before the same error.
STARTUP_RETRIES="${AK_REVIEW_STARTUP_RETRIES:-2}"
RETRY_WAIT_SECS="${AK_REVIEW_RETRY_WAIT_SECS:-60}"
ATTEMPT=0

# Validated up front, because the alternative is worse than it looks: a
# non-numeric value reaches `sleep` (or the watchdog's) mid-run, fails under
# `set -e`, and aborts the adapter at a point where none of the diagnostics
# below have run — so the caller gets a bare non-zero exit and no reason.
for _var in AK_REVIEW_TIMEOUT_SECS AK_REVIEW_STARTUP_GRACE_SECS \
  AK_REVIEW_STARTUP_RETRIES AK_REVIEW_RETRY_WAIT_SECS; do
  _val="$(eval "printf '%s' \"\${${_var}:-}\"")"
  if [ -n "$_val" ] && ! printf '%s' "$_val" | grep -Eq '^[0-9]+$'; then
    echo "opencode-adapter.sh: ${_var} must be a non-negative integer (got: ${_val})" >&2
    exit 1
  fi
done

# A startup grace at or above the ceiling makes the two watchdogs race, and the
# loser's marker still gets written — which is how a genuine timeout could be
# reported as a startup stall. Ordering them is cheaper than disambiguating
# them afterwards.
if [ "$STARTUP_GRACE_SECS" -ge "$TIMEOUT_SECS" ]; then
  echo "opencode-adapter.sh: AK_REVIEW_STARTUP_GRACE_SECS (${STARTUP_GRACE_SECS}) must be below AK_REVIEW_TIMEOUT_SECS (${TIMEOUT_SECS}); the startup probe has to fire first to be meaningful." >&2
  exit 1
fi

while :; do
  ATTEMPT=$((ATTEMPT + 1))
  rm -f "$NEVER_STARTED_MARKER" "$TIMEOUT_MARKER"

  # `set -e` would abort before the exit code could be captured and the warning
  # emitted, so the invocation is deliberately guarded here instead.
  set +e
  if [ -n "$EFFORT" ]; then
    run_with_watchdog opencode run "$PROMPT_TEXT" --model "$MODEL" --variant "$EFFORT" \
      --format json --print-logs --log-level DEBUG
  else
    run_with_watchdog opencode run "$PROMPT_TEXT" --model "$MODEL" \
      --format json --print-logs --log-level DEBUG
  fi
  EXIT_CODE=$?
  set -e

  # Retry only a CONFIRMED empty stall. The marker alone is not enough: output
  # can land between the probe's empty check and the process actually dying
  # (a tool flushing on SIGTERM does exactly this), and the next attempt's `>`
  # redirection would truncate it. Worse, the run would then end as 125 with a
  # non-empty file — the opposite of what 125 promises the caller.
  [ -f "$NEVER_STARTED_MARKER" ] && [ ! -s "$RAW_OUTPUT_FILE" ] || break
  [ "$ATTEMPT" -le "$STARTUP_RETRIES" ] || break

  echo "opencode-adapter.sh: attempt ${ATTEMPT} stalled at startup (no output in ${STARTUP_GRACE_SECS}s); retrying in ${RETRY_WAIT_SECS}s - this failure is transient and usually clears." >&2
  sleep "$RETRY_WAIT_SECS"
done

# 124 is GNU timeout's convention, reused so a caller can branch on it without
# parsing text. Reported before the stderr dump below, because on a timeout the
# stderr file is usually empty and silence would read as "nothing happened".
#
# The never-started case is checked FIRST and reported as 125, not 124. Both are
# "it did not finish", but they need opposite advice: 124 has a partial stream
# worth salvaging, 125 has an empty file and nothing to recover. Telling the
# reader to run the salvage path on an empty stream sends them after output that
# cannot exist, which is how a whole day went into this.
if [ -f "$NEVER_STARTED_MARKER" ] && [ ! -s "$RAW_OUTPUT_FILE" ]; then
  rm -f "$NEVER_STARTED_MARKER" "$TIMEOUT_MARKER"
  EXIT_CODE=125
  echo "opencode-adapter.sh: STALLED AT STARTUP - opencode never produced any output within ${STARTUP_GRACE_SECS}s, across ${ATTEMPT} attempt(s), and was killed." >&2
  echo "opencode-adapter.sh: this is NOT a slow review. opencode did not get past creating its session, so the model was never called and there is nothing to salvage - $RAW_OUTPUT_FILE is empty." >&2
  echo "opencode-adapter.sh: this is a known, intermittent opencode failure (seen on 1.18.21), not a fault in the prompt or the model. It comes and goes in windows of minutes." >&2
  echo "opencode-adapter.sh: to diagnose, compare the tail of ~/.local/share/opencode/log/opencode.log against a healthy run: a good run logs 'init' then 'created id=ses_...'; a stalled one logs 'init' and stops. See also ${STDERR_FILE}." >&2
  echo "opencode-adapter.sh: retrying later usually works. Raise the grace period with AK_REVIEW_STARTUP_GRACE_SECS if this machine is simply slow to start." >&2
elif [ -f "$TIMEOUT_MARKER" ] || [ -f "$NEVER_STARTED_MARKER" ]; then
  # Either the ceiling fired, or the startup probe killed a run that turned out
  # to have produced output after all (it flushed while being signalled). Both
  # leave a partial stream, so both are 124 — the code that means "salvageable".
  rm -f "$TIMEOUT_MARKER" "$NEVER_STARTED_MARKER"
  EXIT_CODE=124
  echo "opencode-adapter.sh: TIMEOUT - opencode was killed after producing partial output." >&2
  echo "opencode-adapter.sh: the partial stream is at $RAW_OUTPUT_FILE - run the salvage path (opencode-extract-subagents.sh FIRST, then opencode-extract-report.sh, then opencode-extract-cost.sh)." >&2
elif [ "$EXIT_CODE" -eq 125 ]; then
  # 125 is reserved for the marker-confirmed startup stall above. opencode
  # exiting 125 on its own would otherwise reach the caller as "every attempt
  # stalled, nothing to salvage" — a specific, wrong story about an ordinary
  # tool failure. Remapped to a generic failure; its stderr is forwarded below
  # and carries the real reason.
  EXIT_CODE=1
  echo "opencode-adapter.sh: opencode exited 125 on its own. That code is reserved by this adapter for a startup stall, so it has been remapped to 1 to avoid a false 'never started' report. The tool's own error follows." >&2
fi

if [ -s "$STDERR_FILE" ]; then
  cat "$STDERR_FILE" >&2
fi

if grep -q "auto-rejecting" "$STDERR_FILE" 2> /dev/null; then
  echo "opencode-adapter.sh: WARNING - opencode denied one or more permissions; the review ran without full repository access. See $STDERR_FILE" >&2
fi

exit "$EXIT_CODE"
