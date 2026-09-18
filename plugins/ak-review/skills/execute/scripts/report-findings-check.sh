#!/bin/bash
# Decides whether a report is FINISHED. Reads the report on stdin; exit 0 = yes,
# exit 1 = no. Prints nothing — the caller owns its own exit codes and messages.
#
# Shared on purpose, unlike the extractors that call it. Those are per-adapter
# because each tool emits its own event schema, and that reason ends where the
# schema does: by the time a report reaches here it is plain markdown, and the
# contract being checked is delegate §8, which is identical for every tool.
# Keeping it in three files meant one idea in three places — and it was wrong in
# all three at once (a `grep -q '"findings"'` that passed narration quoting the
# key), then changed in all three on the same day. A copy left behind fails
# SILENTLY and in the dangerous direction: it exits 0, and the caller auto-fixes
# code from a model's narration.
#
# Two things are required, and the second is the one that is easy to miss:
#
# 1. `findings` must BE an array. A substring test for the key passes a model
#    writing «I'll end with a "findings" block as required» — measured
#    2026-09-18, on a guard built in response to exactly that failure.
#
# 2. The block must be TERMINAL — the last non-whitespace thing in the output,
#    which is what delegate §8 asks for. Position is what separates a report
#    from an announcement of one: a model that opens with «I'll produce output
#    like this:», echoes the schema and is then cut off has emitted a perfectly
#    valid findings block and no review at all.
#
# The cost of (2) is real and accepted: a finished review that appends anything
# after its findings block — a reproduction snippet, a closing sentence — is
# reported as unfinished. That direction is loud, keeps the prose and costs one
# paid run's auto-fix. The other is silent and fixes code from narration.
set -euo pipefail

REPORT="$(cat)"

# The final fenced block, and only if the output ends with it. Everything after
# the closing fence must be whitespace, or there is no candidate at all.
TERMINAL_BLOCK=$(printf '%s' "$REPORT" | awk '
  { line[NR] = $0 }
  END {
    for (i = NR; i >= 1; i--) if (line[i] ~ /[^[:space:]]/) { last = i; break }
    if (!last || line[last] !~ /^[[:space:]]*```[[:space:]]*$/) exit
    for (i = last - 1; i >= 1; i--) if (line[i] ~ /^[[:space:]]*```/) { open = i; break }
    if (!open) exit
    for (i = open + 1; i < last; i++) print line[i]
  }')

if printf '%s' "$TERMINAL_BLOCK" | jq -e '(.findings | type) == "array"' > /dev/null 2>&1; then
  exit 0
fi

# A model that emits the object with no fence at all has still finished, and the
# whole output is terminal by construction.
if printf '%s' "$REPORT" | jq -e '(.findings | type) == "array"' > /dev/null 2>&1; then
  exit 0
fi

exit 1
