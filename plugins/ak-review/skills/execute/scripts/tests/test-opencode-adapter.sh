#!/bin/bash
# Exercises opencode-adapter.sh against a fake `opencode` on PATH, so the real
# (paid, authenticated) CLI is never called. The exit-code capture this pins is
# a `set -euo pipefail` footgun: a naive `cmd; EXIT_CODE=$?` aborts before the
# capture, silently swallowing the tool's real exit code.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../opencode-adapter.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PROMPT="$WORK/prompt.md"
echo "review this" > "$PROMPT"

# Fake `opencode`: records its argv, emits the configured stdout/stderr, and
# exits with the configured code. Behaviour is driven by env vars so each case
# can reuse the same binary.
mkdir -p "$WORK/bin"
cat > "$WORK/bin/opencode" <<'FAKE'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
[ -n "${FAKE_STDOUT:-}" ] && echo "$FAKE_STDOUT"
[ -n "${FAKE_STDERR:-}" ] && echo "$FAKE_STDERR" >&2
exit "${FAKE_EXIT:-0}"
FAKE
chmod +x "$WORK/bin/opencode"
export PATH="$WORK/bin:$PATH"
export FAKE_ARGV_FILE="$WORK/argv.txt"

fail() {
  echo "FAIL: $1"
  exit 1
}

# Case 1: 4-arg form succeeds, stdout lands in the raw output file, and the
# effort is passed through as --variant.
OUT="$WORK/case1.jsonl"
FAKE_STDOUT='{"type":"text"}' FAKE_STDERR='' FAKE_EXIT=0 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> /dev/null
grep -q '{"type":"text"}' "$OUT" || fail "case 1: stdout was not captured to the raw output file"
grep -qx -- "--variant" "$FAKE_ARGV_FILE" || fail "case 1: --variant was not passed in the 4-arg form"
grep -qx -- "high" "$FAKE_ARGV_FILE" || fail "case 1: the effort value was not passed"
grep -qx -- "--auto" "$FAKE_ARGV_FILE" && fail "case 1: --auto must never be passed"

# Case 2: 3-arg form omits --variant entirely rather than passing it empty.
OUT="$WORK/case2.jsonl"
FAKE_STDOUT='{"type":"text"}' FAKE_STDERR='' FAKE_EXIT=0 \
  bash "$SCRIPT" "$PROMPT" some/model "$OUT" 2> /dev/null
grep -qx -- "--variant" "$FAKE_ARGV_FILE" && fail "case 2: --variant must be omitted in the 3-arg form"
grep -qx -- "--auto" "$FAKE_ARGV_FILE" && fail "case 2: --auto must never be passed"

# Case 3: opencode's exit code is propagated, not replaced by the adapter's own
# later commands.
OUT="$WORK/case3.jsonl"
set +e
FAKE_STDOUT='' FAKE_STDERR='' FAKE_EXIT=42 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> /dev/null
ACTUAL_EXIT=$?
set -e
[ "$ACTUAL_EXIT" -eq 42 ] || fail "case 3: expected exit 42 from opencode, got $ACTUAL_EXIT"

# Case 3b: a FAILING run still reports its stderr and its warning. This is what
# the `set +e` guard actually buys, and the exit code alone cannot prove it:
# under `set -euo pipefail` an unguarded failure aborts the script right at the
# opencode call, which yields the very same exit code while silently skipping
# every diagnostic below it. Mutation-tested — removing the guard turns this red.
OUT="$WORK/case3b.jsonl"
ERRTXT="$WORK/case3b.err"
set +e
FAKE_STDOUT='' FAKE_EXIT=7 \
  FAKE_STDERR='permission requested: external_directory (/somewhere); auto-rejecting' \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
FAILING_EXIT=$?
set -e
[ "$FAILING_EXIT" -eq 7 ] || fail "case 3b: expected exit 7, got $FAILING_EXIT"
grep -q "auto-rejecting" "$ERRTXT" || fail "case 3b: stderr was not forwarded on a failing run"
grep -q "WARNING" "$ERRTXT" || fail "case 3b: no warning was raised on a failing run"

# Case 4: a permission denial is written to the sidecar file AND announced as a
# warning — the failure mode this capture exists for, since opencode reports it
# only on stderr and still exits 0.
OUT="$WORK/case4.jsonl"
ERRTXT="$WORK/case4.err"
FAKE_STDOUT='{"type":"text"}' FAKE_EXIT=0 \
  FAKE_STDERR='permission requested: external_directory (/somewhere); auto-rejecting' \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
grep -q "auto-rejecting" "$OUT.stderr" || fail "case 4: stderr was not captured to the sidecar file"
grep -q "WARNING" "$ERRTXT" || fail "case 4: no warning was raised for a denied permission"

# Case 5: a clean run raises no warning (the warning must stay meaningful).
OUT="$WORK/case5.jsonl"
ERRTXT="$WORK/case5.err"
FAKE_STDOUT='{"type":"text"}' FAKE_STDERR='' FAKE_EXIT=0 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
grep -q "WARNING" "$ERRTXT" && fail "case 5: a clean run must not raise a permission warning"

# Case 6: the pre-existing argument-validation paths still exit 1.
set +e
bash "$SCRIPT" "$WORK/missing.md" some/model high "$WORK/case6.jsonl" 2> /dev/null
MISSING_EXIT=$?
bash "$SCRIPT" only-one-arg 2> /dev/null
USAGE_EXIT=$?
set -e
[ "$MISSING_EXIT" -eq 1 ] || fail "case 6: a missing prompt file must exit 1, got $MISSING_EXIT"
[ "$USAGE_EXIT" -eq 1 ] || fail "case 6: a bad argument count must exit 1, got $USAGE_EXIT"

# Case 7: a hung run is killed at the timeout and reported as 124.
# The fake sleeps far longer than the ceiling; AK_REVIEW_TIMEOUT_SECS keeps the
# test fast. 124 is GNU timeout's convention, so a caller can branch on the code
# instead of parsing the message.
OUT="$WORK/case7.jsonl"
ERRTXT="$WORK/case7.err"
cat > "$WORK/bin/opencode" <<'HANG'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
echo '{"type":"text","part":"partial"}'
sleep 60
HANG
chmod +x "$WORK/bin/opencode"

START=$(date +%s)
set +e
AK_REVIEW_TIMEOUT_SECS=2 AK_REVIEW_STARTUP_GRACE_SECS=1 bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
TIMEOUT_EXIT=$?
set -e
ELAPSED=$(( $(date +%s) - START ))

[ "$TIMEOUT_EXIT" -eq 124 ] || fail "case 7: expected exit 124 on timeout, got $TIMEOUT_EXIT"
[ "$ELAPSED" -lt 30 ] || fail "case 7: the watchdog did not kill the run (took ${ELAPSED}s)"
grep -q "TIMEOUT" "$ERRTXT" || fail "case 7: no timeout message was reported"
grep -q "opencode-extract-subagents.sh" "$ERRTXT" || fail "case 7: the message must point at the salvage path"
# The partial stream must survive the kill — the whole reason salvage works.
grep -q '"partial"' "$OUT" || fail "case 7: the partial stream was lost when the run was killed"
# The marker is internal bookkeeping and must not be left behind.
[ ! -f "$OUT.timed-out" ] || fail "case 7: the timeout marker file was left on disk"

# Case 8: a run that finishes inside the ceiling is untouched by the watchdog —
# it must not add latency, and must not claim a timeout.
cat > "$WORK/bin/opencode" <<'FAKE2'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
[ -n "${FAKE_STDOUT:-}" ] && echo "$FAKE_STDOUT"
[ -n "${FAKE_STDERR:-}" ] && echo "$FAKE_STDERR" >&2
exit "${FAKE_EXIT:-0}"
FAKE2
chmod +x "$WORK/bin/opencode"

OUT="$WORK/case8.jsonl"
ERRTXT="$WORK/case8.err"
START=$(date +%s)
FAKE_STDOUT='{"type":"text"}' FAKE_STDERR='' FAKE_EXIT=0 \
  AK_REVIEW_TIMEOUT_SECS=30 AK_REVIEW_STARTUP_GRACE_SECS=20 bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
ELAPSED=$(( $(date +%s) - START ))
[ "$ELAPSED" -lt 10 ] || fail "case 8: the watchdog delayed a fast run by ${ELAPSED}s"
grep -q "TIMEOUT" "$ERRTXT" && fail "case 8: a run inside the ceiling must not report a timeout"
grep -q '{"type":"text"}' "$OUT" || fail "case 8: stdout was not captured"

# Case 9: the timeout kills the whole process TREE, not just the direct child.
# This is what `set -m` + `kill -- -PID` buys. opencode spawns several processes;
# signalling only the child leaves the rest running, which is exactly what
# happened on the hung run this watchdog was written for. The fake stands in for
# that shape: a wrapper whose grandchild outlives a naive kill.
#
# Mutation note: removing `set -m` or the group kill does NOT turn this red — it
# makes the case HANG, because the surviving grandchild holds the adapter's
# inherited stdout open and `bash "$SCRIPT"` never returns. That is an ugly
# failure signal but an honest one, and it is the strongest evidence for the
# fix: without the group kill the adapter itself does not come back. Do not
# "fix" the hang by narrowing the kill.
OUT="$WORK/case9.jsonl"
GRANDCHILD_PID_FILE="$WORK/case9.grandchild"
cat > "$WORK/bin/opencode" <<'TREE'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
echo '{"type":"text","part":"partial"}'
sleep 120 &
echo $! > "$GRANDCHILD_PID_FILE"
wait
TREE
chmod +x "$WORK/bin/opencode"
export GRANDCHILD_PID_FILE

set +e
AK_REVIEW_TIMEOUT_SECS=2 AK_REVIEW_STARTUP_GRACE_SECS=1 bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> /dev/null
set -e
sleep 1
GRANDCHILD_PID="$(cat "$GRANDCHILD_PID_FILE" 2> /dev/null || echo "")"
[ -n "$GRANDCHILD_PID" ] || fail "case 9: the fake did not record its grandchild pid"
if kill -0 "$GRANDCHILD_PID" 2> /dev/null; then
  kill -KILL "$GRANDCHILD_PID" 2> /dev/null || true
  fail "case 9: a grandchild survived the timeout — the kill did not reach the process group"
fi

# ---------------------------------------------------------------------------
# Cases 10-12 cover the ZERO-BYTE stall, which is a different failure from the
# mid-run hang above and was previously indistinguishable from it.
#
# Measured on opencode 1.18.21: `opencode run` intermittently produces no bytes
# at all and never returns. The comparison that localises it is in the tool's
# own log (~/.local/share/opencode/log/opencode.log): a healthy run logs
# `init` then immediately `created id=ses_...`; a stalled run logs `init` and
# nothing further. So it dies during SESSION CREATION — before the first event,
# before the model is ever called.
#
# That distinction matters to the caller: a run that never started has nothing
# to salvage, while a run that stopped after 300 events has plenty. Reporting
# both as "TIMEOUT — run the salvage path" sent the reader after output that
# cannot exist.
# ---------------------------------------------------------------------------

# Case 10: no bytes within the startup grace -> exit 125, killed early.
# The fake never writes anything, mimicking the stall exactly.
OUT="$WORK/case10.jsonl"
ERRTXT="$WORK/case10.err"
cat > "$WORK/bin/opencode" <<'SILENT'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
sleep 120
SILENT
chmod +x "$WORK/bin/opencode"

START=$(date +%s)
set +e
# Retries off: this case pins the SINGLE-attempt behaviour. Retry itself is
# covered by cases 13-16, and leaving the default on here would just add the
# retry waits to the measured elapsed time.
AK_REVIEW_STARTUP_GRACE_SECS=3 AK_REVIEW_TIMEOUT_SECS=120 AK_REVIEW_STARTUP_RETRIES=0 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
SILENT_EXIT=$?
set -e
ELAPSED=$(( $(date +%s) - START ))

[ "$SILENT_EXIT" -eq 125 ] || fail "case 10: a zero-byte stall must exit 125 (not 124), got $SILENT_EXIT"
# The whole point is not burning the full ceiling: 120s ceiling, 3s grace.
[ "$ELAPSED" -lt 40 ] || fail "case 10: the startup probe did not fire early (took ${ELAPSED}s of a 120s ceiling)"
grep -qi "never produced any output" "$ERRTXT" || fail "case 10: message must say the run produced nothing"
# Must NOT send the reader to the salvage path — there is nothing to salvage.
grep -q "opencode-extract-subagents.sh" "$ERRTXT" && fail "case 10: a zero-byte stall has nothing to salvage; must not point at the salvage path"
# Must name the tool's own log, which carries more than stderr does.
grep -q "opencode.log" "$ERRTXT" || fail "case 10: message must point at opencode's own log file"
[ ! -f "$OUT.never-started" ] || fail "case 10: the startup marker file was left on disk"

# Case 11: output arrives quickly, THEN the run hangs -> still 124, still the
# salvage path. This is the regression guard proving the startup probe does not
# swallow the mid-run case: the fake emits one event immediately, then sleeps
# past a startup grace that is deliberately shorter than the sleep.
OUT="$WORK/case11.jsonl"
ERRTXT="$WORK/case11.err"
cat > "$WORK/bin/opencode" <<'LATEHANG'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
echo '{"type":"text","part":"early"}'
sleep 60
LATEHANG
chmod +x "$WORK/bin/opencode"

set +e
AK_REVIEW_STARTUP_GRACE_SECS=3 AK_REVIEW_TIMEOUT_SECS=6 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
LATE_EXIT=$?
set -e
[ "$LATE_EXIT" -eq 124 ] || fail "case 11: a run that produced output then hung must exit 124, got $LATE_EXIT"
grep -q "opencode-extract-subagents.sh" "$ERRTXT" || fail "case 11: a mid-run hang must still point at the salvage path"
grep -qi "never produced any output" "$ERRTXT" && fail "case 11: a run that DID produce output must not claim it produced none"
grep -q '"early"' "$OUT" || fail "case 11: the partial stream was lost"

# Case 12: diagnostics are captured. opencode writes far more to its own log
# than to stderr, and on a stall stderr is empty — which reads as "nothing went
# wrong" when in fact nothing happened. The adapter must ask for logs.
OUT="$WORK/case12.jsonl"
cat > "$WORK/bin/opencode" <<'FAKE3'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
echo '{"type":"text"}'
FAKE3
chmod +x "$WORK/bin/opencode"
bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> /dev/null
grep -qx -- "--print-logs" "$FAKE_ARGV_FILE" || fail "case 12: --print-logs was not passed"
grep -qx -- "--log-level" "$FAKE_ARGV_FILE" || fail "case 12: --log-level was not passed"

# ---------------------------------------------------------------------------
# Cases 13-16: automatic retry of the startup stall.
#
# The stall is TRANSIENT — it comes in windows of minutes and then clears — so
# a retry is the one response that actually recovers the run rather than just
# reporting it better. Retrying is therefore correct for exit 125 and WRONG for
# everything else: a 124 already holds salvageable partial output that a retry
# would overwrite, and a plain non-zero exit (bad model, no credentials) is
# deterministic and would fail identically every time while burning the wait.
# ---------------------------------------------------------------------------

# A fake that stalls on its first N invocations and succeeds afterwards, using a
# counter file that survives across the adapter's retries.
COUNTER="$WORK/attempts.txt"
cat > "$WORK/bin/opencode" <<'FLAKY'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
n=$(cat "$COUNTER" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "$COUNTER"
if [ "$n" -le "${FAKE_STALL_TIMES:-0}" ]; then sleep 120; fi
echo '{"type":"text","part":"recovered"}'
FLAKY
chmod +x "$WORK/bin/opencode"
export COUNTER

# Case 13: stalls once, then succeeds -> the adapter recovers, exit 0.
echo 0 > "$COUNTER"
OUT="$WORK/case13.jsonl"
ERRTXT="$WORK/case13.err"
set +e
FAKE_STALL_TIMES=1 AK_REVIEW_STARTUP_GRACE_SECS=3 AK_REVIEW_STARTUP_RETRIES=2 \
  AK_REVIEW_RETRY_WAIT_SECS=1 AK_REVIEW_TIMEOUT_SECS=60 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
RETRY_EXIT=$?
set -e
[ "$RETRY_EXIT" -eq 0 ] || fail "case 13: a stall that clears on retry must succeed, got $RETRY_EXIT"
grep -q '"recovered"' "$OUT" || fail "case 13: the successful attempt's output was not captured"
grep -qi "retrying" "$ERRTXT" || fail "case 13: the retry must be announced on stderr"
[ "$(cat "$COUNTER")" -eq 2 ] || fail "case 13: expected exactly 2 attempts, got $(cat "$COUNTER")"

# Case 14: stalls every time -> exhausts retries, exits 125, says how many tries.
echo 0 > "$COUNTER"
OUT="$WORK/case14.jsonl"
ERRTXT="$WORK/case14.err"
set +e
FAKE_STALL_TIMES=99 AK_REVIEW_STARTUP_GRACE_SECS=3 AK_REVIEW_STARTUP_RETRIES=2 \
  AK_REVIEW_RETRY_WAIT_SECS=1 AK_REVIEW_TIMEOUT_SECS=60 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
EXHAUST_EXIT=$?
set -e
[ "$EXHAUST_EXIT" -eq 125 ] || fail "case 14: exhausted retries must still exit 125, got $EXHAUST_EXIT"
[ "$(cat "$COUNTER")" -eq 3 ] || fail "case 14: expected 3 attempts (1 + 2 retries), got $(cat "$COUNTER")"
grep -q "3 attempt" "$ERRTXT" || fail "case 14: the message must state how many attempts were made"

# Case 15: retries can be disabled, and then there is exactly one attempt.
echo 0 > "$COUNTER"
OUT="$WORK/case15.jsonl"
set +e
FAKE_STALL_TIMES=99 AK_REVIEW_STARTUP_GRACE_SECS=3 AK_REVIEW_STARTUP_RETRIES=0 \
  AK_REVIEW_RETRY_WAIT_SECS=1 AK_REVIEW_TIMEOUT_SECS=60 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> /dev/null
set -e
[ "$(cat "$COUNTER")" -eq 1 ] || fail "case 15: retries=0 must mean one attempt, got $(cat "$COUNTER")"

# Case 16: a mid-run hang (124) is NOT retried. Retrying would overwrite the
# partial stream that makes 124 salvageable in the first place.
echo 0 > "$COUNTER"
OUT="$WORK/case16.jsonl"
ERRTXT="$WORK/case16.err"
cat > "$WORK/bin/opencode" <<'MIDHANG'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
n=$(cat "$COUNTER" 2>/dev/null || echo 0); echo "$((n + 1))" > "$COUNTER"
echo '{"type":"text","part":"partial"}'
sleep 60
MIDHANG
chmod +x "$WORK/bin/opencode"
set +e
AK_REVIEW_STARTUP_GRACE_SECS=2 AK_REVIEW_STARTUP_RETRIES=3 \
  AK_REVIEW_RETRY_WAIT_SECS=1 AK_REVIEW_TIMEOUT_SECS=5 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
MID_EXIT=$?
set -e
[ "$MID_EXIT" -eq 124 ] || fail "case 16: a mid-run hang must exit 124, got $MID_EXIT"
[ "$(cat "$COUNTER")" -eq 1 ] || fail "case 16: a 124 must NOT be retried, got $(cat "$COUNTER") attempts"
grep -q '"partial"' "$OUT" || fail "case 16: the salvageable partial stream was lost"

# ---------------------------------------------------------------------------
# Cases 17-20 come from an external review of the retry commit. Each pins a way
# the reserved exit codes could lie to the caller.
# ---------------------------------------------------------------------------

# Case 17: opencode's OWN exit 125 must not be reported as a startup stall.
# 125 is reserved for the marker-confirmed condition. A markerless 125 from the
# tool would otherwise reach the caller as "every attempt stalled", which
# SKILL.md tells them means an empty stream and nothing to salvage — while the
# real cause was an ordinary tool failure. Remapped to 1, with stderr kept.
echo 0 > "$COUNTER"
OUT="$WORK/case17.jsonl"
ERRTXT="$WORK/case17.err"
cat > "$WORK/bin/opencode" <<'OWN125'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
n=$(cat "$COUNTER" 2>/dev/null || echo 0); echo "$((n + 1))" > "$COUNTER"
echo "opencode: something went wrong" >&2
exit 125
OWN125
chmod +x "$WORK/bin/opencode"
set +e
AK_REVIEW_STARTUP_GRACE_SECS=30 AK_REVIEW_STARTUP_RETRIES=2 AK_REVIEW_RETRY_WAIT_SECS=1 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
OWN125_EXIT=$?
set -e
[ "$OWN125_EXIT" -ne 125 ] || fail "case 17: a tool-originated 125 must not be reported as a startup stall"
[ "$(cat "$COUNTER")" -eq 1 ] || fail "case 17: a tool-originated 125 must not be retried, got $(cat "$COUNTER") attempts"
grep -qi "never produced any output" "$ERRTXT" && fail "case 17: must not claim a startup stall"
grep -q "something went wrong" "$ERRTXT" || fail "case 17: the tool's own stderr must survive the remap"

# Case 18: a deterministic failure is not retried. A bad model or missing
# credentials fails identically every time, so a retry only burns the wait.
# The commit message states this; nothing pinned it until now.
echo 0 > "$COUNTER"
OUT="$WORK/case18.jsonl"
cat > "$WORK/bin/opencode" <<'DETERM'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
n=$(cat "$COUNTER" 2>/dev/null || echo 0); echo "$((n + 1))" > "$COUNTER"
echo "unknown model" >&2
exit 7
DETERM
chmod +x "$WORK/bin/opencode"
set +e
AK_REVIEW_STARTUP_GRACE_SECS=30 AK_REVIEW_STARTUP_RETRIES=3 AK_REVIEW_RETRY_WAIT_SECS=1 \
  bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> /dev/null
DETERM_EXIT=$?
set -e
[ "$DETERM_EXIT" -eq 7 ] || fail "case 18: a deterministic failure must propagate its own code, got $DETERM_EXIT"
[ "$(cat "$COUNTER")" -eq 1 ] || fail "case 18: a deterministic failure must not be retried, got $(cat "$COUNTER") attempts"

# Case 19: output that lands late — after the startup probe's empty check, while
# the process is being signalled — must not be thrown away. Exiting 125 with a
# NON-EMPTY raw file would contradict the contract that 125 means nothing to
# salvage. The fake emits on SIGTERM, exactly reproducing that race.
echo 0 > "$COUNTER"
OUT="$WORK/case19.jsonl"
ERRTXT="$WORK/case19.err"
cat > "$WORK/bin/opencode" <<'LATE'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
n=$(cat "$COUNTER" 2>/dev/null || echo 0); echo "$((n + 1))" > "$COUNTER"
trap 'echo "{\"type\":\"text\",\"part\":\"late\"}"; exit 0' TERM
sleep 120 &
wait
LATE
chmod +x "$WORK/bin/opencode"
set +e
AK_REVIEW_STARTUP_GRACE_SECS=2 AK_REVIEW_STARTUP_RETRIES=2 AK_REVIEW_RETRY_WAIT_SECS=1 \
  AK_REVIEW_TIMEOUT_SECS=60 bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
LATE_EXIT=$?
set -e
if [ -s "$OUT" ]; then
  [ "$LATE_EXIT" -ne 125 ] || fail "case 19: exit 125 claims nothing to salvage, but the raw file is not empty"
  grep -q '"late"' "$OUT" || fail "case 19: late output was overwritten by a retry"
fi

# Case 20: a non-numeric env value is rejected up front with a clear message,
# rather than aborting mid-run at `sleep` under `set -e` — where the failure
# would surface with no diagnostic at all.
OUT="$WORK/case20.jsonl"
ERRTXT="$WORK/case20.err"
set +e
AK_REVIEW_RETRY_WAIT_SECS="soon" bash "$SCRIPT" "$PROMPT" some/model high "$OUT" 2> "$ERRTXT"
BADENV_EXIT=$?
set -e
[ "$BADENV_EXIT" -eq 1 ] || fail "case 20: a non-numeric env value must exit 1, got $BADENV_EXIT"
grep -q "AK_REVIEW_RETRY_WAIT_SECS" "$ERRTXT" || fail "case 20: the message must name the offending variable"

echo "PASS: test-opencode-adapter.sh"
