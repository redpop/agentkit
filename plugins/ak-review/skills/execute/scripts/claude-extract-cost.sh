#!/bin/bash
# Extracts cost and usage from a `claude -p --output-format stream-json` run.
#
# Unlike codex, Claude Code DOES report money: the `result` event carries
# `total_cost_usd` outright, so nothing has to be inferred from token counts and
# a price list. Output keeps the two keys every adapter's cost file shares
# (`total_cost`, `total_tokens`) and adds the breakdown.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: claude-extract-cost.sh <raw-jsonl-file>" >&2
  exit 1
fi

RAW_FILE="$1"

if [ ! -f "$RAW_FILE" ]; then
  echo "claude-extract-cost.sh: file not found: $RAW_FILE" >&2
  exit 1
fi

# A run killed before its result event has no cost record at all. That reports
# as null rather than 0: zero would claim the run was free, when the truth is
# that it cost something nobody counted. Degrading rather than failing keeps a
# salvaged report from being lost alongside the missing figure.
jq -R 'fromjson? // empty' "$RAW_FILE" \
  | jq -cs '
  ([.[] | select(.type == "result")] | last) as $r
  | {
      total_cost: ($r.total_cost_usd // null),
      total_tokens: (((($r.usage.input_tokens // 0) + ($r.usage.output_tokens // 0))) // 0),
      input_tokens: ($r.usage.input_tokens // 0),
      output_tokens: ($r.usage.output_tokens // 0),
      num_turns: ($r.num_turns // 0)
    }'
