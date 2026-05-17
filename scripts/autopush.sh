#!/bin/bash
set -e

REPO_DIR="/home/runner/workspace"
REMOTE="https://supremyx:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/supremyx/supremyx-bot.git"

cd "$REPO_DIR"

AHEAD=$(git rev-list @{u}..HEAD --count 2>/dev/null || echo "0")

if [ "$AHEAD" = "0" ]; then
  echo "✅ Déjà à jour — aucun commit à pousser."
  exit 0
fi

git push "$REMOTE" main

HASH=$(git rev-parse --short HEAD)
MSG=$(git log -1 --pretty=%s)
echo "✅ Push réussi — $AHEAD commit(s) — [$HASH] $MSG"
