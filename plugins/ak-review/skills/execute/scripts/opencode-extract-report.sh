#!/bin/bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: opencode-extract-report.sh <raw-jsonl-file>" >&2
  exit 1
fi

RAW_FILE="$1"

if [ ! -f "$RAW_FILE" ]; then
  echo "opencode-extract-report.sh: file not found: $RAW_FILE" >&2
  exit 1
fi

# Read line-by-line and drop any line that isn't valid JSON (`fromjson? // empty`)
# before re-assembling into an array, rather than `jq -s` parsing the whole file
# as one document. This tolerates a stream truncated mid-line — e.g. after an
# external kill on a hung run (see SKILL.md's Adapter Reference) — recovering
# every complete event instead of aborting on the first malformed one.
REPORT=$(jq -R 'fromjson? // empty' "$RAW_FILE" \
  | jq -rs 'map(select(.type == "text") | .part.text) | join("\n\n")')

if [ -z "$REPORT" ]; then
  echo "opencode-extract-report.sh: no text events found in $RAW_FILE" >&2
  exit 1
fi

printf '%s\n' "$REPORT"
