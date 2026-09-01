#!/bin/bash
# Exercises claude-adapter.sh against a fake `claude` on PATH, so the real
# (expensive) CLI is never called.
#
# Case 3 is the one that matters most. Read-only here rests on an ALLOWLIST,
# not on the permission mode — measured, not assumed: a probe run with
# `--permission-mode plan` alone successfully created a file. If the allowlist
# regresses, an unattended agent regains write access to the working tree.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../claude-adapter.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PROMPT="$WORK/prompt.md"
printf 'review this repository\n' > "$PROMPT"

mkdir -p "$WORK/bin"
cat > "$WORK/bin/claude" <<'FAKE'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
[ -n "${FAKE_STDOUT:-}" ] && echo "$FAKE_STDOUT"
[ -n "${FAKE_STDERR:-}" ] && echo "$FAKE_STDERR" >&2
exit "${FAKE_EXIT:-0}"
FAKE
chmod +x "$WORK/bin/claude"
export PATH="$WORK/bin:$PATH"
export FAKE_ARGV_FILE="$WORK/argv.txt"

fail() { echo "FAIL: $1"; exit 1; }
RESULT_OK='{"type":"result","subtype":"success","total_cost_usd":0.1,"usage":{"input_tokens":1,"output_tokens":2},"result":"ok","permission_denials":[]}'

# Case 1: 4-arg form. Effort reaches Claude Code as --effort, its own flag.
OUT="$WORK/case1.jsonl"
FAKE_STDOUT="$RESULT_OK" FAKE_EXIT=0 bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> /dev/null
grep -q '"type":"result"' "$OUT" || fail "case 1: stdout was not captured"
grep -qx -- "--effort" "$FAKE_ARGV_FILE" || fail "case 1: --effort was not passed"
grep -qx -- "xhigh" "$FAKE_ARGV_FILE" || fail "case 1: the effort value was not passed"
grep -qx -- "opus" "$FAKE_ARGV_FILE" || fail "case 1: the model was not passed"
grep -qx -- "review this repository" "$FAKE_ARGV_FILE" || fail "case 1: the prompt was not passed"

# Case 2: 3-arg form omits --effort rather than sending it empty, which Claude
# Code would reject as an invalid enum value.
OUT="$WORK/case2.jsonl"
FAKE_STDOUT="$RESULT_OK" FAKE_EXIT=0 bash "$SCRIPT" "$PROMPT" opus "$OUT" 2> /dev/null
grep -qx -- "--effort" "$FAKE_ARGV_FILE" && fail "case 2: --effort must be omitted in the 3-arg form"

# Case 3: the read-only contract. The allowlist must be present and must not
# contain a writing tool; the write tools must be explicitly denied; and the
# permission mode must never be one that grants edits.
grep -qx -- "--allowed-tools" "$FAKE_ARGV_FILE" || fail "case 3: --allowed-tools was not passed"
grep -qx -- "Read" "$FAKE_ARGV_FILE" || fail "case 3: Read is required for a review"
grep -qx -- "Task" "$FAKE_ARGV_FILE" || fail "case 3: Task is required for sub-agent dispatch"
grep -qx -- "--disallowed-tools" "$FAKE_ARGV_FILE" || fail "case 3: --disallowed-tools was not passed"
grep -qx -- "Write" "$FAKE_ARGV_FILE" || fail "case 3: Write must be denied"
grep -qx -- "Edit" "$FAKE_ARGV_FILE" || fail "case 3: Edit must be denied"
grep -qx -- "dontAsk" "$FAKE_ARGV_FILE" || fail "case 3: permission mode must be dontAsk (nothing may wait for a prompt)"
grep -qx -- "bypassPermissions" "$FAKE_ARGV_FILE" && fail "case 3: bypassPermissions must never be passed"
grep -qx -- "acceptEdits" "$FAKE_ARGV_FILE" && fail "case 3: acceptEdits must never be passed"
# Bash must be scoped to read-only git, never granted wholesale — an unrestricted
# Bash is a write path that no deny-list can close.
grep -qx -- "Bash" "$FAKE_ARGV_FILE" && fail "case 3: unrestricted Bash must never be allowed"
grep -q "Bash(git " "$FAKE_ARGV_FILE" || fail "case 3: scoped read-only git access is required"

# Case 4: sub-agent forwarding. Without it a killed run salvages nothing,
# because Claude Code merges sub-agents only at the end.
grep -qx -- "--forward-subagent-text" "$FAKE_ARGV_FILE" || fail "case 4: --forward-subagent-text was not passed"
grep -qx -- "stream-json" "$FAKE_ARGV_FILE" || fail "case 4: stream-json output format is required"

# Case 5: exit code propagation, and stderr surviving a failing run.
OUT="$WORK/case5.jsonl"
ERRTXT="$WORK/case5.err"
set +e
FAKE_STDOUT='' FAKE_EXIT=9 FAKE_STDERR='credit balance too low' \
  bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> "$ERRTXT"
EC=$?
set -e
[ "$EC" -eq 9 ] || fail "case 5: expected exit 9, got $EC"
grep -q "credit balance" "$ERRTXT" || fail "case 5: stderr was not forwarded"
grep -q "credit balance" "$OUT.stderr" || fail "case 5: stderr was not captured to the sidecar"

# Case 6: a denied permission is announced. Claude Code records denials and
# carries on, so a review that could not read what it needed still exits 0 —
# the same silent-failure shape opencode has, and it needs the same warning.
OUT="$WORK/case6.jsonl"
ERRTXT="$WORK/case6.err"
FAKE_STDOUT='{"type":"result","subtype":"success","total_cost_usd":0.1,"usage":{},"result":"ok","permission_denials":[{"tool":"Read"},{"tool":"Bash"}]}' \
  FAKE_EXIT=0 bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> "$ERRTXT"
grep -q "WARNING" "$ERRTXT" || fail "case 6: denied permissions must raise a warning"
grep -q "2 tool call" "$ERRTXT" || fail "case 6: the warning should state how many were denied"

# Case 7: a clean run raises no warning, so the warning stays meaningful.
OUT="$WORK/case7.jsonl"
ERRTXT="$WORK/case7.err"
FAKE_STDOUT="$RESULT_OK" FAKE_EXIT=0 bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> "$ERRTXT"
grep -q "WARNING" "$ERRTXT" && fail "case 7: a clean run must not warn"

# Case 8: the spend ceiling is ON by default at $5. This adapter is the most
# expensive by a wide margin and the only one whose tool can stop itself on
# cost, so an unattended run must not be able to bill open-endedly.
grep -qx -- "--max-budget-usd" "$FAKE_ARGV_FILE" || fail "case 8: the budget cap must be on by default"
grep -qx -- "5" "$FAKE_ARGV_FILE" || fail "case 8: the default cap should be 5"

# Case 8b: overridable, and removable with 'none' — not with 0, which would read
# as "zero dollars" and abort instantly.
OUT="$WORK/case8b.jsonl"
FAKE_STDOUT="$RESULT_OK" FAKE_EXIT=0 AK_REVIEW_MAX_BUDGET_USD=20 \
  bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> /dev/null
grep -qx -- "20" "$FAKE_ARGV_FILE" || fail "case 8b: an explicit budget was not passed"
FAKE_STDOUT="$RESULT_OK" FAKE_EXIT=0 AK_REVIEW_MAX_BUDGET_USD=none \
  bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> /dev/null
grep -qx -- "--max-budget-usd" "$FAKE_ARGV_FILE" && fail "case 8b: 'none' must remove the cap entirely"

# Case 8c: hitting the cap is explained, not left as a bare non-zero exit.
# Claude Code ends such a run with result:null, so without this the caller only
# learns that no report was found — never that the cap is the reason.
OUT="$WORK/case8c.jsonl"
ERRTXT="$WORK/case8c.err"
set +e
FAKE_EXIT=1 \
  FAKE_STDOUT='{"type":"result","subtype":"error_max_budget_usd","is_error":true,"terminal_reason":"budget_exhausted","total_cost_usd":5.12,"usage":{},"result":null}' \
  bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> "$ERRTXT"
BUDGET_EXIT=$?
set -e
# Budget exhaustion is the tool refusing to continue, which is exactly what 126
# means. It used to propagate the tool's bare 1, which told the caller nothing
# about whether retrying could help — here it cannot, until the cap is raised.
[ "$BUDGET_EXIT" -eq 126 ] || fail "case 8c: budget exhaustion must be exit 126 (tool refused), got $BUDGET_EXIT"
grep -q "BUDGET EXHAUSTED" "$ERRTXT" || fail "case 8c: hitting the cap must be reported explicitly"
grep -q "5.12" "$ERRTXT" || fail "case 8c: the actual spend should be named, not just the limit"
grep -q "AK_REVIEW_MAX_BUDGET_USD=none" "$ERRTXT" || fail "case 8c: the message must say how to lift the cap"
grep -q "claude-extract-subagents.sh" "$ERRTXT" || fail "case 8c: finished sub-agents are still salvageable and must be mentioned"

# Case 8e: a cap below the price of one turn cannot bind, and saying so is the
# point. Claude Code checks spend BETWEEN turns, so a run stops only once it has
# already gone over — measured, a $0.01 cap ended at $0.28 after turns=1. Such a
# cap buys nothing while looking like protection, so it is flagged rather than
# silently accepted. It is still allowed: stopping almost immediately is a
# legitimate thing to want.
OUT="$WORK/case8e.jsonl"
ERRTXT="$WORK/case8e.err"
FAKE_STDOUT="$RESULT_OK" FAKE_EXIT=0 AK_REVIEW_MAX_BUDGET_USD=0.01 \
  bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> "$ERRTXT"
grep -q "NOTE" "$ERRTXT" || fail "case 8e: a sub-\$1 cap must be flagged as unable to bind"
grep -qx -- "0.01" "$FAKE_ARGV_FILE" || fail "case 8e: the cap must still be passed through, not rejected"

# Case 8f: the default cap is above that threshold and must NOT be flagged,
# or the note becomes noise on every single run.
OUT="$WORK/case8f.jsonl"
ERRTXT="$WORK/case8f.err"
FAKE_STDOUT="$RESULT_OK" FAKE_EXIT=0 bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> "$ERRTXT"
grep -q "NOTE" "$ERRTXT" && fail "case 8f: the default cap must not trigger the sub-\$1 note"

# Case 8d: a normal run must NOT claim budget exhaustion.
OUT="$WORK/case8d.jsonl"
ERRTXT="$WORK/case8d.err"
FAKE_STDOUT="$RESULT_OK" FAKE_EXIT=0 bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> "$ERRTXT"
grep -q "BUDGET EXHAUSTED" "$ERRTXT" && fail "case 8d: a clean run must not report budget exhaustion"

# Case 9: argument and env validation.
set +e
bash "$SCRIPT" "$WORK/missing.md" opus xhigh "$WORK/c9.jsonl" 2> /dev/null
MISSING=$?
bash "$SCRIPT" only-one-arg 2> /dev/null
USAGE=$?
AK_REVIEW_MAX_BUDGET_USD="lots" bash "$SCRIPT" "$PROMPT" opus xhigh "$WORK/c9b.jsonl" 2> "$WORK/c9b.err"
BADENV=$?
set -e
[ "$MISSING" -eq 1 ] || fail "case 9: a missing prompt file must exit 1"
[ "$USAGE" -eq 1 ] || fail "case 9: a bad argument count must exit 1"
[ "$BADENV" -eq 1 ] || fail "case 9: a non-numeric budget must exit 1"
grep -q "AK_REVIEW_MAX_BUDGET_USD" "$WORK/c9b.err" || fail "case 9: the message must name the variable"

# Case 10: a hung run is killed at the ceiling, reported 124, partial stream
# kept, and the message points at the salvage path (claude HAS sub-agents).
OUT="$WORK/case10.jsonl"
ERRTXT="$WORK/case10.err"
cat > "$WORK/bin/claude" <<'HANG'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
echo '{"type":"assistant","parent_tool_use_id":"t1","message":{"content":[{"type":"text","text":"partial"}]}}'
sleep 60
HANG
chmod +x "$WORK/bin/claude"
START=$(date +%s)
set +e
AK_REVIEW_TIMEOUT_SECS=2 bash "$SCRIPT" "$PROMPT" opus xhigh "$OUT" 2> "$ERRTXT"
TEC=$?
set -e
[ "$TEC" -eq 124 ] || fail "case 10: expected 124 on timeout, got $TEC"
[ "$(( $(date +%s) - START ))" -lt 40 ] || fail "case 10: the watchdog did not fire"
grep -q "claude-extract-subagents.sh" "$ERRTXT" || fail "case 10: must point at the salvage path"
grep -q "partial" "$OUT" || fail "case 10: the partial stream was lost"
[ ! -f "$OUT.timed-out" ] || fail "case 10: the timeout marker was left behind"

echo "PASS: test-claude-adapter.sh"
