#!/bin/bash
set -euo pipefail

if [ $# -lt 3 ] || [ $# -gt 4 ]; then
  echo "Usage: opencode-adapter.sh <prompt-file> <model> [effort] <raw-output-file>" >&2
  exit 1
fi

PROMPT_FILE="$1"
MODEL="$2"

if [ $# -eq 4 ]; then
  EFFORT="$3"
  RAW_OUTPUT_FILE="$4"
else
  EFFORT=""
  RAW_OUTPUT_FILE="$3"
fi

if [ ! -f "$PROMPT_FILE" ]; then
  echo "opencode-adapter.sh: prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

PROMPT_TEXT="$(cat "$PROMPT_FILE")"

if [ -n "$EFFORT" ]; then
  opencode run "$PROMPT_TEXT" --model "$MODEL" --variant "$EFFORT" --format json > "$RAW_OUTPUT_FILE"
else
  opencode run "$PROMPT_TEXT" --model "$MODEL" --format json > "$RAW_OUTPUT_FILE"
fi
