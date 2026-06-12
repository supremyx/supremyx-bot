#!/bin/bash
# Auto-push vers GitHub toutes les 60 secondes
# Pousse les commits non synchronisés (checkpoints Replit inclus)

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN non défini — auto-push désactivé"
  exit 1
fi

REPO="supremyx/supremyx-bot"
REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"

git config user.email "bot@supremyx.xyz"
git config user.name "SUPREMYX Bot"
git remote set-url origin "$REMOTE" 2>/dev/null || true

echo "🔁 Auto-push actif — vérification toutes les 60 secondes"

while true; do
  sleep 60

  # Libérer les locks git si bloqués
  rm -f /home/runner/workspace/.git/index.lock
  rm -f /home/runner/workspace/.git/config.lock

  # Commit les fichiers modifiés non encore commités
  git add -A 2>/dev/null
  if ! git diff --cached --quiet 2>/dev/null; then
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
    git commit -m "sync: auto-push ${TIMESTAMP}" --quiet 2>/dev/null || true
  fi

  # Pousser TOUS les commits non synchronisés (checkpoints inclus)
  UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l)
  if [ "$UNPUSHED" -gt 0 ]; then
    if git push origin main --quiet 2>/dev/null; then
      echo "✅ [$(date '+%H:%M:%S')] ${UNPUSHED} commit(s) poussé(s) sur GitHub"
    else
      echo "⚠️ [$(date '+%H:%M:%S')] Échec push — nouvelle tentative dans 60s"
    fi
  fi
done
