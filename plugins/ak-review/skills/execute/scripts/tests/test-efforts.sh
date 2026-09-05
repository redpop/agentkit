#!/bin/bash
# Contract test for `<tool>-efforts.sh`, the optional adapter script that declares
# which effort values its tool accepts. resolve-config.sh rejects anything absent
# from that output, so the script's SHAPE is load-bearing: a stray blank line or a
# comma-separated line would quietly reject every value the adapter does accept.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$DIR/.."

fail() { echo "FAIL: $1"; exit 1; }

FOUND=0
for script in "$SCRIPTS"/*-efforts.sh; do
  [ -e "$script" ] || break
  FOUND=$((FOUND + 1))
  name=$(basename "$script")
  tool=${name%-efforts.sh}

  # An efforts script for a tool with no adapter would validate runs that can
  # never happen, and — worse — would go unnoticed, since nothing else names it.
  [ -f "$SCRIPTS/${tool}-adapter.sh" ] || fail "$name has no matching ${tool}-adapter.sh"

  OUT=$(bash "$script") || fail "$name exited non-zero"
  [ -n "$OUT" ] || fail "$name printed nothing; an empty list rejects every value"

  # One bare token per line is the whole format. grep -qxF in resolve-config.sh
  # matches a full line, so any padding or separator inside one makes that value
  # unmatchable while still looking correct in the file.
  while IFS= read -r line; do
    [ -n "$line" ] || fail "$name printed a blank line"
    case "$line" in
      *[[:space:]]*|*,*) fail "$name: '$line' is not a single bare token — one value per line" ;;
    esac
  done <<< "$OUT"

  DUPES=$(printf '%s\n' "$OUT" | sort | uniq -d)
  [ -z "$DUPES" ] || fail "$name lists a duplicate value: $DUPES"
done

[ "$FOUND" -gt 0 ] || fail "no *-efforts.sh found; the check in resolve-config.sh would never fire"

# opencode deliberately has none: its --variant is declared upstream as a
# free-form string and its levels come from the provider behind the model, not
# from opencode itself, so the adapter has no list of its own to declare. This is
# asserted rather than merely documented — adding one would silently narrow every
# opencode run to whatever list was guessed.
[ ! -f "$SCRIPTS/opencode-efforts.sh" ] || \
  fail "opencode-efforts.sh exists; opencode's variants are the provider's, not the tool's. Removing this assertion needs a reason recorded in the Adapter Reference."

echo "PASS: test-efforts.sh"
