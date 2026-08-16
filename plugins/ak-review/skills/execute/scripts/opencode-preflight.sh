#!/bin/bash
# Is this adapter ready to run a review?
#
# Checks: Is `opencode` on PATH?
#
# Does NOT check: Whether opencode is authenticated. An unauthenticated opencode fails
# instantly and legibly ("no credentials" message from the tool itself), and the cost of
# that failure is exactly zero. Our goal was to make that message marginally nicer, but the
# auth check itself proved worse: it parses human-readable TUI output to make a gating
# decision, and that output is an implementation detail of an actively developed tool,
# not a contract.
#
# What happened: three rounds of attempted pattern fixes (narrow CSI, full ECMA-48,
# then wider still) each fixed one escape class but exposed another — OSC sequences,
# single-char escapes, etc. The failure mode was the same every time: an unrecognised
# escape survives stripping, sits between digits of a multi-digit credential count,
# and the leftover byte matches the zero-credentials pattern. Result: a correctly
# authenticated user is hard-blocked by a false claim, diagnosable only by reading
# this script. That is the opposite of the failure it existed to prevent.
#
# Parsing is unbounded — there is no finite list of escape classes to enumerate.
# The only escape from the whack-a-mole is to not play: remove the auth check entirely.
#
# Exit 0 = PATH check passed (tool is installed).
# Exit 1 = PATH check failed (tool is missing or not found on PATH).
#
set -euo pipefail

if ! command -v opencode > /dev/null 2>&1; then
  echo "opencode-preflight.sh: \`opencode\` not found on PATH." >&2
  echo "Install it from https://opencode.ai, or point /ak-review:execute at a different tool with --tool." >&2
  exit 1
fi
