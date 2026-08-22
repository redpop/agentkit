#!/bin/bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: opencode-extract-cost.sh <raw-jsonl-file>" >&2
  exit 1
fi

RAW_FILE="$1"

if [ ! -f "$RAW_FILE" ]; then
  echo "opencode-extract-cost.sh: file not found: $RAW_FILE" >&2
  exit 1
fi

# See opencode-extract-report.sh for why this is two jq passes: a line-by-line
# `fromjson? // empty` filter tolerates a stream truncated mid-line, where
# `jq -s` would abort on the first malformed line instead of degrading to a
# zeroed cost.
jq -R 'fromjson? // empty' "$RAW_FILE" \
  | jq -cs '{
  total_cost: ((map(select(.type == "step_finish") | .part.cost // 0) | add) // 0),
  total_tokens: ((map(select(.type == "step_finish") | .part.tokens.total // 0) | add) // 0)
}'
