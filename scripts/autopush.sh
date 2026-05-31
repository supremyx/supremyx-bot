#!/bin/bash
# Auto-push to GitHub every 60 seconds when there are local changes

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN non défini"
  exit 1
fi

REPO="supremyx/supremyx-bot"

git config user.email "bot@supremyx.xyz"
git config user.name "SUPREMYX Bot"
git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"

echo "🔁 Auto-push actif — vérification toutes les 60 secondes"

while true; do
  sleep 60

  rm -f /home/runner/workspace/.git/index.lock
  rm -f /home/runner/workspace/.git/config.lock

  git add -A
  if git diff --cached --quiet; then
    continue
  fi

  TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
  git commit -m "sync: auto-push ${TIMESTAMP}" --quiet
  if git push origin main --quiet; then
    echo "✅ [$(date '+%H:%M:%S')] Poussé sur GitHub"
  else
    echo "⚠️ [$(date '+%H:%M:%S')] Échec push — nouvelle tentative dans 60s"
    git reset --soft HEAD~1 2>/dev/null || true
  fi
done
