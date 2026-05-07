#!/usr/bin/env bash
set -euo pipefail
COMMIT_MSG="${1:-chore: update}"

# Show status before validation so unrelated local files are visible.
git status

# Validation. The Next.js app lives at the repository root.
npm install --no-audit --no-fund
npm run lint -- --quiet
npm run -s build

git add -A
git status

git commit -m "$COMMIT_MSG" || echo "No changes to commit."
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git push -u origin "$CURRENT_BRANCH"

# If gh is available, open a draft PR
if command -v gh >/dev/null 2>&1; then
  gh pr view --json number >/dev/null 2>&1 || gh pr create --fill --draft || true
fi

echo "✔ Pushed $CURRENT_BRANCH"
echo "If a PR didn't open, run: gh pr create --fill --draft"
