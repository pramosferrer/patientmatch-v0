#!/usr/bin/env bash
set -euo pipefail
COMMIT_MSG="${1:-chore: update}"

# Add everything and show status
git add -A
git status

# Optional: build/lint steps (safe to skip if you want)
if [ -d frontend ]; then
  (cd frontend && npm install --no-audit --no-fund && npm run -s build || true)
fi

git commit -m "$COMMIT_MSG" || echo "No changes to commit."
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git push -u origin "$CURRENT_BRANCH"

# If gh is available, open a draft PR
if command -v gh >/dev/null 2>&1; then
  gh pr view --json number >/dev/null 2>&1 || gh pr create --fill --draft || true
fi

echo "✔ Pushed $CURRENT_BRANCH"
echo "If a PR didn't open, run: gh pr create --fill --draft"


