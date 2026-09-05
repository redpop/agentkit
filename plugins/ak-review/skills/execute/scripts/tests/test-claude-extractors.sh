#!/bin/bash
# Pins the three claude extractors against Claude Code's stream-json schema.
#
# The schema differs from both other adapters again: the finished answer arrives
# in a single `result` event, and sub-agent messages are distinguished from the
# coordinating agent's only by `parent_tool_use_id` being set. Getting that
# field wrong would splice sub-agent chatter into the report — claims the
# reviewer never made, handed to Phase 5 as if it had.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT="$DIR/../claude-extract-report.sh"
COST="$DIR/../claude-extract-cost.sh"
SUBAGENTS="$DIR/../claude-extract-subagents.sh"
FIXTURE="$DIR/fixtures/claude-sample-run-output.jsonl"
TRUNCATED="$DIR/fixtures/claude-truncated-run-output.jsonl"

fail() { echo "FAIL: $1"; exit 1; }

# --- report ---------------------------------------------------------------

# Case 1: the result event wins, and sub-agent text stays out of the report.
OUT="$(bash "$REPORT" "$FIXTURE")"
echo "$OUT" | grep -q "No blocking issues" || fail "case 1: the result event's text was not returned"
echo "$OUT" | grep -q "Security dimension" && fail "case 1: sub-agent text leaked into the report"
echo "$OUT" | grep -q "Dispatching review subagents" && fail "case 1: narration outranked the result event"

# Case 2: killed before the result event -> fall back to the COORDINATING
# agent's own text only. Partial by nature, but never sub-agent output.
# A truncated stream is by definition an UNFINISHED report: it carries no
# findings block, so the extractor now exits 3 to say so while still emitting
# what it recovered. That is the whole point of the salvage path — the prose is
# worth having, it just must not be mistaken for a completed review.
set +e
TOUT="$(bash "$REPORT" "$TRUNCATED" 2> /dev/null)"
TEC=$?
set -e
[ "$TEC" -eq 3 ] || fail "case 2: a truncated stream must exit 3 (unfinished), got $TEC"
echo "$TOUT" | grep -q "Dispatching review subagents" || fail "case 2: the fallback did not recover top-level text"
echo "$TOUT" | grep -q "Security dimension" && fail "case 2: the fallback must not include sub-agent text"

# Case 3: a stream with neither exits non-zero rather than printing nothing —
# an empty report would read as "the review found no issues".
EMPTY="$(mktemp)"; trap 'rm -f "$EMPTY"' EXIT
printf '%s\n' '{"type":"system","subtype":"init"}' > "$EMPTY"
if bash "$REPORT" "$EMPTY" 2> /dev/null; then
  fail "case 3: a stream with no report must exit non-zero"
fi
if bash "$REPORT" "$DIR/fixtures/does-not-exist.jsonl" 2> /dev/null; then
  fail "case 3: a missing file must exit non-zero"
fi

# --- cost -----------------------------------------------------------------

# Case 4: real money, taken from the result event. Unlike codex, Claude Code
# reports a dollar figure, so total_cost must NOT be null here.
COUT="$(bash "$COST" "$FIXTURE")"
echo "$COUT" | jq -e '.total_cost == 0.5152091' > /dev/null || fail "case 4: total_cost was not read from the result event: $COUT"
# Tokens come from `modelUsage`, not from the result event's own `usage`, and
# include the cache counters. Measured on a one-sub-agent probe: `usage` reported
# input 30 where `modelUsage` reported 40 -- the difference being the sub-agent --
# and omitting the cache counters turned 155527 processed tokens into 1308. The
# fixture keeps `usage` deliberately smaller than `modelUsage` so a regression to
# the old source fails here rather than passing with a plausible number.
echo "$COUT" | jq -e '.total_tokens == 10614' > /dev/null || fail "case 4: total_tokens must sum modelUsage including cache: $COUT"
echo "$COUT" | jq -e '.total_tokens != 523' > /dev/null || fail "case 4: total_tokens was read from the result event's usage, which excludes sub-agents and cache: $COUT"
echo "$COUT" | jq -e '.subagents_spawned == 2' > /dev/null || fail "case 4: subagent_stats.spawned must be carried through: $COUT"
echo "$COUT" | jq -e '.num_turns == 3' > /dev/null || fail "case 4: num_turns was not carried through"

# Case 5: a truncated stream has no cost record. That is null, not 0 — zero
# would claim the run was free when the truth is that nobody counted it.
TCOUT="$(bash "$COST" "$TRUNCATED")"
echo "$TCOUT" | jq -e '.total_cost == null' > /dev/null || fail "case 5: an uncounted run must report null, not a number: $TCOUT"
echo "$TCOUT" | jq -e '.total_tokens == null' > /dev/null || fail "case 5: an uncounted run must report null tokens, not 0: $TCOUT"

# --- subagents ------------------------------------------------------------

# Case 6: only sub-agent messages, grouped per dispatch, coordinator excluded.
SOUT="$(bash "$SUBAGENTS" "$FIXTURE")"
echo "$SOUT" | grep -q "Security dimension" || fail "case 6: sub-agent output was not recovered"
echo "$SOUT" | grep -q "Tests dimension" || fail "case 6: the second sub-agent was not recovered"
echo "$SOUT" | grep -q "Dispatching review subagents" && fail "case 6: coordinator text must not appear as sub-agent output"
[ "$(echo "$SOUT" | grep -c '^## Sub-agent ')" -eq 2 ] || fail "case 6: expected two grouped sub-agents"

# Case 7: a run with no sub-agents exits non-zero, so the salvage path can tell
# "nothing was dispatched" from "the dispatch produced nothing".
if bash "$SUBAGENTS" "$EMPTY" 2> /dev/null; then
  fail "case 7: a stream with no sub-agents must exit non-zero"
fi

echo "PASS: test-claude-extractors.sh"
