#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../extract-cost.sh"
FIXTURE="$DIR/fixtures/sample-run-output.jsonl"

ACTUAL="$(bash "$SCRIPT" "$FIXTURE")"
EXPECTED='{"total_cost":0.03,"total_tokens":1300}'

if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL: extract-cost.sh output did not match"
  echo "  got:      $ACTUAL"
  echo "  expected: $EXPECTED"
  exit 1
fi

if bash "$SCRIPT" "$DIR/fixtures/does-not-exist.jsonl" 2>/dev/null; then
  echo "FAIL: extract-cost.sh should exit non-zero for a missing file"
  exit 1
fi

echo "PASS: test-extract-cost.sh"
