#!/bin/bash
# Is this adapter ready to run a review?
#
# Exit 0 = ready, or not provably unready. Exit 1 = definitely not ready, with
# the fix on stderr. `execute` reads only the exit code.
#
# The strictness is deliberately uneven, because the failure modes are:
#   - not installed      -> certain, and the most common first-run failure
#   - zero credentials   -> certain when the signal is legible
#   - anything else      -> pass, and say so
#
# `opencode auth list` exits 0 whether or not credentials exist (measured), so
# only its human-readable output distinguishes the two — and that output is a
# TUI detail of an actively developed tool, not a contract. If it stops
# matching, blocking would make this skill unusable for a reason the user
# cannot see without reading this script; passing costs nothing, because
# opencode then fails instantly and legibly on its own. Hence fail open — but
# never silently.
set -euo pipefail

if ! command -v opencode > /dev/null 2>&1; then
  echo "opencode-preflight.sh: \`opencode\` not found on PATH." >&2
  echo "Install it from https://opencode.ai, or point /ak-review:execute at a different tool with --tool." >&2
  exit 1
fi

AUTH_OUTPUT=$(opencode auth list 2>&1 || true)

if echo "$AUTH_OUTPUT" | grep -qE '(^|[^0-9])0 credentials'; then
  echo "opencode-preflight.sh: opencode has no credentials configured." >&2
  echo "Run \`opencode auth login\` and try again." >&2
  exit 1
fi

if ! echo "$AUTH_OUTPUT" | grep -qE '[0-9]+ credentials'; then
  echo "opencode-preflight.sh: could not determine opencode's authentication state — continuing anyway." >&2
  echo "(The check reads \`opencode auth list\`; its output format may have changed. If the run fails to authenticate, that is why.)" >&2
fi
