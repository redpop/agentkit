#!/bin/bash
# Extracts the review report from a `codex exec --json` stream.
#
# Codex's schema shares nothing with opencode's beyond being JSONL, which is why
# this is a separate script rather than a branch inside a shared one: the report
# arrives as `item.completed` events whose `.item.type` is `agent_message`,
# where opencode emits `text` events carrying `.part.text`.
#
# Only `agent_message` items are read. The same stream also carries `reasoning`
# and `command_execution` items — the model's scratch work and its shell output.
# Those are not findings, and passing them to Phase 5 would hand the verifier
# claims the reviewer never actually made.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: codex-extract-report.sh <raw-jsonl-file>" >&2
  exit 1
fi

RAW_FILE="$1"

if [ ! -f "$RAW_FILE" ]; then
  echo "codex-extract-report.sh: file not found: $RAW_FILE" >&2
  exit 1
fi

# Two jq passes rather than `jq -s`, for the same reason as the opencode
# extractors: a line-by-line `fromjson? // empty` tolerates a stream truncated
# mid-line, recovering every complete event instead of aborting on the first
# malformed one. A codex run killed at the timeout ceiling ends exactly that way.
REPORT=$(jq -R 'fromjson? // empty' "$RAW_FILE" \
  | jq -rs 'map(select(.type == "item.completed")
                | select((.item | type) == "object")
                | .item
                | select(.type == "agent_message")
                | .text // empty)
            | join("\n\n")')

# Exiting non-zero on an empty result is deliberate, and means something
# different here than it does for opencode. Codex has no sub-agents, so there is
# no partial work to salvage: no agent_message means the run produced no answer
# at all. The caller must not read that silence as "the review found nothing".
if [ -z "$REPORT" ]; then
  echo "codex-extract-report.sh: no agent_message events found in $RAW_FILE" >&2
  echo "codex-extract-report.sh: the run produced no answer - this is NOT the same as a review that found no issues." >&2
  exit 1
fi

printf '%s\n' "$REPORT"
