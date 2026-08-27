#!/bin/bash
set -euo pipefail

GLOBAL_CONFIG="${HOME}/.claude/ak-review.local.json"
PROJECT_CONFIG=".claude/ak-review.local.json"

FLAG_TOOL=""
FLAG_MODEL=""
FLAG_EFFORT=""
FLAG_FIX_THRESHOLD=""
FLAG_TIMEOUT_SECS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --tool) FLAG_TOOL="$2"; shift 2 ;;
    --model) FLAG_MODEL="$2"; shift 2 ;;
    --effort) FLAG_EFFORT="$2"; shift 2 ;;
    --fix-threshold) FLAG_FIX_THRESHOLD="$2"; shift 2 ;;
    --timeout-secs) FLAG_TIMEOUT_SECS="$2"; shift 2 ;;
    --project-config) PROJECT_CONFIG="$2"; shift 2 ;;
    --global-config) GLOBAL_CONFIG="$2"; shift 2 ;;
    *) echo "resolve-config.sh: unknown argument: $1" >&2; exit 1 ;;
  esac
done

# Validated here rather than left to the adapter, because the adapter only sees
# the env var and its complaint would name that instead of the flag or config
# key the value actually came from.
if [ -n "$FLAG_TIMEOUT_SECS" ] && ! printf '%s' "$FLAG_TIMEOUT_SECS" | grep -Eq '^[1-9][0-9]*$'; then
  echo "resolve-config.sh: --timeout-secs must be a positive integer (got: ${FLAG_TIMEOUT_SECS})" >&2
  exit 1
fi

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

# jq's `*` merges objects recursively, so a project file adding one entry to
# `model_overrides` extends the global map instead of replacing it.
BASE=$(jq -cn --argjson g "$GLOBAL_JSON" --argjson p "$PROJECT_JSON" '$g * $p')

FLAG_JSON=$(jq -cn \
  --arg tool "$FLAG_TOOL" --arg model "$FLAG_MODEL" \
  --arg effort "$FLAG_EFFORT" --arg fix_threshold "$FLAG_FIX_THRESHOLD" \
  --arg timeout_secs "$FLAG_TIMEOUT_SECS" \
  '{tool: $tool, model: $model, effort: $effort, fix_threshold: $fix_threshold,
    timeout_secs: $timeout_secs}
   | with_entries(select(.value != ""))
   | if has("timeout_secs") then .timeout_secs |= tonumber else . end')

# The per-model layer is looked up by the model that is ALREADY decided, so the
# order is: settle the model first (flag beats files), then let its override
# refine everything else. An override that could itself change `tool` or `model`
# would make that lookup circular — the resolved model would no longer be the
# one whose entry was applied — so those two keys are rejected rather than
# silently dropped.
RESOLVED_MODEL=$(if [ -n "$FLAG_MODEL" ]; then printf '%s' "$FLAG_MODEL"; else echo "$BASE" | jq -r '.model // empty'; fi)

OVERRIDE='{}'
if [ -n "$RESOLVED_MODEL" ]; then
  OVERRIDE=$(echo "$BASE" | jq -c --arg m "$RESOLVED_MODEL" '.model_overrides[$m] // {}')
fi

BAD_KEYS=$(echo "$OVERRIDE" | jq -r 'keys - ["effort","fix_threshold","timeout_secs"] | join(", ")')
if [ -n "$BAD_KEYS" ]; then
  echo "resolve-config.sh: model_overrides[\"${RESOLVED_MODEL}\"] contains unsupported key(s): ${BAD_KEYS}" >&2
  echo "resolve-config.sh: a per-model override may set only effort, fix_threshold and timeout_secs. Changing tool or model there would contradict the model it is keyed on." >&2
  exit 1
fi

MERGED=$(jq -cn --argjson b "$BASE" --argjson o "$OVERRIDE" --argjson f "$FLAG_JSON" \
  '($b | del(.model_overrides)) * $o * $f')

TOOL=$(echo "$MERGED" | jq -r '.tool // empty')
MODEL=$(echo "$MERGED" | jq -r '.model // empty')
EFFORT=$(echo "$MERGED" | jq -r '.effort // empty')
FIX_THRESHOLD=$(echo "$MERGED" | jq -r '.fix_threshold // "high"')
TIMEOUT_SECS=$(echo "$MERGED" | jq -r '.timeout_secs // empty')

if [ -n "$TIMEOUT_SECS" ] && ! printf '%s' "$TIMEOUT_SECS" | grep -Eq '^[1-9][0-9]*$'; then
  echo "resolve-config.sh: timeout_secs must be a positive integer (got: ${TIMEOUT_SECS})" >&2
  exit 1
fi

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
      "tool": "<name>",
      "model": "<model>",
      "effort": "high",
      "fix_threshold": "high"
    }
  }

Implemented adapters, and the "model" shape each one expects:

  opencode  provider/model, e.g. the output of \`opencode models\`
  codex     a bare model name, no provider prefix
  claude    a Claude Code alias (opus, sonnet) or a full model name

Only "tool" and "model" are required. "fix_threshold" defaults to "high"
(auto-fix confirmed high/critical findings only); "effort" is optional, and its
valid values are the tool's own.

"timeout_secs" is optional too, and needed only when one model is reliably
slower than the adapter's own ceiling. Set it per model rather than globally:

  {
    "external_review": {
      "tool": "<name>",
      "model": "<model>",
      "model_overrides": {
        "<slower model>": { "timeout_secs": 1800 }
      }
    }
  }

Or pass them for a single run: --tool <name> --model <model>

For a guided setup that writes this file for you: /ak-review:setup
EOF
  exit 1
fi

jq -cn --arg tool "$TOOL" --arg model "$MODEL" --arg effort "$EFFORT" \
  --arg fix_threshold "$FIX_THRESHOLD" --arg timeout_secs "$TIMEOUT_SECS" \
  '{tool: $tool,
    model: $model,
    effort: (if $effort == "" then null else $effort end),
    fix_threshold: $fix_threshold,
    timeout_secs: (if $timeout_secs == "" then null else ($timeout_secs | tonumber) end)}'
