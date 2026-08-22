#!/bin/bash
# Pins codex-extract-cost.sh against codex's usage reporting.
#
# The load-bearing difference from opencode: codex reports NO monetary cost at
# all. `turn.completed.usage` carries token counts only, and under a ChatGPT
# login there is no price attached to them anywhere in the stream. `total_cost`
# is therefore null — not 0, which would be a false claim that the run was free.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../codex-extract-cost.sh"
FIXTURE="$DIR/fixtures/codex-sample-run-output.jsonl"
TRUNCATED_FIXTURE="$DIR/fixtures/codex-truncated-run-output.jsonl"

fail() { echo "FAIL: $1"; exit 1; }

# Case 1: usage is read off turn.completed.
ACTUAL="$(bash "$SCRIPT" "$FIXTURE")"
EXPECTED='{"total_cost":null,"total_tokens":13997,"input_tokens":13992,"cached_input_tokens":9984,"output_tokens":5,"reasoning_output_tokens":0}'

[ "$ACTUAL" = "$EXPECTED" ] || {
  echo "FAIL: case 1: output did not match"
  diff <(echo "$ACTUAL") <(echo "$EXPECTED") || true
  exit 1
}

# Case 2: total_cost is null, never 0. Phase 8 reports this figure to a human;
# "$0.00" would read as "this run was free" when the truth is "codex does not
# say". Pinned explicitly because a jq `// 0` fallback would silently produce
# the wrong one.
echo "$ACTUAL" | jq -e '.total_cost == null' > /dev/null \
  || fail "case 2: total_cost must be null, not a number"

# Case 3: a missing file exits non-zero.
if bash "$SCRIPT" "$DIR/fixtures/does-not-exist.jsonl" 2> /dev/null; then
  fail "case 3: a missing file must exit non-zero"
fi

# Case 4: a truncated stream degrades to zeroed tokens instead of dying. A run
# killed before turn.completed genuinely has no usage record — reporting zeros
# is correct, and crashing here would take the salvaged report down with it.
TRUNCATED_ACTUAL="$(bash "$SCRIPT" "$TRUNCATED_FIXTURE")"
echo "$TRUNCATED_ACTUAL" | jq -e '.total_tokens == 0' > /dev/null \
  || fail "case 4: a truncated stream should report zero tokens, got: $TRUNCATED_ACTUAL"
echo "$TRUNCATED_ACTUAL" | jq -e '.total_cost == null' > /dev/null \
  || fail "case 4: total_cost must stay null on a truncated stream"

echo "PASS: test-codex-extract-cost.sh"
