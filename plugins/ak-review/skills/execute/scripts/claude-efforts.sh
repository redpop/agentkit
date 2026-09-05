#!/bin/bash
# Lists the effort values this adapter accepts, one per line.
#
# Claude Code prints these in `claude --help` ("Effort level for the current
# session (low, medium, high, xhigh, max)"), but they are kept here as a literal
# list rather than parsed out of it: help text is prose, not an interface, and a
# reworded line would silently widen or empty the list instead of failing loudly.
# The list is short and changes rarely; the parse would be the fragile half.
#
# Note it does NOT include codex's `none` and `minimal` — the near-miss that makes
# this check worth having, since the two enums overlap everywhere else.
# Verified against Claude Code 2.1.240. When upstream adds a level, add it here
# too — resolve-config.sh rejects anything absent from this list, so a stale list
# blocks a valid value.
set -euo pipefail

cat <<'VALUES'
low
medium
high
xhigh
max
VALUES
