#!/bin/bash
# Is this adapter ready to run a review?
#
# Checks: Is `codex` on PATH? Is it authenticated?
#
# The auth check is here on purpose, and its presence is NOT a contradiction of
# opencode-preflight.sh — read that script's header before touching this one.
# opencode's auth check was removed because the only signal available was
# human-readable TUI output, and parsing it hard-blocked correctly authenticated
# users. The rule that came out of that was explicit: no auth check without a
# machine-readable signal, meaning a documented exit code or a --json mode.
#
# `codex login status` supplies exactly that. Measured on codex-cli 0.149.0:
#
#   authenticated    -> exit 0  ("Logged in using ChatGPT")
#   unauthenticated  -> exit 1  ("Not logged in")
#
# No output is parsed here — only the exit code is read, so the failure mode that
# killed opencode's check (an escape sequence surviving stripping and flipping
# the verdict) has no way in. If a future codex release stops distinguishing
# these codes, delete this check rather than falling back to parsing text.
#
# Reproducing the unauthenticated case without logging out: point CODEX_HOME at
# an empty directory, which is how the exit codes above were confirmed.
#
# Exit 0 = installed and authenticated.
# Exit 1 = cannot run, with the reason and the fix on stderr.
set -euo pipefail

if ! command -v codex > /dev/null 2>&1; then
  echo "codex-preflight.sh: \`codex\` not found on PATH." >&2
  echo "Install it from https://developers.openai.com/codex, or point /ak-review:execute at a different tool with --tool." >&2
  exit 1
fi

if ! codex login status > /dev/null 2>&1; then
  echo "codex-preflight.sh: \`codex\` is installed but not authenticated." >&2
  echo "Run \`codex login\` (or \`printenv OPENAI_API_KEY | codex login --with-api-key\`) and try again." >&2
  exit 1
fi
