#!/bin/bash
set -euo pipefail

GLOBAL_CONFIG="${HOME}/.claude/ak-review.local.json"
PROJECT_CONFIG=".claude/ak-review.local.json"

# Resolved from the script's own location, not the cwd: the two config paths above
# are deliberately cwd-relative, but the sibling adapter scripts are not.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FLAG_TOOL=""
FLAG_MODEL=""
FLAG_EFFORT=""
FLAG_EFFORT_SEEN=0
FLAG_NO_EFFORT=0
FLAG_FIX_THRESHOLD=""
FLAG_TIMEOUT_SECS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --tool) FLAG_TOOL="$2"; shift 2 ;;
    --model) FLAG_MODEL="$2"; shift 2 ;;
    --effort) FLAG_EFFORT="$2"; FLAG_EFFORT_SEEN=1; shift 2 ;;
    --no-effort) FLAG_NO_EFFORT=1; shift ;;
    --fix-threshold) FLAG_FIX_THRESHOLD="$2"; shift 2 ;;
    --timeout-secs) FLAG_TIMEOUT_SECS="$2"; shift 2 ;;
    --project-config) PROJECT_CONFIG="$2"; shift 2 ;;
    --global-config) GLOBAL_CONFIG="$2"; shift 2 ;;
    *) echo "resolve-config.sh: unknown argument: $1" >&2; exit 1 ;;
  esac
done

# --effort with an empty value used to be the obvious way to ask for "no effort
# this run", and it silently did nothing: the flag merge drops empty values, so
# it read as "not given" and the configured value survived. That dead end is now
# an error pointing at the flag that does work.
if [ "$FLAG_EFFORT_SEEN" = "1" ] && [ -z "$FLAG_EFFORT" ]; then
  echo "resolve-config.sh: --effort was given an empty value. To run without an effort, use --no-effort." >&2
  exit 1
fi

if [ "$FLAG_EFFORT_SEEN" = "1" ] && [ "$FLAG_NO_EFFORT" = "1" ]; then
  echo "resolve-config.sh: --effort and --no-effort contradict each other; pass one or the other." >&2
  exit 1
fi

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

# `effort` is deliberately absent here and resolved on its own further down: it
# is the one setting whose meaning depends on `tool`, so it cannot be merged by
# the same rules as values that mean the same thing under every adapter.
FLAG_JSON=$(jq -cn \
  --arg tool "$FLAG_TOOL" --arg model "$FLAG_MODEL" \
  --arg fix_threshold "$FLAG_FIX_THRESHOLD" \
  --arg timeout_secs "$FLAG_TIMEOUT_SECS" \
  '{tool: $tool, model: $model, fix_threshold: $fix_threshold,
    timeout_secs: $timeout_secs}
   | with_entries(select(.value != ""))
   | if has("timeout_secs") then .timeout_secs |= tonumber else . end')

# Which `effort` the files contribute, and — for the bare-string form — which
# tool it was written for. A string says "this level, for my setup", and the
# setup it belongs to is the `tool` in force at the layer that set it: the
# project file's own `tool` if it has one, otherwise the global file's. That
# pairing is what makes the cross-tool check below possible without tracking
# provenance for every key.
#
# Two objects merge key by key, so a project file naming one adapter's level
# extends the global map instead of replacing it — the same rule `model_overrides`
# follows. A string replaces whatever is underneath it outright, because it
# carries no key to merge on.
EFFORT_SPEC=$(jq -cn --argjson g "$GLOBAL_JSON" --argjson p "$PROJECT_JSON" '
  ($p.tool // $g.tool // null) as $ptool
  | ($g.tool // null) as $gtool
  | if ($p | has("effort")) and ($g | has("effort"))
       and ($p.effort | type) == "object" and ($g.effort | type) == "object"
    then {value: ($g.effort * $p.effort), owner: null}
    elif ($p | has("effort")) then {value: $p.effort, owner: $ptool}
    elif ($g | has("effort")) then {value: $g.effort, owner: $gtool}
    else {value: null, owner: null} end')

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
  '($b | del(.model_overrides) | del(.effort)) * ($o | del(.effort)) * $f')

TOOL=$(echo "$MERGED" | jq -r '.tool // empty')
MODEL=$(echo "$MERGED" | jq -r '.model // empty')
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
      "effort": { "<name>": "<level>" },
      "fix_threshold": "high"
    }
  }

Implemented adapters, and the "model" shape each one expects:

  opencode  provider/model, e.g. the output of \`opencode models\`
  codex     a bare model name, no provider prefix
  claude    a Claude Code alias (opus, sonnet) or a full model name

Only "tool" and "model" are required. "fix_threshold" defaults to "high"
(auto-fix confirmed high/critical findings only).

"effort" is optional, and its valid values are the tool's own — which is why it
is keyed by tool name: no adapter shares another's levels, and keying them keeps
a --tool switch from running the review at a level meant for something else. A
tool absent from the map simply runs without an effort. A plain string works too
and means "for the tool configured beside it", but it stops the run if a
different tool is used.

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

# `effort` resolves here rather than in the merge above, because it is the only
# setting whose vocabulary belongs to the adapter: codex's `xhigh` and Claude
# Code's `xhigh` are the same word for unrelated enums, and opencode's variants
# are the provider's. A value is therefore only meaningful next to the tool it
# was written for, which is what the object form makes explicit.
#
# Precedence, lowest first: the object form's entry for the resolved tool, a bare
# string, a `model_overrides` entry, `--effort`, `--no-effort`. Each later source
# also clears the "unchecked bare string" mark, because the cross-tool question
# only applies to a value the config volunteered for a different setup.
EFFORT=""
EFFORT_OWNER=""
EFFORT_IS_BARE_STRING=0

case "$(echo "$EFFORT_SPEC" | jq -r '.value | type')" in
  object)
    # Keyed by tool, so a run under an adapter the map does not mention gets no
    # effort at all — the whole point of the form.
    EFFORT=$(echo "$EFFORT_SPEC" | jq -r --arg t "$TOOL" '.value[$t] // empty')
    ;;
  string)
    EFFORT=$(echo "$EFFORT_SPEC" | jq -r '.value')
    EFFORT_OWNER=$(echo "$EFFORT_SPEC" | jq -r '.owner // empty')
    EFFORT_IS_BARE_STRING=1
    ;;
esac

# `has` rather than a truthiness test: an override setting `effort` to `null`
# means "unset it for this model", which must beat the config and must not be
# mistaken for the key being absent.
if echo "$OVERRIDE" | jq -e 'has("effort")' > /dev/null; then
  EFFORT=$(echo "$OVERRIDE" | jq -r '.effort // empty')
  EFFORT_IS_BARE_STRING=0
fi

if [ "$FLAG_EFFORT_SEEN" = "1" ]; then
  EFFORT="$FLAG_EFFORT"
  EFFORT_IS_BARE_STRING=0
fi

if [ "$FLAG_NO_EFFORT" = "1" ]; then
  EFFORT=""
  EFFORT_IS_BARE_STRING=0
fi

# A bare string was written for one adapter and this run uses another. Refusing
# is the point: the alternative is what this check replaced — the value reaching
# a tool that accepts anything and reviewing under a level nobody chose. It is
# refused rather than dropped silently, because a review that quietly runs at a
# different effort than the config states is exactly as misleading as one that
# runs at an invalid one.
if [ "$EFFORT_IS_BARE_STRING" = "1" ] && [ -n "$EFFORT_OWNER" ] && [ "$EFFORT_OWNER" != "$TOOL" ]; then
  cat >&2 <<EOF
resolve-config.sh: effort "${EFFORT}" is configured as a plain string, which belongs
to the tool configured alongside it ("${EFFORT_OWNER}"). This run uses "${TOOL}".

Effort vocabularies are the adapter's own — codex, claude and opencode do not share
one — so carrying this value across would run the review at a level nobody chose.

Pick one:

  --no-effort        run this once with no effort at all
  --effort <value>   state the level for "${TOOL}" explicitly, for this run
  config             key the setting by tool, so it survives a switch:

                       "effort": {
                         "${EFFORT_OWNER}": "${EFFORT}",
                         "${TOOL}": "<the level ${TOOL} should use, or omit this line>"
                       }
EOF
  exit 1
fi

# Beyond the cross-tool question, an adapter may also declare which values it
# accepts at all. Checking that here rather than in the adapter is the same call
# made for --timeout-secs above: the adapter sees an env var and would name that,
# not the flag or the config key the value actually came from.
#
# An adapter opts in by shipping `<tool>-efforts.sh`; one without it is not
# checked against a list. `opencode` is that case — its variants are the
# provider's rather than the tool's, so it has no list of its own — but the
# cross-tool check above does not depend on such a list and covers it too.
EFFORTS_SCRIPT="${SCRIPT_DIR}/${TOOL}-efforts.sh"
if [ -n "$EFFORT" ] && [ -f "$EFFORTS_SCRIPT" ]; then
  ALLOWED=$(bash "$EFFORTS_SCRIPT")
  if ! printf '%s\n' "$ALLOWED" | grep -qxF -- "$EFFORT"; then
    ALLOWED_LIST=$(printf '%s\n' "$ALLOWED" | paste -sd ' ' -)
    cat >&2 <<EOF
resolve-config.sh: effort "${EFFORT}" is not one the "${TOOL}" adapter accepts.

Accepted by ${TOOL}: ${ALLOWED_LIST}

Effort vocabularies belong to the adapter, so this usually means the value was
written for a different tool and inherited into this run — most often by passing
--tool to switch adapters while effort stayed behind in the config.

Resolve it in one of these ways:

  --effort <value>   pick one of the accepted values above, for this run
  model_overrides    unset the inherited value for this model, in the config file:

                       "model_overrides": {
                         "${MODEL}": { "effort": null }
                       }

If "${EFFORT}" is in fact a level ${TOOL} has since gained, the list lives in
${TOOL}-efforts.sh and needs it added there.
EOF
    exit 1
  fi
fi

jq -cn --arg tool "$TOOL" --arg model "$MODEL" --arg effort "$EFFORT" \
  --arg fix_threshold "$FIX_THRESHOLD" --arg timeout_secs "$TIMEOUT_SECS" \
  '{tool: $tool,
    model: $model,
    effort: (if $effort == "" then null else $effort end),
    fix_threshold: $fix_threshold,
    timeout_secs: (if $timeout_secs == "" then null else ($timeout_secs | tonumber) end)}'
