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

## Setup status (2026-07-13)

- Dependencies installed via `npm install` at the repo root and inside `dashboard/` (re-installed after import wiped `node_modules`).
- Secrets configured: `TOKEN`, `MONGO_URI`, `BOT_API_KEY`, `OPENROUTER_API_KEY`. `GITHUB_TOKEN` was intentionally skipped — the **Auto-push GitHub** workflow fails harmlessly without it.
- Bot is online (logged in as SUPREMYX#5749, MongoDB connected) and the dashboard renders correctly on port 5000.
- Note: secrets/dependencies do not persist across a fresh import — re-run `npm install` (root + `dashboard/`) and re-provide secrets if this project is re-imported elsewhere.
