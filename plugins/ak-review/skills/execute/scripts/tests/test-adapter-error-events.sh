#!/bin/bash
# Pins exit 126 — "the tool refused; retrying now is pointless".
#
# WHY: on 2026-08-31 a codex review ran 25 minutes and then hit the account's
# usage limit. The stream said so plainly:
#   {"type":"turn.failed","error":{"message":"You've hit your usage limit …"}}
# The adapter passed codex's exit 1 through unchanged, so the caller learned
# that something failed but never what — and the reserved codes had no entry for
# it. 124 means "timed out, salvage the partial stream" and 125 means "never
# started, try later"; a quota refusal is neither. Retrying is futile until the
# quota resets, which is a different instruction again.
#
# The exit code alone cannot carry this, but the stream can: every adapter's
# tool announces the refusal in its own event, and no adapter was reading it.
#
# Precedence: our own markers win. 124/125 record what THIS adapter did to the
# process and are therefore certain; an error event only describes what the tool
# reported, and a timed-out run may well contain both.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"
export PATH="$WORK/bin:$PATH"
export FAKE_ARGV_FILE="$WORK/argv.txt"
PROMPT="$WORK/p.md"; echo "review" > "$PROMPT"
fail() { echo "FAIL: $1"; exit 1; }

# A fake that emits a chosen stream and exits with a chosen code.
mk_fake() {
  cat > "$WORK/bin/$1" <<FAKE
#!/bin/bash
printf '%s\n' "\$@" > "\$FAKE_ARGV_FILE"
cat "$WORK/stream.jsonl"
exit \${FAKE_EXIT:-0}
FAKE
  chmod +x "$WORK/bin/$1"
}

run() { # tool, expected_exit, description
  local tool="$1" want="$2" desc="$3"
  local out="$WORK/$tool.jsonl" err="$WORK/$tool.err"
  set +e
  FAKE_EXIT="${FAKE_EXIT:-1}" bash "$DIR/../$tool-adapter.sh" "$PROMPT" some/model high "$out" 2> "$err"
  local ec=$?
  set -e
  [ "$ec" -eq "$want" ] || fail "$tool: $desc — expected $want, got $ec"
  echo "$err"
}

# --- codex: turn.failed ----------------------------------------------------
cat > "$WORK/stream.jsonl" <<'EOF'
{"type":"item.completed","item":{"type":"agent_message","text":"I'll start the review."}}
{"type":"turn.failed","error":{"message":"You've hit your usage limit. Try again at Sep 1st, 2026 1:12 AM."}}
EOF
mk_fake codex
ERR=$(run codex 126 "a quota refusal must be exit 126")
grep -qi "refused\|usage limit" "$ERR" || fail "codex: the tool's own reason must be surfaced"
grep -q "usage limit" "$ERR" || fail "codex: the verbatim message must reach the caller"
grep -qi "retry" "$ERR" || fail "codex: must say whether retrying helps"
echo "  ok: codex turn.failed -> 126"

# --- opencode: error event -------------------------------------------------
cat > "$WORK/stream.jsonl" <<'EOF'
{"type":"text","part":{"text":"Starting."}}
{"type":"error","error":{"name":"APIError","data":{"message":"Forbidden: model not enabled","statusCode":403}}}
EOF
mk_fake opencode
ERR=$(run opencode 126 "an API error must be exit 126")
grep -q "Forbidden" "$ERR" || fail "opencode: the tool's message must be surfaced"
echo "  ok: opencode error -> 126"

# --- claude: is_error result ----------------------------------------------
cat > "$WORK/stream.jsonl" <<'EOF'
{"type":"result","subtype":"error_max_budget_usd","is_error":true,"terminal_reason":"budget_exhausted","total_cost_usd":5.12,"usage":{},"result":null}
EOF
mk_fake claude
ERR=$(run claude 126 "budget exhaustion must be exit 126")
grep -q "BUDGET EXHAUSTED" "$ERR" || fail "claude: the budget message must survive"
echo "  ok: claude is_error -> 126"

# --- a clean run must NOT be mistaken for a refusal ------------------------
cat > "$WORK/stream.jsonl" <<'EOF'
{"type":"item.completed","item":{"type":"agent_message","text":"done"}}
{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1}}
EOF
mk_fake codex
FAKE_EXIT=0 ERR=$(run codex 0 "a successful run must stay 0")
grep -qi "refused" "$ERR" && fail "codex: a clean run must not claim a refusal"
echo "  ok: clean run unaffected"

# --- our own markers outrank an error event -------------------------------
# A timed-out run may well contain an error event too; 124 records what this
# adapter did and must win, or the salvage instruction is lost.
cat > "$WORK/bin/codex" <<'HANG'
#!/bin/bash
printf '%s\n' "$@" > "$FAKE_ARGV_FILE"
echo '{"type":"item.completed","item":{"type":"agent_message","text":"partial"}}'
echo '{"type":"turn.failed","error":{"message":"stream error"}}'
sleep 60
HANG
chmod +x "$WORK/bin/codex"
set +e
AK_REVIEW_TIMEOUT_SECS=2 bash "$DIR/../codex-adapter.sh" "$PROMPT" some/model high "$WORK/to.jsonl" 2> "$WORK/to.err"
EC=$?
set -e
[ "$EC" -eq 124 ] || fail "precedence: a timeout must stay 124 even with an error event present, got $EC"
echo "  ok: 124 outranks 126"

# --- opencode: a refusal that never reached the stream ---------------------
# Measured 2026-09-18: opencode-go answered with HTTP 429 `Account.GoUsageLimit`
# and a `retry-after` of 9541 s before the first token. stdout stayed empty, the
# process stayed alive, and the startup probe called it a transient stall — so
# the adapter burned two retries and then told the caller to come back soon,
# against a wall that stood for two and a half hours. 125 and 126 exist because
# they need OPPOSITE advice, and that run got the opposite one.
cat > "$WORK/bin/opencode" <<'REFUSE'
#!/bin/bash
echo 'ERROR service=session statusCode=429 Account.GoUsageLimit "Go usage limit exceeded" retry-after=9541' >&2
sleep 60
REFUSE
chmod +x "$WORK/bin/opencode"
set +e
AK_REVIEW_STARTUP_GRACE_SECS=1 AK_REVIEW_RETRY_WAIT_SECS=1 AK_REVIEW_TIMEOUT_SECS=30 \
  bash "$DIR/../opencode-adapter.sh" "$PROMPT" some/model "$WORK/refused.jsonl" 2> "$WORK/refused.err"
EC=$?
set -e
[ "$EC" -eq 126 ] || fail "opencode: a stderr-only refusal must be 126, not a startup stall, got $EC"
grep -qi "refused" "$WORK/refused.err" || fail "opencode: the refusal must be named as such"
grep -q "9541" "$WORK/refused.err" || fail "opencode: the tool's retry-after must reach the caller"
grep -qi "stalled at startup" "$WORK/refused.err" && fail "opencode: a refusal must not be retried as a stall"
echo "  ok: stderr-only refusal -> 126, no retries"

# The other direction, and the case that keeps the stderr check honest: a GENUINE
# startup stall is NOT quiet. The adapter runs opencode with `--print-logs
# --log-level DEBUG`, so a stalled run writes ordinary log traffic here — and an
# earlier version of this check matched a bare `429`, which those lines carry in
# timestamps (`…:41.429Z`) and durations (`+15429ms`). Verified against this
# machine's own logs: 56 such substrings, none of them a refusal. The fixture
# therefore reproduces that noise; a pattern loose enough to match it turns every
# stall into a false refusal, which is this fix inverted.
cat > "$WORK/bin/opencode" <<'STALL'
#!/bin/bash
echo 'timestamp=2026-09-18T15:02:41.429Z level=INFO run=3425765b message=init' >&2
echo 'INFO  2026-09-18T15:02:41 +15429ms service=server method=GET path=/config/providers' >&2
sleep 60
STALL
chmod +x "$WORK/bin/opencode"
set +e
AK_REVIEW_STARTUP_GRACE_SECS=1 AK_REVIEW_RETRY_WAIT_SECS=1 AK_REVIEW_TIMEOUT_SECS=30 \
  bash "$DIR/../opencode-adapter.sh" "$PROMPT" some/model "$WORK/stalled.jsonl" 2> "$WORK/stalled.err"
EC=$?
set -e
[ "$EC" -eq 125 ] || fail "opencode: a stall with ordinary log noise must still be 125, got $EC"
grep -qi "refused" "$WORK/stalled.err" && fail "opencode: log noise must not be read as a refusal"
[ "$(grep -c 'stalled at startup' "$WORK/stalled.err")" -eq 2 ] \
  || fail "opencode: a stall must still be retried twice"
echo "  ok: stall with log noise still 125, still retried"

echo "PASS: test-adapter-error-events.sh"
