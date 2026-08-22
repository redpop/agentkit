#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../opencode-extract-cost.sh"
FIXTURE="$DIR/fixtures/opencode-sample-run-output.jsonl"
TRUNCATED_FIXTURE="$DIR/fixtures/opencode-truncated-run-output.jsonl"

ACTUAL="$(bash "$SCRIPT" "$FIXTURE")"
EXPECTED='{"total_cost":0.03,"total_tokens":1300}'

if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL: opencode-extract-cost.sh output did not match"
  echo "  got:      $ACTUAL"
  echo "  expected: $EXPECTED"
  exit 1
fi

if bash "$SCRIPT" "$DIR/fixtures/does-not-exist.jsonl" 2>/dev/null; then
  echo "FAIL: opencode-extract-cost.sh should exit non-zero for a missing file"
  exit 1
fi

# A stream truncated mid-line must degrade to a zeroed cost (exit 0) rather
# than dying on the first malformed line -- SKILL.md documents this as the
# salvage path after an external kill on a hung run.
TRUNCATED_ACTUAL="$(bash "$SCRIPT" "$TRUNCATED_FIXTURE")"
TRUNCATED_EXPECTED='{"total_cost":0,"total_tokens":0}'

if [ "$TRUNCATED_ACTUAL" != "$TRUNCATED_EXPECTED" ]; then
  echo "FAIL: opencode-extract-cost.sh did not degrade gracefully on a truncated stream"
  echo "  got:      $TRUNCATED_ACTUAL"
  echo "  expected: $TRUNCATED_EXPECTED"
  exit 1
fi

echo "PASS: test-opencode-extract-cost.sh"
