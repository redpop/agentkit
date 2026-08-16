#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../extract-report.sh"
FIXTURE="$DIR/fixtures/sample-run-output.jsonl"
EXPECTED="$DIR/fixtures/expected-report.txt"

ACTUAL="$(bash "$SCRIPT" "$FIXTURE")"
EXPECTED_TEXT="$(cat "$EXPECTED")"

if [ "$ACTUAL" != "$EXPECTED_TEXT" ]; then
  echo "FAIL: extract-report.sh output did not match expected-report.txt"
  diff <(echo "$ACTUAL") <(echo "$EXPECTED_TEXT") || true
  exit 1
fi

if bash "$SCRIPT" "$DIR/fixtures/does-not-exist.jsonl" 2>/dev/null; then
  echo "FAIL: extract-report.sh should exit non-zero for a missing file"
  exit 1
fi

echo "PASS: test-extract-report.sh"
