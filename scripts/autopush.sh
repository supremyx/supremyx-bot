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

# ── Notification Discord via webhook ─────────────────────────────────────────
send_discord() {
  local COLOR="$1"   # couleur décimale (ex: 5763719 = vert, 15548997 = rouge)
  local TITLE="$2"
  local DESC="$3"

  if [ -z "$DISCORD_WEBHOOK_URL" ]; then
    return
  fi

  local TIMESTAMP
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  curl -s -X POST "$DISCORD_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"SUPREMYX Bot\",
      \"avatar_url\": \"https://cdn.discordapp.com/embed/avatars/0.png\",
      \"embeds\": [{
        \"title\": \"${TITLE}\",
        \"description\": \"${DESC}\",
        \"color\": ${COLOR},
        \"footer\": { \"text\": \"Auto-push · SUPREMYX CI\" },
        \"timestamp\": \"${TIMESTAMP}\"
      }]
    }" > /dev/null 2>&1
}

while true; do
  sleep 60

  # Libérer les locks git si bloqués
  rm -f /home/runner/workspace/.git/index.lock
  rm -f /home/runner/workspace/.git/config.lock

  # Commit les fichiers modifiés non encore commités
  git add -A 2>/dev/null
  COMMIT_MADE=false
  if ! git diff --cached --quiet 2>/dev/null; then
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
    git commit -m "sync: auto-push ${TIMESTAMP}" --quiet 2>/dev/null || true
    COMMIT_MADE=true
  fi

  # Pousser TOUS les commits non synchronisés (checkpoints inclus)
  UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l)
  if [ "$UNPUSHED" -gt 0 ]; then
    LAST_MSG=$(git log -1 --pretty=%s 2>/dev/null | head -c 100)
    LAST_HASH=$(git rev-parse --short HEAD 2>/dev/null)
    TIME_NOW=$(date '+%H:%M:%S')

    if git push origin main --quiet 2>/dev/null; then
      echo "✅ [${TIME_NOW}] ${UNPUSHED} commit(s) poussé(s) sur GitHub"
      send_discord \
        "5763719" \
        "✅ Push GitHub réussi" \
        "**\`${LAST_HASH}\`** — ${LAST_MSG}\n🌿 Branche : \`main\` · 📦 ${UNPUSHED} commit(s) poussé(s)\n🔗 [Voir sur GitHub](https://github.com/${REPO}/commits/main)"
    else
      echo "⚠️ [${TIME_NOW}] Échec push — nouvelle tentative dans 60s"
      send_discord \
        "15548997" \
        "⚠️ Échec du push GitHub" \
        "Impossible de pousser \`${UNPUSHED}\` commit(s) sur \`main\`.\nNouvelle tentative dans 60 secondes."
    fi
  fi
done
