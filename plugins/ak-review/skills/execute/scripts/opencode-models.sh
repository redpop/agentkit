#!/bin/bash
# Lists the models this adapter can be pointed at, one per line.
#
# Part of the three-script adapter convention (adapter / preflight / models).
# `/ak-review:setup` calls this so the user picks from what the tool actually
# offers — the plugin must never propose a model of its own.
set -euo pipefail

if ! command -v opencode > /dev/null 2>&1; then
  echo "opencode-models.sh: \`opencode\` not found on PATH. Install it from https://opencode.ai first." >&2
  exit 1
fi

if ! opencode models; then
  echo "opencode-models.sh: \`opencode models\` failed. Check that opencode runs and is authenticated (\`opencode auth list\`)." >&2
  exit 1
fi
