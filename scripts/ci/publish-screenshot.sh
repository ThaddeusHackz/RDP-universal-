#!/usr/bin/env bash
# THADD OS CI — commit the freshly captured desktop screenshot to the repo
# branch so every build ships photographic proof of the running system.
set -e

SRC=/tmp/thadd-ci/screenshot.jpg
[ -f "$SRC" ] || { echo "no screenshot to publish"; exit 0; }

mkdir -p ci
cp "$SRC" ci/thadd-os-screenshot.jpg

git config user.name  "THADD CI"
git config user.email "ci@thaddos.invalid"
git add ci/thadd-os-screenshot.jpg
if git diff --cached --quiet; then
  echo "screenshot unchanged — nothing to commit"
  exit 0
fi
git commit -m "ci: fresh THADD OS desktop screenshot [skip ci]"
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" \
  "HEAD:${GITHUB_REF_NAME}"
echo "✅ screenshot published to ${GITHUB_REF_NAME}"
