#!/bin/bash
# Drives opencode-preflight.sh against fake `opencode` on PATH.
#
# The new contract is simple: PATH check passes -> exit 0, regardless of what the tool
# prints. PATH check fails -> exit 1. No authentication check (see opencode-preflight.sh
# for why that decision was reversed).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../opencode-preflight.sh"
# Resolve bash NOW: a `PATH=... bash` invocation uses the modified PATH to find bash
# itself, so emptying PATH inline makes the shell unfindable (exit 127) and the script
# under test never runs. Only case 1 replaces PATH wholesale, so BASH_BIN was resolved
# before the replacement.
BASH_BIN="$(command -v bash)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"

fail() { echo "FAIL: $1"; exit 1; }

write_fake() {
  cat > "$WORK/bin/opencode" <<FAKE
#!/bin/bash
printf '%s\n' "$1"
FAKE
  chmod +x "$WORK/bin/opencode"
}

# Case 1: not installed -> exit 1, message names the tool and how to fix it.
# $WORK/empty is intentionally not created; a nonexistent PATH entry is silently skipped.
set +e
ERRTXT=$(PATH="$WORK/empty" "$BASH_BIN" "$SCRIPT" 2>&1 >/dev/null)
CODE=$?
set -e
[ "$CODE" -eq 1 ] || fail "case 1: a missing binary must exit 1, got $CODE"
echo "$ERRTXT" | grep -qi "not found\|not installed" || fail "case 1: message should say it is missing"

# Case 2: installed tool, arbitrary output -> exit 0.
# The tool is on PATH, so preflight passes. What the tool prints is irrelevant to the
# preflight check (that is handled by opencode itself). Emit decorated garbage to
# verify the script ignores it rather than parsing it.
ESC=$(printf '\033')
DECORATED_GARBAGE="${ESC}[?25l${ESC}[1m${ESC}[0m${ESC}[90mstrange stuff${ESC}[0m"
write_fake "$DECORATED_GARBAGE"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 >/dev/null)
CODE=$?
set -e
[ "$CODE" -eq 0 ] || fail "case 2: installed tool must exit 0 regardless of output, got $CODE"
[ -z "$ERRTXT" ] || fail "case 2: preflight should not emit stderr for an installed tool"

echo "PASS: test-opencode-preflight.sh"
