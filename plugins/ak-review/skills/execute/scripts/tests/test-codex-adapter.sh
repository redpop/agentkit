#!/bin/bash
# Exercises codex-adapter.sh against a fake `codex` on PATH, so the real (paid,
# authenticated) CLI is never called.
#
# Two things here are load-bearing and easy to break silently:
#   - the sandbox flag (case 5), which is what structurally guarantees the
#     external agent cannot edit code, and
#   - the prompt arriving on stdin (case 4), which is what keeps a large
#     delegate prompt from hitting ARG_MAX and what stops codex from blocking
#     on an inherited stdin.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../codex-adapter.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PROMPT="$WORK/prompt.md"
printf 'review this repository\n' > "$PROMPT"

# Fake `codex`: records argv and stdin, emits configured output, exits with the
# configured code.
mkdir -p "$WORK/bin"
cat > "$WORK/bin/codex" <<'FAKE'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
cat > "$FAKE_STDIN_FILE"
[ -n "${FAKE_STDOUT:-}" ] && echo "$FAKE_STDOUT"
[ -n "${FAKE_STDERR:-}" ] && echo "$FAKE_STDERR" >&2
exit "${FAKE_EXIT:-0}"
FAKE
chmod +x "$WORK/bin/codex"
export PATH="$WORK/bin:$PATH"
export FAKE_ARGV_FILE="$WORK/argv.txt"
export FAKE_STDIN_FILE="$WORK/stdin.txt"

fail() { echo "FAIL: $1"; exit 1; }

# Case 1: 4-arg form. The effort must reach codex as a -c config override --
# codex removed the --reasoning-effort flag in v0.50, so passing it as a flag
# would be silently wrong on every current version.
OUT="$WORK/case1.jsonl"
FAKE_STDOUT='{"type":"turn.completed"}' FAKE_STDERR='' FAKE_EXIT=0 \
  bash "$SCRIPT" "$PROMPT" gpt-5.6-sol high "$OUT" 2> /dev/null
grep -q '{"type":"turn.completed"}' "$OUT" || fail "case 1: stdout was not captured to the raw output file"
grep -qx -- 'model_reasoning_effort="high"' "$FAKE_ARGV_FILE" \
  || fail "case 1: effort was not passed as model_reasoning_effort. argv: $(tr '\n' ' ' < "$FAKE_ARGV_FILE")"
grep -qx -- "gpt-5.6-sol" "$FAKE_ARGV_FILE" || fail "case 1: the model was not passed"
grep -qx -- "--reasoning-effort" "$FAKE_ARGV_FILE" && fail "case 1: --reasoning-effort was removed in codex v0.50 and must not be used"

# Case 2: 3-arg form omits the effort override entirely rather than sending an
# empty one, which codex would reject as an invalid enum value.
OUT="$WORK/case2.jsonl"
FAKE_STDOUT='{"type":"turn.completed"}' FAKE_STDERR='' FAKE_EXIT=0 \
  bash "$SCRIPT" "$PROMPT" gpt-5.6-sol "$OUT" 2> /dev/null
grep -q "model_reasoning_effort" "$FAKE_ARGV_FILE" \
  && fail "case 2: the effort override must be omitted entirely in the 3-arg form"

# Case 3: codex's exit code is propagated, and a FAILING run still forwards its
# stderr. Under `set -euo pipefail` an unguarded call aborts at the invocation,
# producing the same exit code while skipping every diagnostic below it.
OUT="$WORK/case3.jsonl"
ERRTXT="$WORK/case3.err"
set +e
FAKE_STDOUT='' FAKE_EXIT=42 FAKE_STDERR='stream error: model unavailable' \
  bash "$SCRIPT" "$PROMPT" gpt-5.6-sol high "$OUT" 2> "$ERRTXT"
ACTUAL_EXIT=$?
set -e
[ "$ACTUAL_EXIT" -eq 42 ] || fail "case 3: expected exit 42, got $ACTUAL_EXIT"
grep -q "model unavailable" "$ERRTXT" || fail "case 3: stderr was not forwarded on a failing run"
grep -q "model unavailable" "$OUT.stderr" || fail "case 3: stderr was not captured to the sidecar file"

# Case 4: the prompt reaches codex on STDIN, with `-` as the prompt argument.
# Passing it as an argv element would risk ARG_MAX on a real delegate prompt
# (project context + diffs), and leaving stdin inherited can make codex block
# waiting for input that never comes.
OUT="$WORK/case4.jsonl"
FAKE_STDOUT='{"type":"turn.completed"}' FAKE_STDERR='' FAKE_EXIT=0 \
  bash "$SCRIPT" "$PROMPT" gpt-5.6-sol high "$OUT" 2> /dev/null
grep -q "review this repository" "$FAKE_STDIN_FILE" || fail "case 4: the prompt did not arrive on stdin"
grep -qx -- "-" "$FAKE_ARGV_FILE" || fail "case 4: '-' must be passed so codex reads the prompt from stdin"
grep -q "review this repository" "$FAKE_ARGV_FILE" && fail "case 4: the prompt must not be passed as an argv element"

# Case 5: the sandbox is read-only, always. This is the structural guarantee
# behind delegate's report-only contract -- the external agent physically cannot
# edit the repository, rather than merely being asked not to. A regression here
# would hand an unattended agent write access to the user's working tree.
grep -qx -- "read-only" "$FAKE_ARGV_FILE" || fail "case 5: --sandbox read-only was not passed"
grep -qx -- "danger-full-access" "$FAKE_ARGV_FILE" && fail "case 5: danger-full-access must never be passed"
grep -qx -- "workspace-write" "$FAKE_ARGV_FILE" && fail "case 5: workspace-write must never be passed"
grep -qx -- "--dangerously-bypass-approvals-and-sandbox" "$FAKE_ARGV_FILE" \
  && fail "case 5: the sandbox bypass must never be passed"

# Case 6: argument validation.
set +e
bash "$SCRIPT" "$WORK/missing.md" gpt-5.6-sol high "$WORK/case6.jsonl" 2> /dev/null
MISSING_EXIT=$?
bash "$SCRIPT" only-one-arg 2> /dev/null
USAGE_EXIT=$?
set -e
[ "$MISSING_EXIT" -eq 1 ] || fail "case 6: a missing prompt file must exit 1, got $MISSING_EXIT"
[ "$USAGE_EXIT" -eq 1 ] || fail "case 6: a bad argument count must exit 1, got $USAGE_EXIT"

# Case 7: a hung run is killed at the ceiling and reported as 124, and the
# message points at the codex salvage path. It must NOT name
# opencode-extract-subagents.sh: codex has no sub-agents, and sending a user
# after output that cannot exist wastes the one diagnostic they get.
OUT="$WORK/case7.jsonl"
ERRTXT="$WORK/case7.err"
cat > "$WORK/bin/codex" <<'HANG'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
cat > "$FAKE_STDIN_FILE"
echo '{"type":"item.completed","item":{"type":"agent_message","text":"partial"}}'
sleep 60
HANG
chmod +x "$WORK/bin/codex"

START=$(date +%s)
set +e
AK_REVIEW_TIMEOUT_SECS=2 bash "$SCRIPT" "$PROMPT" gpt-5.6-sol high "$OUT" 2> "$ERRTXT"
TIMEOUT_EXIT=$?
set -e
ELAPSED=$(( $(date +%s) - START ))

[ "$TIMEOUT_EXIT" -eq 124 ] || fail "case 7: expected exit 124 on timeout, got $TIMEOUT_EXIT"
[ "$ELAPSED" -lt 40 ] || fail "case 7: the watchdog did not kill the run (took ${ELAPSED}s)"
grep -q "TIMEOUT" "$ERRTXT" || fail "case 7: no timeout message was reported"
grep -q "codex-extract-report.sh" "$ERRTXT" || fail "case 7: the message must point at the codex salvage path"
grep -q "subagents" "$ERRTXT" && fail "case 7: codex has no sub-agents; the message must not mention them"
grep -q '"partial"' "$OUT" || fail "case 7: the partial stream was lost when the run was killed"
[ ! -f "$OUT.timed-out" ] || fail "case 7: the timeout marker file was left on disk"

# Case 8: a run finishing inside the ceiling is untouched by the watchdog.
cat > "$WORK/bin/codex" <<'FAKE2'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
cat > "$FAKE_STDIN_FILE"
[ -n "${FAKE_STDOUT:-}" ] && echo "$FAKE_STDOUT"
exit "${FAKE_EXIT:-0}"
FAKE2
chmod +x "$WORK/bin/codex"

OUT="$WORK/case8.jsonl"
ERRTXT="$WORK/case8.err"
START=$(date +%s)
FAKE_STDOUT='{"type":"turn.completed"}' FAKE_EXIT=0 \
  AK_REVIEW_TIMEOUT_SECS=30 bash "$SCRIPT" "$PROMPT" gpt-5.6-sol high "$OUT" 2> "$ERRTXT"
ELAPSED=$(( $(date +%s) - START ))
[ "$ELAPSED" -lt 10 ] || fail "case 8: the watchdog delayed a fast run by ${ELAPSED}s"
grep -q "TIMEOUT" "$ERRTXT" && fail "case 8: a run inside the ceiling must not report a timeout"

# Case 9: the timeout kills the whole process TREE. codex, like opencode, is not
# one process. See opencode-adapter.sh's `set -m` comment: without the group
# kill this case HANGS rather than failing, because a surviving grandchild holds
# the adapter's stdout open and the adapter never returns.
OUT="$WORK/case9.jsonl"
GRANDCHILD_PID_FILE="$WORK/case9.grandchild"
export GRANDCHILD_PID_FILE
cat > "$WORK/bin/codex" <<'TREE'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
cat > "$FAKE_STDIN_FILE"
echo '{"type":"item.completed"}'
sleep 120 &
echo $! > "$GRANDCHILD_PID_FILE"
wait
TREE
chmod +x "$WORK/bin/codex"

set +e
AK_REVIEW_TIMEOUT_SECS=2 bash "$SCRIPT" "$PROMPT" gpt-5.6-sol high "$OUT" 2> /dev/null
set -e
sleep 1
GRANDCHILD_PID="$(cat "$GRANDCHILD_PID_FILE" 2> /dev/null || echo "")"
[ -n "$GRANDCHILD_PID" ] || fail "case 9: the fake did not record its grandchild pid"
if kill -0 "$GRANDCHILD_PID" 2> /dev/null; then
  kill -KILL "$GRANDCHILD_PID" 2> /dev/null || true
  fail "case 9: a grandchild survived the timeout — the kill did not reach the process group"
fi

echo "PASS: test-codex-adapter.sh"
