#!/usr/bin/env bash
# THADD OS CI — commit the freshly captured desktop screenshot to the repo
# branch so every build ships photographic proof of the running system.
#
# The screenshot is captured inside the running OS container and only exists on
# the runner, so it has to travel back through the GitHub API.  A plain
# `git push` from a job does not work here: the checkout is a snapshot, so the
# push either races with the report commits of sibling jobs or arrives behind
# them, and the failure is invisible from outside the runner.  publish-file.sh
# uses the contents API (read blob sha → PUT → retry) and never fails the job.
set -euo pipefail

SRC=${THADD_SCREENSHOT:-/tmp/thadd-ci/screenshot.jpg}
DEST=ci/thadd-os-screenshot.jpg

[ -f "$SRC" ] || { echo "no screenshot to publish ($SRC)"; exit 0; }

mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"

echo "screenshot: $(stat -c%s "$DEST") bytes -> $DEST"
bash scripts/ci/publish-file.sh "$DEST" "ci: fresh THADD OS desktop screenshot [skip ci]"
