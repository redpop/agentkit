#!/bin/bash
# Is this adapter ready to run a review?
#
# Checks: Is `claude` on PATH?
#
# Does NOT check authentication, and that omission follows the rule the opencode
# adapter paid for: no auth check without a machine-readable signal. Claude Code
# offers no `login status` equivalent with a documented exit code the way codex
# does (see codex-preflight.sh, where the check IS justified), and parsing
# human-readable output to gate a run is precisely what wrongly hard-blocked
# correctly authenticated users before. An unauthenticated `claude` fails on its
# own, immediately and legibly, which costs nothing.
#
# Exit 0 = installed.
# Exit 1 = not installed, with the fix on stderr.
set -euo pipefail

if ! command -v claude > /dev/null 2>&1; then
  echo "claude-preflight.sh: \`claude\` not found on PATH." >&2
  echo "Install Claude Code from https://claude.com/claude-code, or point /ak-review:execute at a different tool with --tool." >&2
  exit 1
fi
