#!/bin/bash
# Lists the effort values this adapter accepts, one per line.
#
# The list is maintained here rather than queried, because codex exposes no
# machine-readable enum: `model_reasoning_effort` is a config key, and an
# invalid value is rejected by the API mid-run, long after the money and the
# minutes are spent. The same reasoning that keeps authentication parsing out of
# opencode's preflight applies in reverse here — a value we CAN check cheaply and
# reliably is worth checking, even from a hand-kept list.
#
# Source: the API's own enum, as recorded in codex-adapter.sh. The "Ultra" shown
# in codex's interactive model picker is not one of them. Verified against
# codex-cli 0.149.0. When upstream adds a level, add it here too — resolve-config.sh
# rejects anything absent from this list, so a stale list blocks a valid value.
set -euo pipefail

cat <<'VALUES'
none
minimal
low
medium
high
xhigh
max
VALUES
