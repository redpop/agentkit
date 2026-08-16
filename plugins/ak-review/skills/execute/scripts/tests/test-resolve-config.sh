#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../resolve-config.sh"
GLOBAL="$DIR/fixtures/global-config.json"
PROJECT_OVERRIDE="$DIR/fixtures/project-config-override.json"
EMPTY="$DIR/fixtures/empty-config.json"

# Case 1: global config only -> resolves global values, fix_threshold from global
ACTUAL=$(bash "$SCRIPT" --global-config "$GLOBAL" --project-config "$EMPTY")
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.3","effort":"high","fix_threshold":"high"}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 1 (global only): got $ACTUAL"
  exit 1
fi

# Case 2: project overrides only 'model' -> tool/effort/fix_threshold still come from global
ACTUAL=$(bash "$SCRIPT" --global-config "$GLOBAL" --project-config "$PROJECT_OVERRIDE")
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.2","effort":"high","fix_threshold":"high"}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 2 (project overrides model only): got $ACTUAL"
  exit 1
fi

# Case 3: a CLI flag overrides both files
ACTUAL=$(bash "$SCRIPT" --global-config "$GLOBAL" --project-config "$PROJECT_OVERRIDE" --model opencode-go/glm-5.1)
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.1","effort":"high","fix_threshold":"high"}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 3 (flag overrides both files): got $ACTUAL"
  exit 1
fi

# Case 4: nothing resolves tool/model -> exit 1 with guidance on stderr
if bash "$SCRIPT" --global-config "$EMPTY" --project-config "$EMPTY" 2>/tmp/resolve-config-err.txt; then
  echo "FAIL case 4: should have exited non-zero when tool/model are unresolved"
  exit 1
fi
if ! grep -q "tool" /tmp/resolve-config-err.txt || ! grep -q "model" /tmp/resolve-config-err.txt; then
  echo "FAIL case 4: error message should name both missing keys"
  cat /tmp/resolve-config-err.txt
  exit 1
fi

# Case 5: fix_threshold defaults to "high" when absent everywhere, effort stays null
ACTUAL=$(bash "$SCRIPT" --global-config "$EMPTY" --project-config "$EMPTY" --tool opencode --model opencode-go/glm-5.3)
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.3","effort":null,"fix_threshold":"high"}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 5 (defaults): got $ACTUAL"
  exit 1
fi

echo "PASS: test-resolve-config.sh"
