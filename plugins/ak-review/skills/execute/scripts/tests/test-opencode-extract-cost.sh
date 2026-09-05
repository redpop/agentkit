#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../opencode-extract-cost.sh"
FIXTURE="$DIR/fixtures/opencode-sample-run-output.jsonl"
TRUNCATED_FIXTURE="$DIR/fixtures/opencode-truncated-run-output.jsonl"
SUBAGENT_FIXTURE="$DIR/fixtures/opencode-subagent-cost-output.jsonl"

# A run with no sub-agents is fully accounted for by the parent's step_finish
# events, so it still reports a real number. Blanking every opencode run would
# throw away a figure that happens to be correct.
ACTUAL="$(bash "$SCRIPT" "$FIXTURE")"
EXPECTED='{"total_cost":0.03,"total_tokens":1300,"parent_session_cost":0.03,"subagent_sessions":0}'

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

# A stream truncated mid-line must degrade (exit 0) rather than dying on the
# first malformed line -- SKILL.md documents this as the salvage path after an
# external kill on a hung run. Degrading means reporting nothing, not reporting
# zero.
TRUNCATED_ACTUAL="$(bash "$SCRIPT" "$TRUNCATED_FIXTURE")"
# Nothing was measured here, so nothing is claimed: a stream with no step_finish
# at all is a run killed before it billed anything, not a run that cost nothing.
TRUNCATED_EXPECTED='{"total_cost":null,"total_tokens":null,"parent_session_cost":null,"subagent_sessions":0}'

if [ "$TRUNCATED_ACTUAL" != "$TRUNCATED_EXPECTED" ]; then
  echo "FAIL: opencode-extract-cost.sh did not degrade gracefully on a truncated stream"
  echo "  got:      $TRUNCATED_ACTUAL"
  echo "  expected: $TRUNCATED_EXPECTED"
  exit 1
fi

# Sub-agents run in their own sessions and opencode does not put their
# step_finish events into the parent's stream, so the sum here is the parent's
# spend alone. Measured against the provider's billing: two runs reported $1.17
# between them and were charged $3.17. `total_cost` therefore goes null the
# moment a sub-agent is present -- the partial sum stays, but under a name that
# says what it is, because a partial sum read as a total is what sent that
# measurement wrong in the first place.
SUB_ACTUAL="$(bash "$SCRIPT" "$SUBAGENT_FIXTURE")"
SUB_EXPECTED='{"total_cost":null,"total_tokens":1500,"parent_session_cost":0.75,"subagent_sessions":2}'

if [ "$SUB_ACTUAL" != "$SUB_EXPECTED" ]; then
  echo "FAIL: a run with sub-agents must report total_cost null and name the partial sum"
  echo "  got:      $SUB_ACTUAL"
  echo "  expected: $SUB_EXPECTED"
  exit 1
fi

# The fixture also carries a `running` task and a completed non-`task` tool_use.
# Neither may be counted: a task still running when the stream ended may never
# have reached the model, and counting a `read` call as an unbilled session
# would overstate what is missing. Both are covered by the count of 2 above,
# which is asserted here separately so a regression names the right cause.
echo "$SUB_ACTUAL" | jq -e '.subagent_sessions == 2' > /dev/null || {
  echo "FAIL: only completed task parts may count as unbilled sessions"
  exit 1
}

echo "PASS: test-opencode-extract-cost.sh"
