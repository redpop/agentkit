#!/bin/bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$DIR/../resolve-config.sh"
GLOBAL="$DIR/fixtures/global-config.json"
PROJECT_OVERRIDE="$DIR/fixtures/project-config-override.json"
EMPTY="$DIR/fixtures/empty-config.json"
OVERRIDES="$DIR/fixtures/model-overrides-config.json"
OVERRIDES_BAD="$DIR/fixtures/model-overrides-bad-key.json"
OVERRIDES_NULL="$DIR/fixtures/model-overrides-null-effort.json"

# Case 1: global config only -> resolves global values, fix_threshold from global
ACTUAL=$(bash "$SCRIPT" --global-config "$GLOBAL" --project-config "$EMPTY")
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.3","effort":"high","fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 1 (global only): got $ACTUAL"
  exit 1
fi

# Case 2: project overrides only 'model' -> tool/effort/fix_threshold still come from global
ACTUAL=$(bash "$SCRIPT" --global-config "$GLOBAL" --project-config "$PROJECT_OVERRIDE")
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.2","effort":"high","fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 2 (project overrides model only): got $ACTUAL"
  exit 1
fi

# Case 3: a CLI flag overrides both files
ACTUAL=$(bash "$SCRIPT" --global-config "$GLOBAL" --project-config "$PROJECT_OVERRIDE" --model opencode-go/glm-5.1)
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.1","effort":"high","fix_threshold":"high","timeout_secs":null}'
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
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.3","effort":null,"fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 5 (defaults): got $ACTUAL"
  exit 1
fi

# Case 6: a model_overrides entry applies when its key is the resolved model.
# This is the whole point of the feature — one model being slower than the
# adapter's ceiling must not force every other model to wait as long.
ACTUAL=$(bash "$SCRIPT" --global-config "$OVERRIDES" --project-config "$EMPTY" --model opencode-go/glm-5.3-flash)
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.3-flash","effort":"high","fix_threshold":"high","timeout_secs":1800}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 6 (model override applies): got $ACTUAL"
  exit 1
fi

# Case 7: the same config resolved for a DIFFERENT model keeps the base value,
# and never leaks the map itself into the output.
ACTUAL=$(bash "$SCRIPT" --global-config "$OVERRIDES" --project-config "$EMPTY")
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.3","effort":"high","fix_threshold":"high","timeout_secs":1200}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 7 (non-matching model keeps base timeout): got $ACTUAL"
  exit 1
fi
case "$ACTUAL" in *model_overrides*) echo "FAIL case 7: model_overrides must not appear in the output"; exit 1 ;; esac

# Case 8: an explicit flag still wins over the per-model override. The override
# is a default for a model, not a lock on it.
ACTUAL=$(bash "$SCRIPT" --global-config "$OVERRIDES" --project-config "$EMPTY" \
  --model opencode-go/glm-5.3-flash --timeout-secs 600)
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.3-flash","effort":"high","fix_threshold":"high","timeout_secs":600}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 8 (flag beats model override): got $ACTUAL"
  exit 1
fi

# Case 9: a non-numeric --timeout-secs is rejected here, naming the flag. The
# adapter would also reject it, but its message names the env var — which is not
# where the user typed it.
if bash "$SCRIPT" --global-config "$OVERRIDES" --project-config "$EMPTY" --timeout-secs abc 2>/tmp/resolve-config-err.txt; then
  echo "FAIL case 9: should have exited non-zero on a non-numeric --timeout-secs"
  exit 1
fi
if ! grep -q -- "--timeout-secs" /tmp/resolve-config-err.txt; then
  echo "FAIL case 9: error message should name the flag"
  cat /tmp/resolve-config-err.txt
  exit 1
fi

# Case 10: an override that tries to change `model` is refused, not ignored.
# Applying it would mean the resolved model is no longer the one whose entry was
# looked up, so the config would silently contradict itself.
if bash "$SCRIPT" --global-config "$OVERRIDES_BAD" --project-config "$EMPTY" 2>/tmp/resolve-config-err.txt; then
  echo "FAIL case 10: should have exited non-zero on an override containing 'model'"
  exit 1
fi
if ! grep -q "model" /tmp/resolve-config-err.txt; then
  echo "FAIL case 10: error message should name the offending key"
  cat /tmp/resolve-config-err.txt
  exit 1
fi

# Case 11: `null` in an override UNSETS an inherited value. Without this there is
# no way to switch tools per model: effort vocabularies are adapter-specific, so
# a codex "xhigh" inherited by an opencode run becomes a --variant that tool
# never defined.
ACTUAL=$(bash "$SCRIPT" --global-config "$OVERRIDES_NULL" --project-config "$EMPTY" \
  --tool opencode --model opencode-go/glm-5.3-flash)
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.3-flash","effort":null,"fix_threshold":"high","timeout_secs":1800}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 11 (null override unsets effort): got $ACTUAL"
  exit 1
fi

echo "PASS: test-resolve-config.sh"
