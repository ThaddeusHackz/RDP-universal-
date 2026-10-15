#!/usr/bin/env bash
# =============================================================================
#  Enable THADD OS ISO builds in GitHub Actions
# =============================================================================
#  GitHub only runs workflows that live in .github/workflows/. This repository's
#  automation token is not allowed to write that directory, so the ISO workflow
#  is versioned as ci/iso-build.yml and installed with this script (one command,
#  once). After that, every push to a watched path rebuilds the ISO, verifies it
#  and publishes it to Releases automatically — no further action needed.
#
#      ./tools/install-iso-workflow.sh
# =============================================================================
set -Eeuo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/ci/iso-build.yml"
DST="$REPO_ROOT/.github/workflows/iso-build.yml"

[[ -f "$SRC" ]] || { echo "missing $SRC"; exit 1; }
mkdir -p "$(dirname "$DST")"
cp -f "$SRC" "$DST"
echo "✓ installed $DST"

if [[ "${1:-}" == "--commit" ]]; then
  cd "$REPO_ROOT"
  git add .github/workflows/iso-build.yml
  git commit -m "ci: enable THADD OS ISO build + release workflow"
  git push
  echo "✓ pushed — watch it at: gh run watch"
else
  echo
  echo "Next:"
  echo "  git add .github/workflows/iso-build.yml"
  echo "  git commit -m 'ci: enable THADD OS ISO build workflow'"
  echo "  git push"
  echo
  echo "Or run the whole thing in one shot:  ./tools/install-iso-workflow.sh --commit"
fi

if command -v gh >/dev/null 2>&1; then
  echo
  echo "Trigger a build immediately with:"
  echo "  gh workflow run 'THADD OS · ISO build & verify'"
fi
