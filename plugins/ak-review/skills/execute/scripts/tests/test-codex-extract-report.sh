#!/bin/bash
# Pins codex-extract-report.sh against codex's JSONL event schema.
#
# Codex's stream is shaped nothing like opencode's: the report arrives as
# `item.completed` events whose `.item.type` is `agent_message`, not as the
# `text`/`.part.text` events opencode emits. The two extractors are separate
# scripts for exactly this reason — see SKILL.md's Adapter Reference.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../codex-extract-report.sh"
FIXTURE="$DIR/fixtures/codex-sample-run-output.jsonl"
TRUNCATED_FIXTURE="$DIR/fixtures/codex-truncated-run-output.jsonl"

fail() { echo "FAIL: $1"; exit 1; }

# Case 1: every agent_message is recovered, in order, and nothing else is.
# reasoning and command_execution items must NOT leak into the report — they are
# the model's scratch work, and feeding them to Phase 5 as findings would invent
# claims the reviewer never made.
ACTUAL="$(bash "$SCRIPT" "$FIXTURE")"
EXPECTED='## Findings

Security dimension: no issues found.

```json
{"findings":[]}
```'

[ "$ACTUAL" = "$EXPECTED" ] || {
  echo "FAIL: case 1: output did not match"
  diff <(echo "$ACTUAL") <(echo "$EXPECTED") || true
  exit 1
}

echo "$ACTUAL" | grep -q "Planning the review dimensions" \
  && fail "case 1: reasoning items must not appear in the report"
echo "$ACTUAL" | grep -q "git diff --stat" \
  && fail "case 1: command_execution items must not appear in the report"

# Case 2: a missing file exits non-zero rather than printing an empty report.
if bash "$SCRIPT" "$DIR/fixtures/does-not-exist.jsonl" 2> /dev/null; then
  fail "case 2: a missing file must exit non-zero"
fi

# Case 3: a stream truncated mid-line still yields every COMPLETE event. A codex
# run killed at the timeout ceiling leaves exactly this shape, and the salvage
# path depends on the partial file being readable.
TRUNCATED_ACTUAL="$(bash "$SCRIPT" "$TRUNCATED_FIXTURE")"
TRUNCATED_EXPECTED='## Findings

Security dimension: no issues found.'

[ "$TRUNCATED_ACTUAL" = "$TRUNCATED_EXPECTED" ] || {
  echo "FAIL: case 3: truncated stream not recovered"
  diff <(echo "$TRUNCATED_ACTUAL") <(echo "$TRUNCATED_EXPECTED") || true
  exit 1
}

# Case 4: a stream with no agent_message at all exits non-zero. This is the
# honest signal for a codex run that died before answering — unlike opencode,
# there are no sub-agent partials to fall back on, so an empty report here means
# genuinely nothing was produced and the caller must not read it as "no findings".
NOTHING="$(mktemp)"
trap 'rm -f "$NOTHING"' EXIT
printf '%s\n' '{"type":"thread.started"}' '{"type":"turn.started"}' > "$NOTHING"
if bash "$SCRIPT" "$NOTHING" 2> /dev/null; then
  fail "case 4: a stream with no agent_message must exit non-zero"
fi

echo "PASS: test-codex-extract-report.sh"
