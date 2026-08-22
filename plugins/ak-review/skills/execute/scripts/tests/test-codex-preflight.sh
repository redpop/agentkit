#!/bin/bash
# Drives codex-preflight.sh against a fake `codex` on PATH, so the real CLI and
# the user's real credentials are never touched.
#
# Contract: on PATH AND `codex login status` exits 0 -> exit 0. Anything else ->
# exit 1 with an actionable message.
#
# Case 3 is the important one. opencode's auth check was removed because it
# parsed decorated human output and wrongly blocked authenticated users; this
# check is only allowed to exist because it reads an exit code instead. Case 3
# pins that: the fake prints noisy ANSI-decorated text while exiting 0, and the
# script must still pass. If someone reintroduces text parsing here, it fails.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../codex-preflight.sh"
# Resolve bash before PATH is emptied — otherwise `PATH=... bash` cannot find
# bash itself and the script under test never runs (exit 127).
BASH_BIN="$(command -v bash)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"

fail() { echo "FAIL: $1"; exit 1; }

# $1 = exit code for `login status`, $2 = text it prints
write_fake() {
  cat > "$WORK/bin/codex" <<FAKE
#!/bin/bash
if [ "\$1" = "login" ] && [ "\$2" = "status" ]; then
  printf '%s\n' "$2"
  exit $1
fi
exit 0
FAKE
  chmod +x "$WORK/bin/codex"
}

# Case 1: not installed -> exit 1, message names the tool and the fix.
# $WORK/empty is intentionally never created; a nonexistent PATH entry is skipped.
set +e
ERRTXT=$(PATH="$WORK/empty" "$BASH_BIN" "$SCRIPT" 2>&1 > /dev/null)
CODE=$?
set -e
[ "$CODE" -eq 1 ] || fail "case 1: a missing binary must exit 1, got $CODE"
echo "$ERRTXT" | grep -qi "not found" || fail "case 1: message should say it is missing"

# Case 2: installed but unauthenticated -> exit 1, and the message must name the
# command that fixes it. An unattended run dies here, so the message is the only
# thing the user gets.
write_fake 1 "Not logged in"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 > /dev/null)
CODE=$?
set -e
[ "$CODE" -eq 1 ] || fail "case 2: an unauthenticated tool must exit 1, got $CODE"
echo "$ERRTXT" | grep -q "codex login" || fail "case 2: message must name \`codex login\` as the fix"

# Case 3: authenticated, but the output is ANSI-decorated garbage -> exit 0.
# The verdict must come from the exit code alone. This is the regression guard
# against reintroducing opencode's fatal output-parsing approach.
ESC=$(printf '\033')
DECORATED="${ESC}[?25l${ESC}[1mLogged${ESC}[0m ${ESC}[90min using ChatGPT${ESC}[0m"
write_fake 0 "$DECORATED"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 > /dev/null)
CODE=$?
set -e
[ "$CODE" -eq 0 ] || fail "case 3: an authenticated tool must exit 0 regardless of output decoration, got $CODE"
[ -z "$ERRTXT" ] || fail "case 3: a ready adapter must not emit stderr, got: $ERRTXT"

# Case 4: authenticated but printing NOTHING -> still exit 0. Belt and braces on
# the same rule: no output at all must not be mistaken for "not logged in".
write_fake 0 ""
set +e
PATH="$WORK/bin:$PATH" bash "$SCRIPT" > /dev/null 2>&1
CODE=$?
set -e
[ "$CODE" -eq 0 ] || fail "case 4: silent-but-exit-0 must pass, got $CODE"

echo "PASS: test-codex-preflight.sh"
