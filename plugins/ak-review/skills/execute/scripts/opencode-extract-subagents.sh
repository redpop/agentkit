#!/bin/bash
# Recovers the results of completed sub-agents from a raw adapter stream.
#
# This exists because a hung run is not an empty run. The external tool
# dispatches one sub-agent per review dimension and only writes the merged
# report at the very end, so a run that stalls before that point still holds
# every finding the finished sub-agents produced — in `tool_use` parts, which
# `opencode-extract-report.sh` cannot see: it reads `text` parts, and those carry the
# agent's own prose, not its tools' output.
#
# Measured on a real stalled run: `opencode-extract-report.sh` recovered 91 characters
# of narration ("dispatching the four review sub-agents") while 4085 characters
# of actual findings sat unread in a completed `task` result. The paid work was
# done and nothing was reading it.
#
# Only `completed` sub-agents are emitted. A run that was killed mid-flight
# also carries `pending` or `running` entries whose output is absent or partial,
# and a half-written finding is worse than a missing one.
#
# Tolerant of a truncated trailing line, for the same reason as its siblings:
# the stream this reads is usually one that was killed. Also tolerant of a
# `part` that isn't an object at all — this parses an undocumented schema of
# an actively developed tool, and a shape change must not crash the script
# with a raw jq indexing error before either of its own messages can print.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: opencode-extract-subagents.sh <raw-jsonl-file>" >&2
  exit 1
fi

RAW_FILE="$1"

if [ ! -f "$RAW_FILE" ]; then
  echo "opencode-extract-subagents.sh: file not found: $RAW_FILE" >&2
  exit 1
fi

RESULTS=$(jq -R 'fromjson? // empty' "$RAW_FILE" | jq -rs '
  map(select(.type == "tool_use")
      | select((.part | type) == "object")
      | .part
      | select(.tool == "task")
      | select(.state.status == "completed")
      | "## " + (.state.title // "untitled sub-agent") + "\n\n" + (.state.output // ""))
  | join("\n\n---\n\n")')

if [ -z "$RESULTS" ]; then
  echo "opencode-extract-subagents.sh: no completed sub-agent results found in $RAW_FILE" >&2
  exit 1
fi

printf '%s\n' "$RESULTS"
