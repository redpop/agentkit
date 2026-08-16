#!/bin/bash
set -euo pipefail

GLOBAL_CONFIG="${HOME}/.claude/ak-review.local.json"
PROJECT_CONFIG=".claude/ak-review.local.json"

FLAG_TOOL=""
FLAG_MODEL=""
FLAG_EFFORT=""
FLAG_FIX_THRESHOLD=""

while [ $# -gt 0 ]; do
  case "$1" in
    --tool) FLAG_TOOL="$2"; shift 2 ;;
    --model) FLAG_MODEL="$2"; shift 2 ;;
    --effort) FLAG_EFFORT="$2"; shift 2 ;;
    --fix-threshold) FLAG_FIX_THRESHOLD="$2"; shift 2 ;;
    --project-config) PROJECT_CONFIG="$2"; shift 2 ;;
    --global-config) GLOBAL_CONFIG="$2"; shift 2 ;;
    *) echo "resolve-config.sh: unknown argument: $1" >&2; exit 1 ;;
  esac
done

read_layer() {
  local path="$1"
  if [ -f "$path" ]; then
    jq -c '.external_review // {}' "$path"
  else
    echo '{}'
  fi
}

GLOBAL_JSON=$(read_layer "$GLOBAL_CONFIG")
PROJECT_JSON=$(read_layer "$PROJECT_CONFIG")

FLAG_JSON=$(jq -cn \
  --arg tool "$FLAG_TOOL" --arg model "$FLAG_MODEL" \
  --arg effort "$FLAG_EFFORT" --arg fix_threshold "$FLAG_FIX_THRESHOLD" \
  '{tool: $tool, model: $model, effort: $effort, fix_threshold: $fix_threshold}
   | with_entries(select(.value != ""))')

MERGED=$(jq -cn --argjson g "$GLOBAL_JSON" --argjson p "$PROJECT_JSON" --argjson f "$FLAG_JSON" \
  '$g * $p * $f')

TOOL=$(echo "$MERGED" | jq -r '.tool // empty')
MODEL=$(echo "$MERGED" | jq -r '.model // empty')
EFFORT=$(echo "$MERGED" | jq -r '.effort // empty')
FIX_THRESHOLD=$(echo "$MERGED" | jq -r '.fix_threshold // "high"')

MISSING=""
[ -z "$TOOL" ] && MISSING="${MISSING}tool "
[ -z "$MODEL" ] && MISSING="${MISSING}model "

if [ -n "$MISSING" ]; then
  echo "resolve-config.sh: missing required setting(s): $MISSING" >&2
  echo "Set via --tool/--model flags, or add \"external_review\": {\"tool\": ..., \"model\": ...} to $PROJECT_CONFIG or $GLOBAL_CONFIG" >&2
  exit 1
fi

jq -cn --arg tool "$TOOL" --arg model "$MODEL" --arg effort "$EFFORT" --arg fix_threshold "$FIX_THRESHOLD" \
  '{tool: $tool, model: $model, effort: (if $effort == "" then null else $effort end), fix_threshold: $fix_threshold}'
