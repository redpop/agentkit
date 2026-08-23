#!/bin/bash
# Drives claude-preflight.sh against a fake `claude` on PATH.
#
# Contract: on PATH -> exit 0. Missing -> exit 1 with the fix on stderr.
# No authentication check, deliberately — Claude Code exposes no machine-readable
# login status the way codex does, and parsing human output to gate a run is the
# mistake opencode's preflight already paid for.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../claude-preflight.sh"
BASH_BIN="$(command -v bash)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"

fail() { echo "FAIL: $1"; exit 1; }

# Case 1: not installed -> exit 1, actionable message.
set +e
ERRTXT=$(PATH="$WORK/empty" "$BASH_BIN" "$SCRIPT" 2>&1 > /dev/null)
CODE=$?
set -e
[ "$CODE" -eq 1 ] || fail "case 1: a missing binary must exit 1, got $CODE"
echo "$ERRTXT" | grep -qi "not found" || fail "case 1: message should say it is missing"
echo "$ERRTXT" | grep -q -- "--tool" || fail "case 1: message should mention the escape hatch"

# Case 2: installed -> exit 0, silent, regardless of what it prints.
cat > "$WORK/bin/claude" <<'FAKE'
#!/bin/bash
printf 'irrelevant output\n'
exit 3
FAKE
chmod +x "$WORK/bin/claude"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 > /dev/null)
CODE=$?
set -e
[ "$CODE" -eq 0 ] || fail "case 2: an installed tool must exit 0, got $CODE"
[ -z "$ERRTXT" ] || fail "case 2: a ready adapter must not emit stderr, got: $ERRTXT"

echo "PASS: test-claude-preflight.sh"
