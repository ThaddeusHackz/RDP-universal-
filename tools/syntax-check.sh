#!/usr/bin/env bash
# THADD OS · ESM syntax gate.  node --check cannot read ES modules directly and
# process substitution mangles imports, so every file is copied to a .mjs first.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mapfile -t FILES < <(ls -1 desktop/js/*.js desktop/js/apps/*.js)
[ "$#" -gt 0 ] && FILES=("$@")
fail=0
for f in "${FILES[@]}"; do
  tmp="$(mktemp -d)/$(basename "$f").mjs"; cp "$f" "$tmp"
  if out=$(node --check "$tmp" 2>&1); then printf '  \033[32m✔\033[0m %s\n' "$f"
  else printf '  \033[31m✘ %s\033[0m\n%s\n' "$f" "$out"; fail=1; fi
done
printf '%s %d file(s) checked\n' "$([ $fail -eq 0 ] && echo '✅ syntax OK ·' || echo '❌ syntax FAILED ·')" "${#FILES[@]}"
exit $fail
