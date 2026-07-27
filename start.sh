#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# Script de démarrage pour Wispbyte (et tout hébergement Linux standard)
# Usage : bash start.sh
# ──────────────────────────────────────────────────────────────────────────────
set -e

echo "📦 Installation des dépendances (racine)..."
npm install --legacy-peer-deps --omit=dev 2>/dev/null || npm install --legacy-peer-deps

echo "🏗️  Build du dashboard..."
cd dashboard
npm install --legacy-peer-deps 2>/dev/null || true
npm run build
cd ..

echo "🚀 Démarrage du bot..."
exec node index.js
