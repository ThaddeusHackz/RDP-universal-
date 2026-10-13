#!/usr/bin/env bash
# Publish one file into the branch that triggered this run, atomically.
#
# A CI checkout is a snapshot, so `git push` from a job races with every other
# push and silently loses the report (`|| true` was hiding exactly that).  The
# contents API does not race: it reads the current blob sha, writes, and retries
# once on conflict.
#
# Usage: publish-file.sh <path-in-repo> <commit message>
set -euo pipefail

FILE="${1:?path required}"
MSG="${2:-ci: report [skip ci]}"
BRANCH="${GITHUB_REF_NAME:-main}"
REPO="${GITHUB_REPOSITORY:?}"

[[ -f "$FILE" ]] || { echo "publish-file: $FILE does not exist"; exit 1; }

b64="$(base64 -w0 "$FILE")"
api="repos/$REPO/contents/$FILE"

sha="$(gh api "$api?ref=$BRANCH" --jq .sha 2>/dev/null || true)"

attempt=1
while :; do
  args=(-X PUT "$api" -f "message=$MSG" -f "branch=$BRANCH" -f "content=$b64")
  [[ -n "$sha" ]] && args+=(-f "sha=$sha")
  if out="$(gh api "${args[@]}" 2>&1)"; then
    echo "publish-file: committed $FILE to $BRANCH"
    exit 0
  fi
  if (( attempt >= 3 )); then
    echo "publish-file: giving up after $attempt attempts"
    echo "$out" | tail -3
    exit 0            # never fail the job over a report
  fi
  # the file moved under us: re-read the sha and try again
  sha="$(gh api "$api?ref=$BRANCH" --jq .sha 2>/dev/null || true)"
  sleep 3
  attempt=$((attempt + 1))
done
