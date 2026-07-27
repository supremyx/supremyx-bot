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

### Variables d'environnement à configurer sur Wispbyte

| Variable | Valeur |
|----------|--------|
| `TOKEN` | Token du bot Discord |
| `MONGO_URI` | URI MongoDB Atlas |
| `BOT_API_KEY` | Clé secrète longue (≥ 32 chars) |
| `OPENROUTER_API_KEY` | Clé OpenRouter (features IA) |
| `VITE_BOT_API_KEY` | Identique à `BOT_API_KEY` |

> ⚠️ `VITE_BOT_API_KEY` doit être défini **avant** le build du dashboard car Vite l'intègre dans le bundle.

### Commandes Wispbyte

| Étape | Commande |
|-------|----------|
| **Build** | `npm run build` |
| **Démarrage** | `node index.js` |
| **Tout-en-un** | `npm run start:prod` |

La commande `npm run build` installe les dépendances du dashboard et compile les assets dans `dashboard/dist/public/`. L'API Express les sert automatiquement à la racine.

### Architecture sur Wispbyte

```
PORT (assigné par Wispbyte)
  └── Express (api/server.js)
        ├── /          → routes API
        ├── /api/*     → routes API (alias pour le dashboard)
        ├── /bot-api/* → routes API (alias legacy)
        └── /*         → dashboard React (fichiers statiques buildés)
```

## New API endpoints added (2026-07-20)

- `GET /api/niveaux` — Classement XP/niveaux (XpEntry model, sorted by xp desc)
- `GET /api/newsletter` — Config newsletter (NewsletterConfig model)

## Setup status (2026-07-27)

- Adapté pour Wispbyte : router monté à `/api` (+ `/` + `/bot-api`), CORS étendu aux domaines `*.wispbyte.*`, build du dashboard validé, vite.config.ts nettoyé pour les envs hors-Replit.
- Scripts `npm run build` et `npm run start:prod` ajoutés dans `package.json`.
- Note : secrets/dépendances ne persistent pas lors d'un re-import — relancer `npm install` (racine + `dashboard/`) et re-fournir les secrets.
