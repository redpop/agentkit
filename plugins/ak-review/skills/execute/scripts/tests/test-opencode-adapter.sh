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

echo "PASS: test-opencode-adapter.sh"
