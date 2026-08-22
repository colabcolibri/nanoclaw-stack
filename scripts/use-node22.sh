#!/usr/bin/env bash
# NanoClaw motor needs Node 22 LTS (better-sqlite3 não compila bem no Node 26+).
# Prefer Homebrew node@22 when installed; leave PATH unchanged otherwise.

for candidate in \
  "/opt/homebrew/opt/node@22/bin" \
  "/usr/local/opt/node@22/bin"; do
  if [[ -x "$candidate/node" ]]; then
    export PATH="$candidate:$PATH"
    return 0 2>/dev/null || exit 0
  fi
done
