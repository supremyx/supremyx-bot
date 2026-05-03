# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## GitHub

- **Dépôt** : https://github.com/hulksilver1-eng/moseto-bot
- **Token** : stocké dans le secret `GITHUB_PERSONAL_ACCESS_TOKEN`
- **Remote OAuth Replit** : non configuré (intégration dismissée par l'utilisateur)
- **Push manuel** : `git push https://hulksilver1-eng:$GITHUB_PERSONAL_ACCESS_TOKEN@github.com/hulksilver1-eng/moseto-bot.git main`
- Note : le fichier `.git/config.lock` bloque `git remote add` — utiliser toujours l'URL complète avec token pour pousser.

## Discord Bot (MoSeTo)

- **Emplacement** : `artifacts/discord-bot/`
- **Stack** : Node.js (CommonJS), discord.js v14, mongoose, dotenv
- **Workflow** : "Discord Bot" → `cd artifacts/discord-bot && node index.js`
- **Secrets** : TOKEN, MONGO_URI, LOG_CHANNEL_ID, ANNOUNCE_CHANNEL_ID
- **95+ commandes** réparties en 29+ catégories
