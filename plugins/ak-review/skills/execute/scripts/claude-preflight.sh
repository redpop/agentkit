#!/bin/bash
# Is this adapter ready to run a review?
#
# Checks: Is `claude` on PATH, and is it authenticated?
#
# The auth check obeys the rule the opencode adapter paid for -- no auth check
# without a machine-readable signal -- which Claude Code did not satisfy when
# this script was first written. It does now: `claude auth status` prints JSON
# with a boolean `loggedIn`, so nothing human-readable is parsed to reach the
# verdict, and the failure mode that once hard-blocked correctly authenticated
# users (an escape sequence surviving stripping and flipping the answer) has no
# way in.
#
# The check earns its place because the older comment here was wrong about the
# alternative: an unauthenticated run does NOT fail legibly. Measured, it exits
# 1 after writing 28 KB of stream, with `subtype: "success"`, `total_cost_usd: 0`
# and the authentication error as the assistant's own prose. The report
# extractor then reads that as a cut-short run and advises looking for a usage
# limit, a timeout or a crash -- three wrong places. The cost extractor reports
# USD 0.00, which reads as a run that was free rather than one that never
# happened.
#
# Deliberately tolerant: only an explicit `"loggedIn": false` blocks. A missing
# subcommand, unparseable output or any other surprise passes, because being
# unable to answer the question is not the same as answering it with "no" --
# that conflation is exactly what the opencode check got wrong.
#
# Exit 0 = installed, and not provably logged out.
# Exit 1 = not installed or definitely logged out, with the fix on stderr.
set -euo pipefail

if ! command -v claude > /dev/null 2>&1; then
  echo "claude-preflight.sh: \`claude\` not found on PATH." >&2
  echo "Install Claude Code from https://claude.com/claude-code, or point /ak-review:execute at a different tool with --tool." >&2
  exit 1
fi

if claude auth status 2> /dev/null | jq -e '.loggedIn == false' > /dev/null 2>&1; then
  echo "claude-preflight.sh: \`claude\` is installed but not authenticated." >&2
  echo "Run \`claude auth login\` and try again, or point /ak-review:execute at a different tool with --tool." >&2
  exit 1
fi
