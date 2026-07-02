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

## Tech stack

- **Bot:** Node.js, discord.js v14, Mongoose
- **Dashboard:** React 18, Vite, Tailwind CSS v4, shadcn/ui, Wouter, TanStack Query
- **Database:** MongoDB (Atlas)
- **Package manager:** npm (root bot) / npm (dashboard workspace)

## User preferences

- Keep existing project structure — do not restructure or migrate.
