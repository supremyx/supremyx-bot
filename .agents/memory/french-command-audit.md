---
name: French command audit
description: Findings from auditing all Discord bot commands/subcommands and the dashboard for French localization.
---

The SUPREMYX bot's commands (commands/*.js) and the dashboard UI were already almost entirely in French — filenames are often English (e.g. `backup.js`, `ping.js`, `status.js`, `gitpush.js`, `restore.js`) but the actual `!command` triggers and subcommands inside them were already French (`!statut`, `!envoyergit`, `!statutgit`, `!restaurer`, etc). Don't assume an English filename means an English command — always grep the actual `startsWith('!...')` / `cmd === '!...'` / `sub === '...'` comparisons.

Only two genuinely English triggers were found: `!backup` (renamed to `!sauvegarde`) and `!ping` (removed, kept `!latence` which already existed as an alias).

`utils/commandMeta.js` is the canonical registry of command names used by `!aide nouveautes` / `!aidestaff nouveautes` — check and update it whenever a command name changes, it can drift from the actual code (it already listed `!sauvegarde`/`!restaurer` for backup.js before the rename was done, i.e. it was aspirational/stale).

**Why:** Renaming a live command without updating this registry, the in-file usage/help text, and `commands/aide.js` / `commands/aidestaff.js` leaves inconsistent help output.

Also found `commands/backup.js` was `require()`d twice in `index.js` (once under "Matchs" section, once under "Sauvegarde/restauration" section) — a duplicate-handler bug (see `duplicate-handler.md`) causing every `!backup`/`!sauvegarde` command to double-reply. Always grep `require('./commands/` for duplicates in `index.js` after touching command wiring.
