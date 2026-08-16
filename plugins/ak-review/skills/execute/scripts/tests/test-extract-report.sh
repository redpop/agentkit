#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../extract-report.sh"
FIXTURE="$DIR/fixtures/sample-run-output.jsonl"
EXPECTED="$DIR/fixtures/expected-report.txt"
TRUNCATED_FIXTURE="$DIR/fixtures/truncated-run-output.jsonl"

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

# A stream truncated mid-line (e.g. after an external kill on a hung run, see
# SKILL.md's Adapter Reference) must still recover every complete text event
# instead of dying on the first malformed line -- SKILL.md documents this as
# the salvage path for that exact failure.
TRUNCATED_ACTUAL="$(bash "$SCRIPT" "$TRUNCATED_FIXTURE")"
TRUNCATED_EXPECTED="## Findings

Security dimension: no issues found."

if [ "$TRUNCATED_ACTUAL" != "$TRUNCATED_EXPECTED" ]; then
  echo "FAIL: extract-report.sh did not recover the complete text event(s) from a truncated stream"
  diff <(echo "$TRUNCATED_ACTUAL") <(echo "$TRUNCATED_EXPECTED") || true
  exit 1
fi

echo "PASS: test-extract-report.sh"
