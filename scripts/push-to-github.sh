#!/bin/bash
set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN non défini"
  exit 1
fi

REPO="supremyx/supremyx-bot"

# Supprimer les fichiers lock git s'ils existent
rm -f /home/runner/workspace/.git/index.lock
rm -f /home/runner/workspace/.git/config.lock

git config user.email "bot@supremyx.xyz"
git config user.name "SUPREMYX Bot"
git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"

git add -A
if git diff --cached --quiet; then
  echo "✅ Rien à pousser, tout est à jour"
  exit 0
fi

git commit -m "${1:-sync: mise à jour automatique depuis Replit}"
git push origin main
echo "✅ Poussé sur GitHub avec succès"
