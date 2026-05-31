#!/bin/bash
set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN non défini"
  exit 1
fi

REPO="supremyx/supremyx-bot"

# Nettoyer les locks git s'ils existent
rm -f /home/runner/workspace/.git/index.lock
rm -f /home/runner/workspace/.git/config.lock

# Annuler tout rebase en cours
if [ -d /home/runner/workspace/.git/rebase-merge ] || [ -d /home/runner/workspace/.git/rebase-apply ]; then
  echo "⚠️  Rebase en cours détecté, annulation..."
  rm -rf /home/runner/workspace/.git/rebase-merge
  rm -rf /home/runner/workspace/.git/rebase-apply
fi

git config user.email "bot@supremyx.xyz"
git config user.name "SUPREMYX Bot"
git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"

git fetch origin main

# Merger les changements distants sans écraser les changements locaux
git merge origin/main --no-edit --strategy-option=ours 2>/dev/null || true

# Ajouter tous les changements non commités
git add -A
if ! git diff --cached --quiet; then
  git commit -m "${1:-sync: mise à jour automatique depuis Replit}"
fi

# Vérifier si on est en avance sur origin et pousser si nécessaire
AHEAD=$(git rev-list origin/main..HEAD --count 2>/dev/null || echo "0")
if [ "$AHEAD" = "0" ]; then
  echo "✅ Rien à pousser, tout est à jour"
  exit 0
fi

git push origin main
echo "✅ Poussé sur GitHub avec succès ($AHEAD commit(s))"
