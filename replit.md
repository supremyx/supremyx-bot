# SUPREMYX Discord Bot + Dashboard

## Project overview

Full-featured Discord bot (Node.js + discord.js v14) with a React/Vite admin dashboard. Also includes a REST API (`api/server.js`) served on port 3000 alongside the bot.

- **Bot entry point:** `index.js`
- **Dashboard:** `dashboard/` (Vite + React + Tailwind)
- **API:** `api/server.js` (runs in the same process as the bot on port 3000)
- **Commands:** `commands/` directory
- **Database models:** `database/models/` (Mongoose / MongoDB)
- **Utilities:** `utils/`

## How to run

| Component | Workflow | Command |
|-----------|----------|---------|
| Dashboard (port 5000) | *Start application* | `cd dashboard && PORT=5000 BASE_PATH=/ npm run dev` |
| Bot + API (port 3000) | *Start Discord Bot* | `node index.js` |

## Required secrets

| Key | Description |
|-----|-------------|
| `TOKEN` | Discord bot token |
| `MONGO_URI` | MongoDB Atlas connection string |
| `BOT_API_KEY` | API key for dashboard admin/settings routes |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI features (`!ia`, bilan IA, analytics) |

## Tech stack

- **Bot:** Node.js, discord.js v14, Mongoose
- **Dashboard:** React 18, Vite, Tailwind CSS v4, shadcn/ui, Wouter, TanStack Query
- **Database:** MongoDB (Atlas)
- **Package manager:** npm (root bot) / npm (dashboard workspace)

## Optional secrets

| Key | Description |
|-----|-------------|
| `GITHUB_TOKEN` | Required only for the **Auto-push GitHub** workflow (`scripts/autopush.sh`). Without it the workflow fails harmlessly — bot and dashboard are unaffected. |

## User preferences

- Keep existing project structure — do not restructure or migrate.

## Dashboard pages

| Page | Route key | Description |
|------|-----------|-------------|
| Classement | `classement` | Classement général des équipes (live, PDF/CSV export) |
| Tournois | `tournois` | Liste et détail des tournois |
| Saisons | `saisons` | Historique des saisons |
| Joueurs | `joueurs` | Stats joueurs individuelles |
| Effectifs | `rosters` | Rosters des équipes |
| Calendrier | `calendrier` | Calendrier des matchs |
| Résultats | `resultats` | Résultats des matchs |
| Comparer | `comparaison` | Comparaison côte-à-côte joueurs/équipes |
| Stats | `stats` | Statistiques globales |
| Modération | `moderation` | Avertissements, sanctions, blacklist, **notes staff** |
| Stats Bot | `botstats` | Statistiques d'utilisation du bot |
| Analytiques IA | `ia-analytics` | Usage et métriques de l'IA |
| Fallback IA | `ia-fallback` | Modèles de repli IA |
| Bilans hebdo | `bilan` | Bilans hebdomadaires IA |
| Événements | `events` | Événements du serveur |
| Tickets | `tickets` | Support tickets |
| Anniversaires | `birthdays` | Anniversaires membres |
| Suggestions | `suggestions` | Suggestions de la communauté |
| Sondages | `sondages` | Historique des sondages |
| Pronostics | `pronostics` | Pronostics matchs |
| Poules | `poules` | Gestion des poules |
| Disponibilités | `disponibilites` | Disponibilités joueurs |
| Inscriptions | `inscriptions` | Inscriptions tournois |
| Embeds prog. | `embeds-programmes` | Embeds programmés |
| Modèles embeds | `embeds-templates` | Templates d'embeds |
| Classement ELO | `elo` | Classement ELO |
| Badges | `badges` | Badges membres |
| Stats Serveur | `statsserveur` | Métriques du serveur Discord |
| Journaux | `logs` | Journaux du staff |
| Activité live | `live-activity` | Flux d'activité en temps réel |
| Commandes | `commandcenter` | Centre de commandes admin |
| Statut | `status` | Statut du bot et des services |
| Paramètres | `parametres` | Paramètres du bot |
| AutoMod | `automod` | AutoMod, Anti-spam, Anti-liens, Mots interdits |
| Anti-Raid | `antiraid` | Configuration anti-raid |
| Audit Logs | `audit-logs` | Journaux d'audit |
| Historique !dire | `say-logs` | Historique des commandes !dire |
| Sauvegarde | `backup` | Sauvegardes de la base de données |
| Monitoring | `monitoring` | Monitoring système |
| Stats Cmds | `cmdstats` | Statistiques des commandes |
| **Giveaways** | `giveaways` | Tirages au sort (actifs/terminés) |
| **Niveaux & XP** | `niveaux` | Classement XP des membres |
| **Absences** | `absences` | Absences déclarées par les joueurs |
| **MVPs** | `mvps` | Classement MVPs par match/tournoi |
| **Newsletter** | `newsletter` | Config newsletter + bilans hebdo |

## Déploiement sur Wispbyte

Wispbyte expose **un seul port** (via la variable `PORT`). Le bot, l'API REST et le dashboard tournent tous dans le même processus `node index.js`. Le dashboard doit être **buildé** avant le démarrage.

### Variables d'environnement obligatoires (panel Wispbyte)

| Variable | Description |
|----------|-------------|
| `TOKEN` | Token du bot Discord |
| `MONGO_URI` | URI MongoDB Atlas |
| `BOT_API_KEY` | Clé secrète longue (≥ 32 chars) |
| `VITE_BOT_API_KEY` | **Identique** à `BOT_API_KEY` — intégré au build Vite |
| `OPENROUTER_API_KEY` | Clé OpenRouter (features IA) |
| `DASHBOARD_URL` | URL publique complète (ex: `https://ton-app.wispbyte.com`) |

> ⚠️ `VITE_BOT_API_KEY` doit être défini **avant** le build du dashboard car Vite l'intègre dans le bundle.  
> ⚠️ Sur Wispbyte, **ne pas définir `PORT`** — la plateforme l'injecte automatiquement.

### Variables optionnelles

| Variable | Description |
|----------|-------------|
| `LOG_CHANNEL_ID` | Salon Discord pour les erreurs critiques |
| `ANNOUNCE_CHANNEL_ID` | Salon des annonces automatiques |
| `BACKUP_CHANNEL_ID` | Salon pour les sauvegardes automatiques |
| `OWNER_ID` | ID Discord du propriétaire (commandes admin) |
| `DISCORD_WEBHOOK_URL` | Webhook pour notifications de push GitHub |
| `GITHUB_TOKEN` | Token GitHub pour `!gitpush`, `!gitstatus`, `!changelog` |

### Commandes Wispbyte

| Étape | Commande |
|-------|----------|
| **Tout-en-un (recommandé)** | `bash start.sh` |
| **Build seul** | `npm run build` |
| **Démarrage seul** | `node index.js` |

Le script `start.sh` installe les dépendances, build le dashboard, puis démarre le bot.  
La commande de build compile les assets dans `dashboard/dist/public/` — l'API Express les sert automatiquement.

### Architecture sur Wispbyte

```
PORT (assigné automatiquement par Wispbyte)
  └── Express (api/server.js)
        ├── /          → routes API (ex: /health, /ranking, /players…)
        ├── /api/*     → idem — alias utilisé par le dashboard statique
        ├── /bot-api/* → idem — alias legacy
        └── /*         → dashboard React (fichiers statiques buildés)
```

## New API endpoints added (2026-07-20)

- `GET /api/niveaux` — Classement XP/niveaux (XpEntry model, sorted by xp desc)
- `GET /api/newsletter` — Config newsletter (NewsletterConfig model)

## Setup status (2026-07-27)

### Adaptations Wispbyte complètes
- Router monté à `/api` + `/` + `/bot-api` — dashboard statique fonctionnel
- CORS étendu aux domaines `*.wispbyte.*`
- `vite.config.ts` — plugins Replit optionnels, HMR conditionnel
- `@napi-rs/canvas` — chargement optionnel avec fallback embed texte si binaire absent
- `commands/changelog.js`, `gitstatus.js`, `gitpush.js` — path dynamique via `process.cwd()` (plus de `/home/runner/workspace` hardcodé)
- `commands/dashboard.js` — `DASHBOARD_URL` env var (plus de `REPLIT_DOMAINS`)
- `InscriptionsPage.tsx` — corrigé `VITE_API_KEY` → `VITE_BOT_API_KEY`
- Scripts `npm run build`, `start:prod`, `install:all` et `start.sh` ajoutés
- `.env.example` complet avec toutes les variables utilisées dans le code
