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
  # A figure is "measured" only if the stream actually carried it. `// 0` inside
  # the sum is for a single absent field among present ones; this guards the case
  # it cannot see — the field absent from EVERY event, where summing yields 0 and
  # claims a run was free or consumed nothing. That is the one claim this file
  # exists to prevent, and it was reachable here.
  #
  # Not handled, deliberately: a MIXED stream, where some events carry the field
  # and others do not. The sum is then a partial presented as a total. It has
  # never been observed, and inventing a branch for it would mean guessing which
  # of the two the tool meant. If it ever shows up, the shape to use is the one
  # the sub-agent case already uses: `total_cost: null` plus what is known under
  # a name that says so.
  def sum_or_null(f): . as $xs
    | if any($xs[]; (f) | type == "number") then ($xs | map((f) // 0) | add) else null end;
  ([.[] | select(.type == "result")] | last) as $r
  | ([($r.modelUsage // {}) | to_entries[] | .value]) as $m
  | {
      total_cost: ($r.total_cost_usd // null),
      total_tokens: (if ($m | any(.[]; (.inputTokens | type == "number")
                                    or (.outputTokens | type == "number")
                                    or (.cacheReadInputTokens | type == "number")
                                    or (.cacheCreationInputTokens | type == "number")))
                     then ($m | map((.inputTokens // 0) + (.outputTokens // 0)
                              + (.cacheReadInputTokens // 0)
                              + (.cacheCreationInputTokens // 0)) | add)
                     else null end),
      input_tokens: ($m | sum_or_null(.inputTokens)),
      output_tokens: ($m | sum_or_null(.outputTokens)),
      cache_read_input_tokens: ($m | sum_or_null(.cacheReadInputTokens)),
      cache_creation_input_tokens: ($m | sum_or_null(.cacheCreationInputTokens)),
      num_turns: ($r.num_turns // 0),
      subagents_spawned: ($r.subagent_stats.spawned // 0)
    }'
