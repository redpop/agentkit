#!/bin/bash
# Drives opencode-models.sh against a fake `opencode` on PATH, so the real CLI
# is never needed and the test stays free and offline.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../opencode-models.sh"

# Resolve bash NOW: a `PATH=... bash` invocation uses the modified PATH to find bash
# itself, so emptying PATH inline makes the shell unfindable (exit 127) and the script
# under test never runs.
BASH_BIN="$(command -v bash)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bin"

fail() { echo "FAIL: $1"; exit 1; }

# Case 1: the tool lists models -> passed through verbatim, exit 0.
cat > "$WORK/bin/opencode" <<'FAKE'
#!/bin/bash
printf 'provider-a/model-1\nprovider-b/model-2\n'
FAKE
chmod +x "$WORK/bin/opencode"
OUT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT")
[ "$OUT" = "provider-a/model-1
provider-b/model-2" ] || fail "case 1: model list was not passed through (got: $OUT)"

# Case 2: the tool fails -> exit non-zero, reason on stderr.
cat > "$WORK/bin/opencode" <<'FAKE'
#!/bin/bash
echo "boom" >&2
exit 3
FAKE
chmod +x "$WORK/bin/opencode"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 >/dev/null)
CODE=$?
set -e
[ "$CODE" -ne 0 ] || fail "case 2: a failing tool must not exit 0"
echo "$ERRTXT" | grep -q "opencode-models.sh" || fail "case 2: stderr should name the script"

# Case 3: the tool is not installed at all -> exit 1, actionable message.
set +e
ERRTXT=$(PATH="$WORK/empty" "$BASH_BIN" "$SCRIPT" 2>&1 >/dev/null)
CODE=$?
set -e
[ "$CODE" -eq 1 ] || fail "case 3: a missing binary must exit 1, got $CODE"
echo "$ERRTXT" | grep -qi "not found\|not installed" || fail "case 3: message should say the tool is missing"

echo "PASS: test-opencode-models.sh"
