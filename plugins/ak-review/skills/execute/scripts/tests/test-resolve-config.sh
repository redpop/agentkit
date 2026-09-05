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
CROSS_TOOL="$DIR/fixtures/cross-tool-effort-config.json"
BY_TOOL="$DIR/fixtures/effort-by-tool-config.json"
BY_TOOL_PROJECT="$DIR/fixtures/effort-by-tool-project.json"
BY_TOOL_INVALID="$DIR/fixtures/effort-by-tool-invalid.json"

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

# --- effort is adapter-specific: cases 12-22 -------------------------------
#
# A plain-string `effort` says "this level, for my setup", and the setup is the
# `tool` sitting beside it. `--tool` can be switched for one run and the string
# cannot, so the string arrives under an adapter it was never written for. These
# cases pin down that a switch is refused, and — just as important — that every
# way of answering the refusal actually works.

# Case 12: a bare string does not travel to another adapter. `none` is a real
# codex level and not a claude one, but the check does not depend on that: it is
# the mismatch between the tool the string was written beside and the tool now
# running that decides.
if bash "$SCRIPT" --global-config "$CROSS_TOOL" --project-config "$EMPTY" \
  --tool claude --model opus 2>/tmp/resolve-config-err.txt; then
  echo "FAIL case 12: a bare-string effort must not carry across a tool switch"
  exit 1
fi
if ! grep -q "claude" /tmp/resolve-config-err.txt || ! grep -q "codex" /tmp/resolve-config-err.txt; then
  echo "FAIL case 12: the message must name both the tool it was written for and the one running"
  cat /tmp/resolve-config-err.txt
  exit 1
fi

# Case 13: the same refusal for an adapter that declares NO value list. opencode
# is that adapter, and this is the case originally reported: before the owner
# check existed, a codex level reached `opencode run --variant` unchallenged,
# because a declared-values check has nothing to compare against there. The value
# used here is valid for codex, which is what makes it a silent failure rather
# than a loud one.
if bash "$SCRIPT" --global-config "$OVERRIDES_NULL" --project-config "$EMPTY" \
  --tool opencode --model opencode-go/glm-5.3 2>/tmp/resolve-config-err.txt; then
  echo "FAIL case 13: a bare-string effort must not reach opencode either"
  exit 1
fi
if ! grep -q "opencode" /tmp/resolve-config-err.txt; then
  echo "FAIL case 13: the message must name opencode as the running tool"
  cat /tmp/resolve-config-err.txt
  exit 1
fi

# Case 14: a value both enums happen to contain is refused just the same. Sharing
# a spelling is not sharing a meaning — codex's `xhigh` and Claude Code's `xhigh`
# name levels of unrelated scales — so agreeing to carry it across would be
# guessing that they mean the same thing.
if bash "$SCRIPT" --global-config "$OVERRIDES_NULL" --project-config "$EMPTY" \
  --tool claude --model opus 2>/dev/null; then
  echo "FAIL case 14: a shared spelling must not make a bare string transferable"
  exit 1
fi

# Case 15: no switch, no refusal. The configured tool running its own configured
# effort is the ordinary case and must stay untouched.
ACTUAL=$(bash "$SCRIPT" --global-config "$CROSS_TOOL" --project-config "$EMPTY")
EXPECTED='{"tool":"codex","model":"gpt-5.6-sol","effort":"none","fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 15 (no tool switch, effort applies): got $ACTUAL"
  exit 1
fi

# Case 16: --no-effort answers the refusal, and is the only way to drop an
# inherited effort for a single run without editing a file.
ACTUAL=$(bash "$SCRIPT" --global-config "$CROSS_TOOL" --project-config "$EMPTY" \
  --tool claude --model opus --no-effort)
EXPECTED='{"tool":"claude","model":"opus","effort":null,"fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 16 (--no-effort clears an inherited effort): got $ACTUAL"
  exit 1
fi

# Case 17: an explicit --effort answers it too. The user naming a level for the
# tool they just named is the one case where no inference is involved at all.
ACTUAL=$(bash "$SCRIPT" --global-config "$CROSS_TOOL" --project-config "$EMPTY" \
  --tool claude --model opus --effort max)
EXPECTED='{"tool":"claude","model":"opus","effort":"max","fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 17 (--effort overrides an inherited one): got $ACTUAL"
  exit 1
fi

# Case 18: a `model_overrides` entry with `effort: null` answers it as well, and
# must not itself trip the check it exists to avoid.
ACTUAL=$(bash "$SCRIPT" --global-config "$OVERRIDES_NULL" --project-config "$EMPTY" \
  --tool opencode --model opencode-go/glm-5.3-flash)
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.3-flash","effort":null,"fix_threshold":"high","timeout_secs":1800}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 18 (null override clears effort ahead of the check): got $ACTUAL"
  exit 1
fi

# Case 19: the object form binds each level to its tool, so a switch needs no
# answer at all — this is the form the refusal steers users towards.
ACTUAL=$(bash "$SCRIPT" --global-config "$BY_TOOL" --project-config "$EMPTY")
EXPECTED='{"tool":"codex","model":"gpt-5.6-sol","effort":"xhigh","fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 19 (object form, configured tool): got $ACTUAL"
  exit 1
fi
ACTUAL=$(bash "$SCRIPT" --global-config "$BY_TOOL" --project-config "$EMPTY" --tool claude --model opus)
EXPECTED='{"tool":"claude","model":"opus","effort":"high","fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 19 (object form, switched tool): got $ACTUAL"
  exit 1
fi

# Case 20: an adapter the map does not mention gets no effort, silently and
# correctly — there is nothing to inherit, so there is nothing to warn about.
ACTUAL=$(bash "$SCRIPT" --global-config "$BY_TOOL" --project-config "$EMPTY" \
  --tool opencode --model opencode-go/glm-5.3)
EXPECTED='{"tool":"opencode","model":"opencode-go/glm-5.3","effort":null,"fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 20 (object form, tool absent from the map): got $ACTUAL"
  exit 1
fi

# Case 21: two object forms merge key by key, so a project file naming one
# adapter's level keeps the global map's other entries — the same rule
# model_overrides follows, and the reason the form scales to a shared global file
# with per-project exceptions.
ACTUAL=$(bash "$SCRIPT" --global-config "$BY_TOOL" --project-config "$BY_TOOL_PROJECT" \
  --tool claude --model opus)
EXPECTED='{"tool":"claude","model":"opus","effort":"max","fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 21 (project map entry wins for its key): got $ACTUAL"
  exit 1
fi
ACTUAL=$(bash "$SCRIPT" --global-config "$BY_TOOL" --project-config "$BY_TOOL_PROJECT")
EXPECTED='{"tool":"codex","model":"gpt-5.6-sol","effort":"xhigh","fix_threshold":"high","timeout_secs":null}'
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "FAIL case 21 (project map does not replace the global one): got $ACTUAL"
  exit 1
fi

# Case 22: the declared-values check still fires on a value the owner check has
# no reason to question — here the map names the running tool, so the level is
# deliberate and simply wrong. Without this, the two checks could not be told
# apart by their tests.
if bash "$SCRIPT" --global-config "$BY_TOOL_INVALID" --project-config "$EMPTY" \
  --tool claude --model opus 2>/tmp/resolve-config-err.txt; then
  echo "FAIL case 22: a value the adapter does not accept must still be refused"
  exit 1
fi
if ! grep -q "accepts" /tmp/resolve-config-err.txt; then
  echo "FAIL case 22: this must be the declared-values message, not the cross-tool one"
  cat /tmp/resolve-config-err.txt
  exit 1
fi

# Case 23: `--effort ""` is an error naming --no-effort. It used to be silently
# ignored — the flag merge dropped empty values, so the configured effort
# survived a run that had explicitly asked for none. That dead end is the reason
# --no-effort exists.
if bash "$SCRIPT" --global-config "$GLOBAL" --project-config "$EMPTY" --effort "" 2>/tmp/resolve-config-err.txt; then
  echo "FAIL case 23: an empty --effort must not be silently ignored"
  exit 1
fi
if ! grep -q -- "--no-effort" /tmp/resolve-config-err.txt; then
  echo "FAIL case 23: the message must point at --no-effort"
  cat /tmp/resolve-config-err.txt
  exit 1
fi

# Case 24: --effort and --no-effort together are refused rather than ranked. Any
# order of precedence here would be a guess at which one the user meant.
if bash "$SCRIPT" --global-config "$GLOBAL" --project-config "$EMPTY" \
  --effort high --no-effort 2>/dev/null; then
  echo "FAIL case 24: --effort and --no-effort together must be refused"
  exit 1
fi

echo "PASS: test-resolve-config.sh"
