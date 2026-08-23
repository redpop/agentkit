#!/bin/bash
# Recovers sub-agent output from a killed `claude -p` run.
#
# Claude Code dispatches sub-agents via its Task tool and merges them only at
# the end, so a run killed mid-flight still holds everything the finished ones
# produced — the same shape as opencode, and the reason both adapters have this
# script while codex does not.
#
# Sub-agent messages are identified by `parent_tool_use_id` being SET; the
# coordinating agent's own messages have it null. The adapter passes
# `--forward-subagent-text` precisely so this text reaches the stream at all.
#
# Output is prose, not the delegate `findings[]` schema: no id, severity or line
# range. SKILL.md Phase 5 says to read it as individual claims and verify each
# against the code, rather than trying to parse it.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: claude-extract-subagents.sh <raw-jsonl-file>" >&2
  exit 1
fi

RAW_FILE="$1"

if [ ! -f "$RAW_FILE" ]; then
  echo "claude-extract-subagents.sh: file not found: $RAW_FILE" >&2
  exit 1
fi

# Grouped by parent_tool_use_id so each sub-agent's findings stay together —
# one dispatch per review dimension, so the grouping is the dimension.
RESULT=$(jq -R 'fromjson? // empty' "$RAW_FILE" \
  | jq -rs '
  [.[] | select(.type == "assistant")
       | select(.parent_tool_use_id != null)
       | {id: .parent_tool_use_id,
          text: ([.message.content[]? | select(.type == "text") | .text] | join("\n"))}
       | select(.text != "")]
  | group_by(.id)
  | map("## Sub-agent \(.[0].id)\n\n" + ([.[].text] | join("\n\n")))
  | join("\n\n")')

if [ -z "$RESULT" ]; then
  echo "claude-extract-subagents.sh: no completed sub-agent output found in $RAW_FILE" >&2
  exit 1
fi

printf '%s\n' "$RESULT"
