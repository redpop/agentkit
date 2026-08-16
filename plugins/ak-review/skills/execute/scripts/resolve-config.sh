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

# This is the first thing a new user meets, because no config ships with the
# plugin — by design, since defaulting would pick someone's tool and model for
# them. That makes the message itself the onboarding: it must be enough to act
# on without opening the docs. It names the adapters that exist (a fact about
# this plugin) but never a model (that is the user's choice, and baking one in
# here would be the default this design exists to avoid) — instead it says how
# to list them.
if [ -n "$MISSING" ]; then
  cat >&2 <<EOF
resolve-config.sh: missing required setting(s): $MISSING

/ak-review:execute runs the review with an external coding-agent CLI, and does
not assume which one — no tool or model is configured by default.

Create one of these (the project file wins over the global one):

  $GLOBAL_CONFIG   — your default, everywhere
  $PROJECT_CONFIG  — this project only (gitignore it)

  {
    "external_review": {
      "tool": "opencode",
      "model": "<provider/model>",
      "effort": "high",
      "fix_threshold": "high"
    }
  }

Implemented adapters: opencode
Models for opencode: run \`opencode models\` to list them.
Only "tool" and "model" are required. "fix_threshold" defaults to "high"
(auto-fix confirmed high/critical findings only); "effort" is optional.

Or pass them for a single run: --tool <name> --model <provider/model>

For a guided setup that writes this file for you: /ak-review:setup
EOF
  exit 1
fi

jq -cn --arg tool "$TOOL" --arg model "$MODEL" --arg effort "$EFFORT" --arg fix_threshold "$FIX_THRESHOLD" \
  '{tool: $tool, model: $model, effort: (if $effort == "" then null else $effort end), fix_threshold: $fix_threshold}'
