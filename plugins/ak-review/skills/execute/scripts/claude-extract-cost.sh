#!/bin/bash
# Extracts cost and usage from a `claude -p --output-format stream-json` run.
#
# Unlike codex, Claude Code DOES report money: the `result` event carries
# `total_cost_usd` outright, so nothing has to be inferred from token counts and
# a price list. Output keeps the two keys every adapter's cost file shares
# (`total_cost`, `total_tokens`) and adds the breakdown.
#
# `total_cost_usd` covers sub-agents; the result event's own `usage` does not.
# Measured on a one-sub-agent probe (haiku, subagent_stats.spawned=1): top-level
# `usage` reported input 30, while `modelUsage` reported 40 -- the missing 10
# being the sub-agent's, and `modelUsage`'s `costUSD` matching `total_cost_usd`
# to the cent. So the money is whole and the token count taken from `usage` is
# not, which is the opposite of the opencode adapter's problem and needs the
# opposite fix: keep the cost, stop reading tokens from `usage`.
#
# Tokens therefore come from `modelUsage`, summed across models, and INCLUDE the
# cache counters. Anthropic reports `cache_read_input_tokens` and
# `cache_creation_input_tokens` separately from `input_tokens`, so omitting them
# does not merely round the figure down -- on that same probe it reported 1308
# tokens against 155527 actually processed, a factor of 119. A review prompt is
# mostly cached context, so this is the normal case, not an extreme one.
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
# as null rather than 0 -- and so do the token counts, for the same reason:
# zero would claim the run consumed nothing, when the truth is that it consumed
# something nobody counted. Degrading rather than failing keeps a
# salvaged report from being lost alongside the missing figure.
jq -R 'fromjson? // empty' "$RAW_FILE" \
  | jq -cs '
  ([.[] | select(.type == "result")] | last) as $r
  | ([($r.modelUsage // {}) | to_entries[] | .value]) as $m
  | ($m | length > 0) as $measured
  | {
      total_cost: ($r.total_cost_usd // null),
      total_tokens: (if $measured then ($m | map((.inputTokens // 0) + (.outputTokens // 0)
                              + (.cacheReadInputTokens // 0)
                              + (.cacheCreationInputTokens // 0)) | add) else null end),
      input_tokens: (if $measured then ($m | map(.inputTokens // 0) | add) else null end),
      output_tokens: (if $measured then ($m | map(.outputTokens // 0) | add) else null end),
      cache_read_input_tokens: (if $measured then ($m | map(.cacheReadInputTokens // 0) | add) else null end),
      cache_creation_input_tokens: (if $measured then ($m | map(.cacheCreationInputTokens // 0) | add) else null end),
      num_turns: ($r.num_turns // 0),
      subagents_spawned: ($r.subagent_stats.spawned // 0)
    }'
