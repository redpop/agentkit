#!/bin/bash
# Pins the completeness check shared by all three report extractors.
#
# WHY THIS EXISTS — measured on a real run (2026-08-31, codex/gpt-5.6-sol):
# a review hit the account's usage limit after 25 minutes and produced no
# consolidated report. The stream still carried the model's running narration
# ("I'll review this as a report-only audit…"), which is emitted as the SAME
# event type as the report itself. The extractor checked only for EMPTY output,
# so it exited 0 with 1441 bytes of narration presented as the review. Phase 5
# would then have verified narration against the code, and Phase 8 would have
# reported a successful, free run.
#
# The delegate prompt (§8) requires a fenced ```json block with findings[] as the
# last thing in the response. Its presence is therefore the machine-checkable
# difference between "a report" and "the model talking".
#
# Deliberately a SIGNAL, not a rejection: exit 3 still writes the prose to
# stdout. Discarding it would only invert the error — a model that formats the
# block differently would turn an expensive, useful run into a reported failure.
# Wrong-but-confident is dangerous; incomplete-and-labelled is merely expensive.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fail() { echo "FAIL: $1"; exit 1; }

# One fixture per adapter, each in that adapter's own schema: first a complete
# report (prose + findings block), then narration only.
cat > "$WORK/codex-full.jsonl" <<'EOF'
{"type":"item.completed","item":{"type":"agent_message","text":"## Findings\n\nOne issue.\n\n```json\n{\"findings\":[{\"id\":\"F1\"}]}\n```"}}
{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}
EOF
cat > "$WORK/codex-narration.jsonl" <<'EOF'
{"type":"item.completed","item":{"type":"agent_message","text":"I'll review this as a report-only audit and dispatch sub-reviews."}}
{"type":"item.completed","item":{"type":"agent_message","text":"The first review batch is complete; continuing."}}
{"type":"turn.failed","error":{"message":"You've hit your usage limit."}}
EOF

cat > "$WORK/opencode-full.jsonl" <<'EOF'
{"type":"text","part":{"text":"## Findings\n\nOne issue.\n\n```json\n{\"findings\":[{\"id\":\"F1\"}]}\n```"}}
EOF
cat > "$WORK/opencode-narration.jsonl" <<'EOF'
{"type":"text","part":{"text":"Dispatching the security sub-agent now."}}
EOF

cat > "$WORK/claude-full.jsonl" <<'EOF'
{"type":"result","subtype":"success","total_cost_usd":0.1,"usage":{},"result":"## Findings\n\nOne issue.\n\n```json\n{\"findings\":[{\"id\":\"F1\"}]}\n```"}
EOF
cat > "$WORK/claude-narration.jsonl" <<'EOF'
{"type":"assistant","parent_tool_use_id":null,"message":{"content":[{"type":"text","text":"Starting the review, dispatching sub-agents."}]}}
EOF

# Builds one fixture line in a given adapter's schema, so a case added below is
# written once instead of three times.
wrap() {
  case "$1" in
    codex)    jq -cn --arg t "$2" '{type:"item.completed",item:{type:"agent_message",text:$t}}' ;;
    opencode) jq -cn --arg t "$2" '{type:"text",part:{text:$t}}' ;;
    claude)   jq -cn --arg t "$2" '{type:"result",subtype:"success",result:$t}' ;;
  esac
}

for tool in codex opencode claude; do
  SCRIPT="$DIR/../${tool}-extract-report.sh"

  # A complete report: exit 0, prose on stdout, nothing on stderr.
  set +e
  OUT="$(bash "$SCRIPT" "$WORK/$tool-full.jsonl" 2> "$WORK/$tool-full.err")"
  EC=$?
  set -e
  [ "$EC" -eq 0 ] || fail "$tool: a report WITH a findings block must exit 0, got $EC"
  echo "$OUT" | grep -q "One issue" || fail "$tool: the report body was not returned"
  [ ! -s "$WORK/$tool-full.err" ] || fail "$tool: a complete report must not warn: $(cat "$WORK/$tool-full.err")"

  # Narration only: exit 3, prose STILL on stdout, warning names the cause.
  set +e
  OUT="$(bash "$SCRIPT" "$WORK/$tool-narration.jsonl" 2> "$WORK/$tool-narr.err")"
  EC=$?
  set -e
  [ "$EC" -eq 3 ] || fail "$tool: narration without a findings block must exit 3, got $EC"
  [ -n "$OUT" ] || fail "$tool: exit 3 must still emit what was produced - discarding it would only invert the error"
  grep -qi "findings" "$WORK/$tool-narr.err" || fail "$tool: the warning must name the missing findings block"
  grep -qi "not a finished report\|incomplete" "$WORK/$tool-narr.err" || fail "$tool: the warning must say the report is not finished"

  # An empty stream keeps its old meaning: exit 1, nothing produced at all.
  printf '%s\n' '{"type":"other"}' > "$WORK/$tool-empty.jsonl"
  set +e
  bash "$SCRIPT" "$WORK/$tool-empty.jsonl" > /dev/null 2>&1
  EC=$?
  set -e
  [ "$EC" -eq 1 ] || fail "$tool: an empty stream must still exit 1 (not 3), got $EC"

  # REGRESSION (measured 2026-09-18): the check used to be `grep -q '"findings"'`,
  # so narration that merely QUOTES the schema key satisfied it and was handed on
  # as a finished report — the exact failure this whole file exists to prevent,
  # walking through the guard built against it. The check is structural now.
  wrap "$tool" 'I will review this as a report-only audit and end with a "findings" block as required.' \
    > "$WORK/$tool-quoted.jsonl"
  set +e
  OUT="$(bash "$SCRIPT" "$WORK/$tool-quoted.jsonl" 2> /dev/null)"
  EC=$?
  set -e
  [ "$EC" -eq 3 ] || fail "$tool: narration that only quotes \"findings\" must exit 3, got $EC"
  [ -n "$OUT" ] || fail "$tool: exit 3 must still emit what was produced"

  # The block must be TERMINAL, not merely present. A model that announces its
  # output format, echoes the schema and is then cut off has emitted a valid
  # findings block and no review — accepting a block anywhere would pass that as
  # finished, which is this file's failure mode wearing a fence.
  wrap "$tool" 'I will produce the report in this format:

```json
{"findings":[]}
```

Now reading the diff, starting with the security dimen' > "$WORK/$tool-echoed.jsonl"
  set +e
  bash "$SCRIPT" "$WORK/$tool-echoed.jsonl" > /dev/null 2>&1
  EC=$?
  set -e
  [ "$EC" -eq 3 ] || fail "$tool: an echoed schema followed by narration must exit 3, got $EC"

  # The accepted cost of that rule, pinned so it is a decision and not a
  # surprise: a finished review that appends anything after its findings block
  # is reported as unfinished. Loud and recoverable — the prose is still
  # returned — where the opposite error is silent and fixes code from narration.
  wrap "$tool" '## Findings

One issue.

```json
{"findings":[{"id":"F1"}]}
```

Reproduce with:

```bash
npm test
```' > "$WORK/$tool-trailing.jsonl"
  set +e
  OUT="$(bash "$SCRIPT" "$WORK/$tool-trailing.jsonl" 2> /dev/null)"
  EC=$?
  set -e
  [ "$EC" -eq 3 ] || fail "$tool: a findings block that is not terminal must exit 3, got $EC"
  [ -n "$OUT" ] || fail "$tool: exit 3 must still emit what was produced"

  # Trailing blank lines are whitespace, not content.
  wrap "$tool" '```json
{"findings":[{"id":"F1"}]}
```

' > "$WORK/$tool-padded.jsonl"
  set +e
  bash "$SCRIPT" "$WORK/$tool-padded.jsonl" > /dev/null 2>&1
  EC=$?
  set -e
  [ "$EC" -eq 0 ] || fail "$tool: trailing blank lines must not make a report unfinished, got $EC"

  echo "  ok: $tool"
done

echo "PASS: test-report-completeness.sh"
