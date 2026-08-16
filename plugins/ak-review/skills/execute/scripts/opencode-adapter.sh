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

# opencode reports denied permissions on stderr ("permission requested: ...;
# auto-rejecting") and keeps going, so a run that could not read the repo still
# exits 0 with a plausible-looking but uninformed JSON stream. Capture stderr
# next to the stream, or an unattended run's real failure reason is lost.
STDERR_FILE="${RAW_OUTPUT_FILE}.stderr"

# `set -e` would abort before the exit code could be captured and the warning
# emitted, so the invocation is deliberately guarded here instead.
set +e
if [ -n "$EFFORT" ]; then
  opencode run "$PROMPT_TEXT" --model "$MODEL" --variant "$EFFORT" --format json \
    > "$RAW_OUTPUT_FILE" 2> "$STDERR_FILE"
else
  opencode run "$PROMPT_TEXT" --model "$MODEL" --format json \
    > "$RAW_OUTPUT_FILE" 2> "$STDERR_FILE"
fi
EXIT_CODE=$?
set -e

if [ -s "$STDERR_FILE" ]; then
  cat "$STDERR_FILE" >&2
fi

if grep -q "auto-rejecting" "$STDERR_FILE" 2> /dev/null; then
  echo "opencode-adapter.sh: WARNING - opencode denied one or more permissions; the review ran without full repository access. See $STDERR_FILE" >&2
fi

exit "$EXIT_CODE"
