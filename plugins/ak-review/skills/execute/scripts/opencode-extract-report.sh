#!/bin/bash
set -euo pipefail

# Resolved from the script's own location, not the cwd: the shared check is a
# sibling, and this script is called with the reviewed repository as the cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -ne 1 ]; then
  echo "Usage: opencode-extract-report.sh <raw-jsonl-file>" >&2
  exit 1
fi

RAW_FILE="$1"

if [ ! -f "$RAW_FILE" ]; then
  echo "opencode-extract-report.sh: file not found: $RAW_FILE" >&2
  exit 1
fi

# Read line-by-line and drop any line that isn't valid JSON (`fromjson? // empty`)
# before re-assembling into an array, rather than `jq -s` parsing the whole file
# as one document. This tolerates a stream truncated mid-line — e.g. after an
# external kill on a hung run (see SKILL.md's Adapter Reference) — recovering
# every complete event instead of aborting on the first malformed one.
REPORT=$(jq -R 'fromjson? // empty' "$RAW_FILE" \
  | jq -rs 'map(select(.type == "text") | .part.text) | join("\n\n")')

if [ -z "$REPORT" ]; then
  echo "opencode-extract-report.sh: no text events found in $RAW_FILE" >&2
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
  echo "opencode-extract-report.sh: WARNING - output found, but it carries no findings[] block, so this is NOT a finished report (delegate section 8 requires one as the last element)." >&2
  echo "opencode-extract-report.sh: most likely the run was cut short - a usage limit, a timeout, or a crash - and what you have is the model's narration, not its review. Do not verify or auto-fix from it." >&2
  echo "opencode-extract-report.sh: check the tail of $RAW_FILE for an error event, and the adapter's stderr sidecar." >&2
  exit 3
fi

printf '%s\n' "$REPORT"
