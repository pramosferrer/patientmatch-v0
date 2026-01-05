#!/usr/bin/env bash
set -euo pipefail
MSG_SLUG="${1:-work}"
DATE="$(date +%Y%m%d-%H%M)"
BRANCH="feat/${MSG_SLUG}-${DATE}"

git fetch origin
git switch main
git pull --ff-only origin main
git switch -c "$BRANCH"

echo "✔ Created branch $BRANCH"
echo "Tip: run 'npm run ship \"your commit message\"' when ready to push."


