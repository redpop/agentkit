#!/bin/bash
# Drives opencode-preflight.sh against a fake `opencode` on PATH.
#
# Case 4 is the load-bearing one: an auth signal the script cannot parse must
# NOT block. A wrong block makes the whole skill unusable for a cause the user
# cannot see; a wrong pass costs nothing, because opencode then fails instantly
# and legibly by itself.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../opencode-preflight.sh"
# Resolve bash NOW: a `PATH=... bash` invocation uses the modified PATH to find bash
# itself, so emptying PATH inline makes the shell unfindable (exit 127) and the script
# under test never runs.
BASH_BIN="$(command -v bash)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"
# $WORK/empty is intentionally not created; a nonexistent PATH entry is silently skipped.
# Only case 1 replaces PATH wholesale, so BASH_BIN was resolved before the replacement.

fail() { echo "FAIL: $1"; exit 1; }

write_fake() {
  cat > "$WORK/bin/opencode" <<FAKE
#!/bin/bash
printf '%s\n' "$1"
FAKE
  chmod +x "$WORK/bin/opencode"
}

# Case 1: not installed -> exit 1, message names the tool and how to fix it.
set +e
ERRTXT=$(PATH="$WORK/empty" "$BASH_BIN" "$SCRIPT" 2>&1 >/dev/null)
CODE=$?
set -e
[ "$CODE" -eq 1 ] || fail "case 1: a missing binary must exit 1, got $CODE"
echo "$ERRTXT" | grep -qi "not found\|not installed" || fail "case 1: message should say it is missing"

# Case 2: authenticated -> exit 0, no uncertainty claim on stderr.
write_fake "  2 credentials"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 >/dev/null)
CODE=$?
set -e
[ "$CODE" -eq 0 ] || fail "case 2: an authenticated tool must exit 0, got $CODE"
echo "$ERRTXT" | grep -qi "could not determine" && fail "case 2: must not claim uncertainty when the signal is clear"

# Case 3: clearly NOT authenticated -> exit 1, names the fix.
write_fake "  0 credentials"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 >/dev/null)
CODE=$?
set -e
[ "$CODE" -eq 1 ] || fail "case 3: zero credentials must exit 1, got $CODE"
echo "$ERRTXT" | grep -q "auth login" || fail "case 3: message should name the fix"

# Case 4: unparseable auth output -> exit 0 AND say so. Fail open, but visibly.
write_fake "some future format nobody planned for"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 >/dev/null)
CODE=$?
set -e
[ "$CODE" -eq 0 ] || fail "case 4: an unreadable auth signal must NOT block (got exit $CODE)"
echo "$ERRTXT" | grep -qi "could not determine" || fail "case 4: fail-open must be announced, not silent"

# Case 5: decorated zero credentials (ANSI escapes around/between digits) -> exit 1.
# This verifies the strict path survives decoration.
ESC=$(printf '\033')
DECORATED_ZERO="${ESC}[0m│  ${ESC}[1m0${ESC}[0m${ESC}[90m credentials${ESC}[0m"
write_fake "$DECORATED_ZERO"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 >/dev/null)
CODE=$?
set -e
[ "$CODE" -eq 1 ] || fail "case 5: decorated zero credentials must exit 1, got $CODE"
echo "$ERRTXT" | grep -q "auth login" || fail "case 5: message should name the fix"

# Case 6: decorated 10 credentials (digit-by-digit styling) -> exit 0.
# This verifies an authenticated user is not wrongly blocked by ANSI escapes.
DECORATED_TEN="${ESC}[1m1${ESC}[0m0 credentials"
write_fake "$DECORATED_TEN"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 >/dev/null)
CODE=$?
set -e
[ "$CODE" -eq 0 ] || fail "case 6: decorated 10 credentials must exit 0, got $CODE"
echo "$ERRTXT" | grep -qi "could not determine" && fail "case 6: authenticated user must not be blocked by decoration"

echo "PASS: test-opencode-preflight.sh"
