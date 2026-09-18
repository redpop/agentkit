#!/bin/bash
# Pins the "null, never 0" doctrine shared by all three cost extractors.
#
# The Adapter Reference states it as a contract: a figure the stream never
# carried is `null`, "never `0`, which claims a run was free or consumed nothing
# when the truth is that nobody counted". Each extractor enforced it for the
# case of NO source events at all, and undercut it one level down: the sums are
# written `map(.field // 0) | add`, so a field absent from every event summed to
# 0 and was reported as a measurement.
#
# `// 0` is still right for one absent field among present ones — that really is
# a zero contribution. What it cannot see is the field being absent everywhere,
# which is not a zero but an absence, and that is what these cases pin.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fail() { echo "FAIL: $1"; exit 1; }

# field <json> <key> -> the value, or the literal "MISSING"
field() { printf '%s' "$1" | jq -r --arg k "$2" 'if has($k) then (.[$k] | tojson) else "MISSING" end'; }

# --- opencode: step_finish events that carry no cost ------------------------
printf '%s\n' '{"type":"step_finish","part":{"tokens":{"total":5000}}}' > "$WORK/oc-nocost.jsonl"
OUT=$(bash "$DIR/../opencode-extract-cost.sh" "$WORK/oc-nocost.jsonl")
[ "$(field "$OUT" total_cost)" = "null" ] \
  || fail "opencode: cost absent from every step_finish must be null, got $(field "$OUT" total_cost)"
[ "$(field "$OUT" parent_session_cost)" = "null" ] \
  || fail "opencode: the partial figure must be null too when nothing carried a cost"
[ "$(field "$OUT" total_tokens)" = "5000" ] \
  || fail "opencode: a figure that WAS carried must still be reported, got $(field "$OUT" total_tokens)"

# The other direction: a real cost is still summed and reported.
printf '%s\n' '{"type":"step_finish","part":{"cost":0.5,"tokens":{"total":10}}}' \
  '{"type":"step_finish","part":{"cost":0.25,"tokens":{"total":5}}}' > "$WORK/oc-cost.jsonl"
OUT=$(bash "$DIR/../opencode-extract-cost.sh" "$WORK/oc-cost.jsonl")
[ "$(field "$OUT" total_cost)" = "0.75" ] \
  || fail "opencode: a measured cost must still be summed, got $(field "$OUT" total_cost)"
echo "  ok: opencode"

# --- codex: a usage object with no token fields -----------------------------
printf '%s\n' '{"type":"turn.completed","usage":{}}' > "$WORK/cx-empty.jsonl"
OUT=$(bash "$DIR/../codex-extract-cost.sh" "$WORK/cx-empty.jsonl")
for k in total_tokens input_tokens output_tokens; do
  [ "$(field "$OUT" "$k")" = "null" ] \
    || fail "codex: $k must be null when the usage object carried nothing, got $(field "$OUT" "$k")"
done

# An explicit zero is a measurement and must survive as 0, not become null —
# real codex streams carry `reasoning_output_tokens: 0`.
printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5,"reasoning_output_tokens":0}}' \
  > "$WORK/cx-zero.jsonl"
OUT=$(bash "$DIR/../codex-extract-cost.sh" "$WORK/cx-zero.jsonl")
[ "$(field "$OUT" reasoning_output_tokens)" = "0" ] \
  || fail "codex: an explicit 0 is a measurement and must stay 0, got $(field "$OUT" reasoning_output_tokens)"
[ "$(field "$OUT" total_tokens)" = "15" ] || fail "codex: measured tokens must still be summed"
echo "  ok: codex"

# --- claude: a modelUsage entry with no token fields ------------------------
printf '%s\n' '{"type":"result","total_cost_usd":0.2,"modelUsage":{"claude-opus-5":{}}}' \
  > "$WORK/cl-empty.jsonl"
OUT=$(bash "$DIR/../claude-extract-cost.sh" "$WORK/cl-empty.jsonl")
[ "$(field "$OUT" total_tokens)" = "null" ] \
  || fail "claude: tokens absent from modelUsage must be null, got $(field "$OUT" total_tokens)"
[ "$(field "$OUT" total_cost)" = "0.2" ] \
  || fail "claude: the cost it DOES report must be unaffected, got $(field "$OUT" total_cost)"
echo "  ok: claude"

echo "PASS: test-cost-unmeasured.sh"
