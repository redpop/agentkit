#!/bin/bash
set -euo pipefail

if [ $# -lt 3 ] || [ $# -gt 4 ]; then
  echo "Usage: codex-adapter.sh <prompt-file> <model> [effort] <raw-output-file>" >&2
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
  echo "codex-adapter.sh: prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

# The ceiling is enforced HERE, not by the caller. See opencode-adapter.sh for
# the full account: an unattended caller may background the run and lose the
# timer with it. A killed run is not a lost run — the JSON stream is written by
# the OS as the run goes, so whatever codex had already emitted survives.
#
# Codex salvages far less than opencode does, though. opencode dispatches
# sub-agents whose finished results sit in the stream long before the merged
# report exists; codex emits its answer as a single agent_message at the very
# end. A codex run killed mid-flight usually has nothing to recover, and that
# is a real limitation of this adapter rather than a bug — SKILL.md says so.
TIMEOUT_SECS="${AK_REVIEW_TIMEOUT_SECS:-1200}"
TIMEOUT_MARKER="${RAW_OUTPUT_FILE}.timed-out"
rm -f "$TIMEOUT_MARKER"

STDERR_FILE="${RAW_OUTPUT_FILE}.stderr"

# Identical watchdog to opencode-adapter.sh, and deliberately so — it is the
# mechanism that adapter's hangs proved out. `set -m` is the load-bearing line:
# codex, like opencode, is several processes, and signalling only the direct
# child leaves the rest alive. Job control puts the child in its own process
# group so `kill -- -PID` reaches the whole tree. The marker file is touched
# BEFORE signalling, because the exit status alone cannot distinguish a watchdog
# kill from the tool dying on SIGTERM by itself (143 either way).
#
# stdin is redirected from the prompt file rather than inherited: it carries the
# prompt (see the `-` argument below), and an inherited stdin is also how a
# backgrounded run ends up blocking on input that never arrives.
run_with_watchdog() {
  local had_monitor=0
  case "$-" in *m*) had_monitor=1 ;; esac
  set -m
  "$@" < "$PROMPT_FILE" > "$RAW_OUTPUT_FILE" 2> "$STDERR_FILE" &
  local cmd_pid=$!

  # The watchdog is started while `set -m` is still in effect, so it gets its
  # OWN process group too — and is torn down by group below. This differs from
  # opencode-adapter.sh, deliberately, because that version leaks:
  # `kill -TERM "$watchdog_pid"` reaps the subshell but NOT the `sleep` it is
  # blocked in, which survives as an orphan holding whatever stdout it inherited.
  # Measured here: every completed run left a `sleep 1200` behind, and because
  # those orphans keep the caller's pipe open, a caller reading this adapter's
  # output through a pipe never sees EOF and hangs — for the full 20 minutes.
  #
  # Redirecting the subshell to /dev/null is the second half of the fix: it means
  # no watchdog process holds a descriptor on the caller's stdout in the first
  # place, so even an orphan that escapes the group kill cannot wedge a pipe.
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

# Why each flag:
#
#   --json               newline-delimited event stream; the only machine-readable mode.
#   --sandbox read-only  the external agent physically cannot edit the repository.
#                        delegate's contract is report-only, and this makes that
#                        structural instead of merely instructed. Never relax this:
#                        an unattended agent with write access to the working tree
#                        is precisely what this skill's design avoids.
#   --ignore-user-config the user's ~/.codex/config.toml pulls in MCP servers, hooks,
#                        plugins and skills. Measured on a real config: failing MCP
#                        auth handshakes, hook-timeout warnings, and "skill
#                        descriptions were shortened to fit the context budget" —
#                        i.e. the review's own context being crowded out by tooling
#                        irrelevant to it. Auth is unaffected; it resolves through
#                        CODEX_HOME independently of this flag.
#   -                    read the prompt from stdin. A delegate prompt carries project
#                        context and full diffs, which can approach ARG_MAX as an argv
#                        element; stdin has no such limit.
#
# `set -e` would abort before the exit code could be captured and stderr
# forwarded, so the invocation is deliberately guarded.
set +e
if [ -n "$EFFORT" ]; then
  # -c model_reasoning_effort=..., NOT --reasoning-effort: that flag was removed
  # in codex v0.50. Valid values, per the API's own enum: none, minimal, low,
  # medium, high, xhigh, max. (The "Ultra" shown in the interactive model picker
  # is not one of them.)
  run_with_watchdog codex exec --json --sandbox read-only --ignore-user-config \
    -m "$MODEL" -c "model_reasoning_effort=\"$EFFORT\"" -
else
  run_with_watchdog codex exec --json --sandbox read-only --ignore-user-config \
    -m "$MODEL" -
fi
EXIT_CODE=$?
set -e

# 124 is GNU timeout's convention, reused so a caller can branch on the code
# rather than parsing text. Reported before the stderr dump, because on a
# timeout stderr is usually empty and silence would read as "nothing happened".
if [ -f "$TIMEOUT_MARKER" ]; then
  rm -f "$TIMEOUT_MARKER"
  EXIT_CODE=124
  echo "codex-adapter.sh: TIMEOUT - codex exceeded ${TIMEOUT_SECS}s and was killed." >&2
  echo "codex-adapter.sh: the partial stream is at $RAW_OUTPUT_FILE - try codex-extract-report.sh and codex-extract-cost.sh, but expect little: codex emits its report as a single message at the end of the run, so a killed run usually has nothing to recover." >&2
fi

if [ -s "$STDERR_FILE" ]; then
  cat "$STDERR_FILE" >&2
fi

exit "$EXIT_CODE"
