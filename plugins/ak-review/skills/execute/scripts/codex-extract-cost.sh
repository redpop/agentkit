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
  map(select(.type == "turn.completed") | select((.usage | type) == "object") | .usage) as $u
  | {
      total_cost: null,
      total_tokens: (if ($u | any(.[]; (.input_tokens | type == "number")
                                    or (.output_tokens | type == "number")))
                     then ($u | map((.input_tokens // 0) + (.output_tokens // 0)) | add)
                     else null end),
      input_tokens: ($u | sum_or_null(.input_tokens)),
      cached_input_tokens: ($u | sum_or_null(.cached_input_tokens)),
      output_tokens: ($u | sum_or_null(.output_tokens)),
      reasoning_output_tokens: ($u | sum_or_null(.reasoning_output_tokens))
    }'
