---
name: Phase 2 new features
description: Summary of 8 new features added in Phase 2 — what exists, how wired, and key gotchas.
---

## Features added

### Bot utilities (utils/)
- `antiLink.js` — exports `startAntiLink`, `invalidateConfigCache`. Uses `AntiLinkConfig` + `ViolationTracker`.
- `antiRaid.js` — exports `startAntiRaid`, `unlockGuild(guild, client)`. Uses `AntiRaidConfig`. In-memory join tracker per guild.
- `auditLogger.js` — exports `startAuditLogger`. Listens to 14+ Discord events, saves to `AuditLog` (30-day TTL).
- `serverBackup.js` — exports `createBackup`, `restoreBackup`, `listBackups`, `deleteBackup`. Uses `ServerBackup` model.
- `monitoringManager.js` — exports `startMonitoring`. Saves `MonitoringMetric` every 5min (7-day TTL).

### Commands (commands/)
- `antilink.js`, `antiraid.js`, `backup.js` — all registered in `index.js`.

### API routes (api/server.js)
All added before the `// ─── Mount ───` block, using existing `router`, `requireApiKey`, `publicLimiter`.
- GET/POST `/api/automod-config`, `/api/antispam-config`, `/api/antilink-config`, `/api/antiraid-config`
- POST `/api/antiraid/unlock` — calls `unlockGuild(guild, _discordClient)` from `utils/antiRaid`
- GET `/api/audit-logs` — query params: category, severity, search, limit (max 500)
- GET `/api/backup`, POST `/api/backup`, POST `/api/backup/:id/restore`, DELETE `/api/backup/:id`
- GET `/api/monitoring`, GET `/api/monitoring/history`
- GET `/api/command-stats` — query params: guildId, period (24h/7d/30d)
New models imported at the top of the block (not at file top) to avoid hoisting conflicts.

### Dashboard pages (dashboard/src/pages/)
- `AutoModPage.tsx`, `AntiRaidPage.tsx`, `AuditLogsPage.tsx`, `BackupPage.tsx`, `MonitoringPage.tsx`, `CommandStatsPage.tsx`
- All use `apiUrl()` from `../lib/api`. Write endpoints send `x-api-key: VITE_BOT_API_KEY`.

### App.tsx wiring
- All 6 pages added to Page union, NAV_ITEMS, and conditional render.
- Keys: `automod`, `antiraid`, `audit-logs`, `backup`, `monitoring`, `cmdstats`.

## Key gotcha
`VITE_BOT_API_KEY` secret must be set to the same value as `BOT_API_KEY` for write endpoints to work from the dashboard. Without it, GETs still work (publicLimiter) but POSTs/DELETEs return 401.
