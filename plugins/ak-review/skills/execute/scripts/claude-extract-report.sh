#!/bin/bash
# Extracts the review report from a `claude -p --output-format stream-json` run.
#
# Claude Code's schema is its own again: the finished answer arrives in a single
# `result` event as `.result`, alongside cost and usage. Top-level assistant
# messages carry the same text incrementally, and SUB-AGENT messages carry
# theirs too — distinguished only by `parent_tool_use_id` being set.
#
# That field is the load-bearing detail here. Reading every assistant message
# would splice sub-agent chatter into the report, handing Phase 5 claims the
# coordinating agent never made. Sub-agent output has its own extractor
# (claude-extract-subagents.sh), used only on the salvage path.
set -euo pipefail

# Resolved from the script's own location, not the cwd: the shared check is a
# sibling, and this script is called with the reviewed repository as the cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -ne 1 ]; then
  echo "Usage: claude-extract-report.sh <raw-jsonl-file>" >&2
  exit 1
fi

RAW_FILE="$1"

if [ ! -f "$RAW_FILE" ]; then
  echo "claude-extract-report.sh: file not found: $RAW_FILE" >&2
  exit 1
fi

# Two jq passes, as with the other adapters' extractors: a line-by-line
# `fromjson? // empty` survives a stream truncated mid-line, which is exactly
# what a killed run leaves behind.
EVENTS=$(jq -R 'fromjson? // empty' "$RAW_FILE")

# The `result` event is authoritative when it exists — it is what the run
# concluded, after any self-correction in the assistant messages.
REPORT=$(echo "$EVENTS" | jq -rs '
  [.[] | select(.type == "result") | .result // empty] | last // empty')

# Fallback for a run killed before it concluded: the coordinating agent's own
# text, sub-agents excluded. Partial by nature, but real output.
if [ -z "$REPORT" ]; then
  REPORT=$(echo "$EVENTS" | jq -rs '
    [.[] | select(.type == "assistant")
         | select(.parent_tool_use_id == null)
         | .message.content[]? | select(.type == "text") | .text // empty]
    | join("\n\n")')
fi

if [ -z "$REPORT" ]; then
  echo "claude-extract-report.sh: no report found in $RAW_FILE" >&2
  echo "claude-extract-report.sh: neither a result event nor any top-level assistant text is present - the run produced no answer. That is NOT the same as a review that found no issues." >&2
  exit 1
fi

# A report is not merely non-empty — it must be FINISHED. Measured on a real run
# (2026-08-31): a codex review hit the account's usage limit after 25 minutes and
# produced no consolidated report, but its running narration ("I'll review this
# as a report-only audit…") is emitted as the same event type as the report. The
# empty check passed, so 1441 bytes of narration were handed on as the review —
# Phase 5 would have verified it against the code, Phase 8 called the run a free
# success.
#
# What counts as finished is delegate §8's contract, and it is the same for every
# adapter, so it lives in `report-findings-check.sh` rather than here. Everything
# above this line is this tool's event schema and stays; the check below is not.
# It was in all three extractors once, was wrong in all three at once, and a copy
# left behind would fail silently in the dangerous direction.
#
# Exit 3 is a SIGNAL, not a rejection: the prose is still written to stdout,
# because discarding it would only invert the error — a model that formats the
# block differently would turn an expensive, useful run into a reported failure.
# The caller decides what an unfinished report is worth; it must simply never be
# mistaken for a finished one.
if ! printf '%s' "$REPORT" | "${SCRIPT_DIR}/report-findings-check.sh"; then
  printf '%s\n' "$REPORT"
  echo "claude-extract-report.sh: WARNING - output found, but it carries no findings[] block, so this is NOT a finished report (delegate section 8 requires one as the last element)." >&2
  echo "claude-extract-report.sh: most likely the run was cut short - a usage limit, a timeout, or a crash - and what you have is the model's narration, not its review. Do not verify or auto-fix from it." >&2
  echo "claude-extract-report.sh: check the tail of $RAW_FILE for an error event, and the adapter's stderr sidecar." >&2
  exit 3
fi

printf '%s\n' "$REPORT"
