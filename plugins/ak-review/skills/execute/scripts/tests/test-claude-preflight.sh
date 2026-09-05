#!/bin/bash
# Drives claude-preflight.sh against a fake `claude` on PATH.
#
# Contract: on PATH and not provably logged out -> exit 0. Missing, or an explicit
# `"loggedIn": false` from `claude auth status` -> exit 1 with the fix on stderr.
#
# The auth check reads one boolean out of JSON; nothing human-readable gates the
# run, which is the line opencode's preflight crossed and paid for. The tolerance
# in the other direction matters just as much and is pinned by cases 3-5: being
# unable to answer the question must never be treated as answering it with "no".
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

# Case 2: installed and logged in -> exit 0, silent.
cat > "$WORK/bin/claude" <<'FAKE'
#!/bin/bash
[ "$1" = "auth" ] && { printf '{"loggedIn":true,"authMethod":"claude.ai"}\n'; exit 0; }
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

# Case 3: an explicit logged-out signal blocks, naming the command that fixes it.
# Without this the run proceeds and fails in a way that points elsewhere entirely:
# measured, an unauthenticated run exits 1 after 28 KB of stream with
# `subtype: "success"` and `total_cost_usd: 0`, and the report extractor then
# blames a usage limit, a timeout or a crash.
cat > "$WORK/bin/claude" <<'FAKE'
#!/bin/bash
[ "$1" = "auth" ] && { printf '{"loggedIn":false,"authMethod":"none"}\n'; exit 0; }
exit 0
FAKE
chmod +x "$WORK/bin/claude"
set +e
ERRTXT=$(PATH="$WORK/bin:$PATH" bash "$SCRIPT" 2>&1 > /dev/null)
CODE=$?
set -e
[ "$CODE" -eq 1 ] || fail "case 3: an explicit logged-out signal must exit 1, got $CODE"
echo "$ERRTXT" | grep -q "claude auth login" || fail "case 3: message must name the command that fixes it"

# Case 4: output that cannot be parsed must NOT block. A tool that changed its
# output, or has no `auth` subcommand at all, leaves the question unanswered --
# and an unanswered question is not a "no". Blocking here would repeat exactly
# the failure that removed opencode's auth check.
cat > "$WORK/bin/claude" <<'FAKE'
#!/bin/bash
[ "$1" = "auth" ] && { printf 'error: unknown command\n' >&2; exit 1; }
exit 0
FAKE
chmod +x "$WORK/bin/claude"
set +e
PATH="$WORK/bin:$PATH" bash "$SCRIPT" > /dev/null 2>&1
CODE=$?
set -e
[ "$CODE" -eq 0 ] || fail "case 4: unparseable auth output must not block, got $CODE"

# Case 5: valid JSON without a `loggedIn` key must not block either -- the same
# rule, for the likelier shape change.
cat > "$WORK/bin/claude" <<'FAKE'
#!/bin/bash
[ "$1" = "auth" ] && { printf '{"authMethod":"claude.ai"}\n'; exit 0; }
exit 0
FAKE
chmod +x "$WORK/bin/claude"
set +e
PATH="$WORK/bin:$PATH" bash "$SCRIPT" > /dev/null 2>&1
CODE=$?
set -e
[ "$CODE" -eq 0 ] || fail "case 5: a missing loggedIn key must not block, got $CODE"

echo "PASS: test-claude-preflight.sh"
