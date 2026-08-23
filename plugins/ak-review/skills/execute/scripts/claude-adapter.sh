#!/bin/bash
set -euo pipefail

if [ $# -lt 3 ] || [ $# -gt 4 ]; then
  echo "Usage: claude-adapter.sh <prompt-file> <model> [effort] <raw-output-file>" >&2
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
  echo "claude-adapter.sh: prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

TIMEOUT_SECS="${AK_REVIEW_TIMEOUT_SECS:-1200}"
TIMEOUT_MARKER="${RAW_OUTPUT_FILE}.timed-out"
rm -f "$TIMEOUT_MARKER"

STDERR_FILE="${RAW_OUTPUT_FILE}.stderr"

if [ -n "${AK_REVIEW_TIMEOUT_SECS:-}" ] && ! printf '%s' "$AK_REVIEW_TIMEOUT_SECS" | grep -Eq '^[0-9]+$'; then
  echo "claude-adapter.sh: AK_REVIEW_TIMEOUT_SECS must be a non-negative integer (got: $AK_REVIEW_TIMEOUT_SECS)" >&2
  exit 1
fi
# Claude Code is the most expensive adapter by a wide margin, and the only one
# whose tool can stop itself on COST rather than on time. A ceiling is therefore
# on by default here: an unattended review that quietly runs up an open-ended
# bill is a worse failure than one that stops and says why.
#
# `none` removes the cap. `0` is deliberately not the way to do that — it would
# read as "zero dollars" and abort instantly, which is the opposite of what
# anyone typing it means.
MAX_BUDGET_USD="${AK_REVIEW_MAX_BUDGET_USD:-5}"

if [ "$MAX_BUDGET_USD" != "none" ] && ! printf '%s' "$MAX_BUDGET_USD" | grep -Eq '^[0-9]+(\.[0-9]+)?$'; then
  echo "claude-adapter.sh: AK_REVIEW_MAX_BUDGET_USD must be a number or 'none' (got: $MAX_BUDGET_USD)" >&2
  exit 1
fi

# THE CAP IS A CEILING, NOT A GUARANTEE, and the difference is worth stating
# because it is easy to assume otherwise. Claude Code checks spend BETWEEN
# turns, not before committing to one, so a run stops once it has already gone
# over — never before. The overshoot is bounded by the cost of a single turn,
# which for Opus with a real review prompt is on the order of a few hundred
# millidollars.
#
# Measured: a $0.01 cap ended a run at $0.28, having stopped after turns=1. That
# is not a 28x runaway, it is one turn — but a cap set below the price of one
# turn cannot bind at all, so it buys nothing while looking like protection.
# Warn rather than reject: a deliberately tiny cap is a legitimate way to make a
# run stop almost immediately, as long as nobody mistakes it for a hard limit.
if [ "$MAX_BUDGET_USD" != "none" ] && awk -v v="$MAX_BUDGET_USD" 'BEGIN{exit !(v < 1)}'; then
  echo "claude-adapter.sh: NOTE - a cap of \$${MAX_BUDGET_USD} is below the typical cost of a single Claude Code turn, so the run will almost certainly exceed it before it can stop (measured: a \$0.01 cap ended at \$0.28 after one turn). The cap bounds spend to roughly itself plus one turn, never to less." >&2
fi

# Same watchdog as the other two adapters, and deliberately identical: the
# ceiling belongs here rather than with the caller, because an unattended caller
# may background the run and lose the timer. `set -m` puts the child in its own
# process group so the kill reaches the whole tree; the watchdog gets its own
# group too and is torn down by group, which is what stops it leaking a `sleep`
# that would hold the caller's stdout open (see opencode-adapter.sh for the
# measurement behind that).
run_with_watchdog() {
  local had_monitor=0
  case "$-" in *m*) had_monitor=1 ;; esac
  set -m
  "$@" < /dev/null > "$RAW_OUTPUT_FILE" 2> "$STDERR_FILE" &
  local cmd_pid=$!

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

# Read-only is enforced by an ALLOWLIST, not by the permission mode, and that
# distinction was measured rather than assumed: with `--permission-mode plan`
# alone, a probe run successfully created a file. Plan mode governs how Claude
# Code *works*, not what it may touch.
#
# The allowlist is the contract. Only reading tools and four read-only git
# invocations are permitted, so there is no path to a write — not through the
# Write tool, and not through a shell command either, which is the hole a
# deny-list would leave open (`touch`, `>`, `sed -i`, … cannot be enumerated).
# Verified: with this set, the agent reports it has no permitted way to create a
# file, while `git log` and file reads work normally.
#
# `--permission-mode dontAsk` is what makes that workable unattended: there is
# nobody to prompt, so anything outside the allowlist must fail rather than
# wait. Plan mode is deliberately NOT used — it wants to write a plan file of
# its own, which the allowlist then blocks, producing a confusing complaint in
# the middle of the report.
CLAUDE_ARGS=(
  -p
  --output-format stream-json
  --verbose
  --permission-mode dontAsk
  --forward-subagent-text
  --allowed-tools Read Glob Grep Task WebFetch
  "Bash(git log:*)" "Bash(git diff:*)" "Bash(git show:*)" "Bash(git status:*)"
  --disallowed-tools Write Edit NotebookEdit
  --model "$MODEL"
)

# --forward-subagent-text is what puts sub-agent output into the stream at all.
# Without it a killed run salvages nothing, because Claude Code merges its
# sub-agents only at the end — the same failure mode opencode has, and the
# reason claude-extract-subagents.sh exists.

# Claude Code's own enum: low, medium, high, xhigh, max.
if [ -n "$EFFORT" ]; then
  CLAUDE_ARGS+=(--effort "$EFFORT")
fi

if [ "$MAX_BUDGET_USD" != "none" ]; then
  CLAUDE_ARGS+=(--max-budget-usd "$MAX_BUDGET_USD")
fi

# The prompt goes last as a positional argument. stdin is redirected from
# /dev/null in run_with_watchdog: an inherited stdin is how a backgrounded run
# ends up blocking on input that never arrives.
PROMPT_TEXT="$(cat "$PROMPT_FILE")"

set +e
run_with_watchdog claude "${CLAUDE_ARGS[@]}" "$PROMPT_TEXT"
EXIT_CODE=$?
set -e

if [ -f "$TIMEOUT_MARKER" ]; then
  rm -f "$TIMEOUT_MARKER"
  EXIT_CODE=124
  echo "claude-adapter.sh: TIMEOUT - claude exceeded ${TIMEOUT_SECS}s and was killed." >&2
  echo "claude-adapter.sh: the partial stream is at $RAW_OUTPUT_FILE - run the salvage path (claude-extract-subagents.sh FIRST, then claude-extract-report.sh, then claude-extract-cost.sh)." >&2
fi

if [ -s "$STDERR_FILE" ]; then
  cat "$STDERR_FILE" >&2
fi

# Budget exhaustion needs saying out loud. Claude Code ends the run with
# `terminal_reason: budget_exhausted` and `result: null` — no report at all — so
# without this the caller only learns that no report was found, never that the
# cap is why. Measured: the spend can overshoot the cap slightly before the run
# stops, so the figure reported here is the actual cost, not the limit.
if [ -s "$RAW_OUTPUT_FILE" ]; then
  BUDGET_STOP=$(jq -R 'fromjson? // empty' "$RAW_OUTPUT_FILE" 2> /dev/null \
    | jq -rs '[.[] | select(.type == "result")] | last
              | select(.terminal_reason == "budget_exhausted" or .subtype == "error_max_budget_usd")
              | (.total_cost_usd // 0) | tostring' 2> /dev/null || echo "")
  if [ -n "$BUDGET_STOP" ]; then
    echo "claude-adapter.sh: BUDGET EXHAUSTED - the run was stopped by the \$${MAX_BUDGET_USD} spend cap after \$${BUDGET_STOP}, so it produced no final report." >&2
    echo "claude-adapter.sh: this is a cost limit, not a failure of the review. Raise it with AK_REVIEW_MAX_BUDGET_USD, remove it with AK_REVIEW_MAX_BUDGET_USD=none, or review a smaller scope." >&2
    echo "claude-adapter.sh: any sub-agents that finished before the cap are still in $RAW_OUTPUT_FILE - claude-extract-subagents.sh recovers them." >&2
  fi
fi

# A denied permission does not fail the run: Claude Code records it and carries
# on, so a review that could not read what it needed still exits 0 with a
# confident-looking report. Same danger as opencode's silent auto-rejection,
# so it gets the same treatment — an explicit warning the caller cannot miss.
if [ -s "$RAW_OUTPUT_FILE" ]; then
  DENIALS=$(jq -R 'fromjson? // empty' "$RAW_OUTPUT_FILE" 2> /dev/null \
    | jq -rs '[.[] | select(.type == "result") | .permission_denials // []] | flatten | length' 2> /dev/null || echo 0)
  if [ "${DENIALS:-0}" -gt 0 ]; then
    echo "claude-adapter.sh: WARNING - claude was denied ${DENIALS} tool call(s); the review may have run without full repository access. Inspect the permission_denials array in $RAW_OUTPUT_FILE before trusting the report." >&2
  fi
fi

exit "$EXIT_CODE"
