---
name: Full bug audit findings
description: Cross-cutting bug patterns found during a full-codebase audit of the bot + dashboard; check for recurrence when adding new files.
---

## Patterns to watch for in new code

1. **Command guards** — every `commands/*.js` messageCreate-style handler needs bot/guild/member guards (see `dm-guard-pattern.md`) AND a try/catch around DB/network calls. The audit found several files missing `message.author.bot` checks or any error handling, which could crash the process on unexpected input.

2. **Regex injection** — see `api-regex-injection.md`. Recurs any time user text (command args or query params) is interpolated into `new RegExp()`.

3. **NoSQL filter injection** — see `api-regex-injection.md`'s "Related" section. Recurs any time `req.query.x` is used directly as a Mongoose filter value without a `typeof x === 'string'` guard.

4. **Frontend must use `apiUrl()` helper** — `dashboard/src/lib/api.ts` exports `apiUrl()` to build correct API base URLs. Raw `fetch("/api/...")` calls work in dev (same-origin proxy) but silently break once dashboard and API are deployed on different origins/ports. Found stray raw fetches in `JoueursPage.tsx` and `GlobalSearch.tsx`; grep for `fetch(\`/api` or `fetch("/api` when auditing frontend pages.

5. **Fixed in follow-up passes:**
   - `DELETE /api/scheduled-embeds/:id` now deletes by full ObjectId (validated with `mongoose.Types.ObjectId.isValid`) instead of matching on the last-6-char display suffix; the dashboard still shows the short ID to users but sends the full `_id` for the actual delete call.
   - Silent `catch {}` blocks in `sondageManager.js`, `dashboardManager.js` (x2), and `autoBackup.js` (per-collection export) now `console.error` the failure instead of swallowing it. When adding a new manager/cron-style util, always log inside catch blocks — silent failures here are especially hard to debug since there's no request/response to surface them.

6. **Not yet fixed (lower priority, documented for follow-up):**
   - `register.js`/`unregister.js` command race conditions were flagged but not addressed (needs a locking/dedup strategy).
   - Some dashboard pages (IaAnalyticsPage, TicketsPage, EventsPage) lack detailed error-state UI, showing only generic loading with no error message.
