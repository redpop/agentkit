#!/bin/bash
# Extracts token usage from a `codex exec --json` stream.
#
# Codex reports NO monetary cost. `turn.completed.usage` carries token counts
# and nothing else, and under a ChatGPT login there is no price attached to them
# anywhere in the stream. `total_cost` is therefore null rather than 0: zero
# would assert the run was free, which is a different — and false — claim than
# "codex does not report this".
#
# The output keeps opencode's two keys (`total_cost`, `total_tokens`) so a
# caller can read either adapter's cost file the same way, and adds the
# breakdown codex does provide.
# A killed run carries no `turn.completed` at all, and codex puts usage nowhere
# else -- verified on a real timed-out run, where no token field appears in the
# stream from end to end. Tokens are then `null`, not `0`: this adapter reports
# no money, so the token count is the ONLY figure it contributes, and a zero
# there claims a run consumed nothing when what is true is that nobody counted.
# The script still exits 0, because degrading must not lose a salvaged report.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: codex-extract-cost.sh <raw-jsonl-file>" >&2
  exit 1
fi

RAW_FILE="$1"

if [ ! -f "$RAW_FILE" ]; then
  echo "codex-extract-cost.sh: file not found: $RAW_FILE" >&2
  exit 1
fi

# Summed across turns, not read off the last one: `codex exec` emits one
# turn.completed per turn, and a review that takes several would otherwise
# report only the final turn's usage.
#
# total_tokens is input + output. cached_input_tokens is a subset of
# input_tokens, not an addition to it, so adding it would double-count.
jq -R 'fromjson? // empty' "$RAW_FILE" \
  | jq -cs '
  map(select(.type == "turn.completed") | select((.usage | type) == "object") | .usage) as $u
  | ($u | length > 0) as $measured
  | {
      total_cost: null,
      total_tokens: (if $measured then ($u | map((.input_tokens // 0) + (.output_tokens // 0)) | add) else null end),
      input_tokens: (if $measured then ($u | map(.input_tokens // 0) | add) else null end),
      cached_input_tokens: (if $measured then ($u | map(.cached_input_tokens // 0) | add) else null end),
      output_tokens: (if $measured then ($u | map(.output_tokens // 0) | add) else null end),
      reasoning_output_tokens: (if $measured then ($u | map(.reasoning_output_tokens // 0) | add) else null end)
    }'
