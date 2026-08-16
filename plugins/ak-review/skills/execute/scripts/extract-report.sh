#!/bin/bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: extract-report.sh <raw-jsonl-file>" >&2
  exit 1
fi

RAW_FILE="$1"

if [ ! -f "$RAW_FILE" ]; then
  echo "extract-report.sh: file not found: $RAW_FILE" >&2
  exit 1
fi

REPORT=$(jq -rs 'map(select(.type == "text") | .part.text) | join("\n\n")' "$RAW_FILE")

if [ -z "$REPORT" ]; then
  echo "extract-report.sh: no text events found in $RAW_FILE" >&2
  exit 1
fi

printf '%s\n' "$REPORT"
