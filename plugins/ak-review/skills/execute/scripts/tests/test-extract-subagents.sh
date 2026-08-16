#!/bin/bash
# Pins extract-subagents.sh against hand-built streams.
#
# The fixture shapes come from a real stalled run, not from imagination: a
# completed `task` result carrying findings, a still-`running` one carrying
# nothing useful, and a `text` part carrying only narration.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../extract-subagents.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "FAIL: $1"; exit 1; }

# Case 1: two completed sub-agents -> both recovered, titled, separated.
cat > "$WORK/two.jsonl" <<'JSONL'
{"type":"text","part":{"type":"text","text":"dispatching sub-agents"}}
{"type":"tool_use","part":{"type":"tool","tool":"task","state":{"status":"completed","title":"Correctness review","output":"FINDING-A: something is wrong"}}}
{"type":"tool_use","part":{"type":"tool","tool":"task","state":{"status":"completed","title":"Shell review","output":"FINDING-B: quoting issue"}}}
JSONL
OUT=$(bash "$SCRIPT" "$WORK/two.jsonl")
echo "$OUT" | grep -q "FINDING-A" || fail "case 1: first sub-agent's findings were lost"
echo "$OUT" | grep -q "FINDING-B" || fail "case 1: second sub-agent's findings were lost"
echo "$OUT" | grep -q "## Correctness review" || fail "case 1: the title should head each block"
echo "$OUT" | grep -q "dispatching sub-agents" && fail "case 1: narration text must not be included"

# Case 2: an unfinished sub-agent is skipped — a half-written finding is worse
# than a missing one.
cat > "$WORK/mixed.jsonl" <<'JSONL'
{"type":"tool_use","part":{"type":"tool","tool":"task","state":{"status":"completed","title":"Done one","output":"KEEP-ME"}}}
{"type":"tool_use","part":{"type":"tool","tool":"task","state":{"status":"running","title":"Still going","output":"HALF-WRIT"}}}
JSONL
OUT=$(bash "$SCRIPT" "$WORK/mixed.jsonl")
echo "$OUT" | grep -q "KEEP-ME" || fail "case 2: the completed sub-agent was dropped"
echo "$OUT" | grep -q "HALF-WRIT" && fail "case 2: an unfinished sub-agent must be skipped"

# Case 3: a stream truncated mid-line still yields what completed before it.
# This is the whole point — the streams this reads are ones that were killed.
printf '%s\n' '{"type":"tool_use","part":{"type":"tool","tool":"task","state":{"status":"completed","title":"Survivor","output":"RECOVERED"}}}' > "$WORK/trunc.jsonl"
printf '%s' '{"type":"tool_use","part":{"type":"tool","tool":"ta' >> "$WORK/trunc.jsonl"
OUT=$(bash "$SCRIPT" "$WORK/trunc.jsonl")
echo "$OUT" | grep -q "RECOVERED" || fail "case 3: a truncated trailing line must not lose earlier results"

# Case 4: no completed sub-agents -> exit 1, so a caller can tell "nothing to
# recover" from "here are the findings".
set +e
bash "$SCRIPT" "$WORK/none.jsonl" 2> /dev/null
MISSING_EXIT=$?
printf '%s\n' '{"type":"text","part":{"type":"text","text":"only narration"}}' > "$WORK/nosub.jsonl"
bash "$SCRIPT" "$WORK/nosub.jsonl" 2> /dev/null
NOSUB_EXIT=$?
set -e
[ "$MISSING_EXIT" -eq 1 ] || fail "case 4: a missing file must exit 1, got $MISSING_EXIT"
[ "$NOSUB_EXIT" -eq 1 ] || fail "case 4: a stream with no completed sub-agents must exit 1, got $NOSUB_EXIT"

echo "PASS: test-extract-subagents.sh"
