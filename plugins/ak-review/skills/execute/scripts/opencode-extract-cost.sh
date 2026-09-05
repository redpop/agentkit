#!/bin/bash
# Extracts cost and usage from an `opencode run --format json` stream.
#
# The sum is over `step_finish` events, and those exist only for the session
# that emitted them. Sub-agents run in their OWN sessions, and opencode does not
# put their `step_finish` events into the parent's stream — so summing what is
# there yields the parent's spend alone, not the run's.
#
# Measured on a real four-dimension review (ses_f8e722a75ffe…): 23 step_finish
# events, all carrying the parent session id, against two completed sub-agents
# whose results were present as 32 KB of `task` output. The extractor reported
# $0.8589. Across the two runs in that provider billing window the extractors
# reported $1.1727 against $3.1749 actually charged — a factor of 2.7, and the
# user went over quota without the reported figure ever hinting at it.
#
# What the stream DOES carry is each sub-agent's session id, in the `task`
# part's `state.metadata.sessionId`. That is enough to count them and to say
# what is missing, which is why `total_cost` goes null only when at least one is
# present: a run without sub-agents is fully accounted for and still reports a
# real number. The sub-sessions themselves are not queryable after the fact —
# they are not written to opencode's local storage — so the amount cannot be
# recovered, only declared unknown.
#
# A stream with no `step_finish` at all was never measured, so every figure is
# `null` rather than 0 -- the same distinction, applied to a run that was killed
# before it billed anything rather than to one whose sub-agents went uncounted.
#
# Zero and "not reported" are different claims and only one of them is true;
# a partial sum presented as a total is the third and worst option, because it
# is the one a reader acts on.
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
# `jq -s` would abort on the first malformed line instead of degrading to an
# unmeasured one.
#
# Sub-agents are counted by distinct session id rather than by `task` part,
# because a retried or resumed task can appear more than once for one session,
# and the question here is how many sessions went unbilled. Only `completed`
# ones are counted: a `running` task at the moment the stream ended may never
# have reached the model, and claiming an unknown cost for it would overstate
# what is missing.
jq -R 'fromjson? // empty' "$RAW_FILE" \
  | jq -cs '
  ([.[]
    | select(.type == "tool_use")
    | select((.part | type) == "object")
    | .part
    | select(.tool == "task")
    | select(.state.status == "completed")
    | .state.metadata.sessionId // empty]
   | unique) as $subs
  | ([.[] | select(.type == "step_finish")]) as $steps
  | ($steps | length > 0) as $measured
  | (if $measured then ($steps | map(.part.cost // 0) | add) else null end) as $parent_cost
  | {
      total_cost: (if ($subs | length) > 0 then null else $parent_cost end),
      total_tokens: (if $measured then ($steps | map(.part.tokens.total // 0) | add) else null end),
      parent_session_cost: $parent_cost,
      subagent_sessions: ($subs | length)
    }'
