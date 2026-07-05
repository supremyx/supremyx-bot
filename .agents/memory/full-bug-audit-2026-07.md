---
name: Full bug audit findings
description: Cross-cutting bug patterns found during a full-codebase audit of the bot + dashboard; check for recurrence when adding new files.
---

## Patterns to watch for in new code

1. **Command guards** — every `commands/*.js` messageCreate-style handler needs bot/guild/member guards (see `dm-guard-pattern.md`) AND a try/catch around DB/network calls. The audit found several files missing `message.author.bot` checks or any error handling, which could crash the process on unexpected input.

2. **Regex injection** — see `api-regex-injection.md`. Recurs any time user text (command args or query params) is interpolated into `new RegExp()`.

3. **NoSQL filter injection** — see `api-regex-injection.md`'s "Related" section. Recurs any time `req.query.x` is used directly as a Mongoose filter value without a `typeof x === 'string'` guard.

4. **Frontend must use `apiUrl()` helper** — `dashboard/src/lib/api.ts` exports `apiUrl()` to build correct API base URLs. Raw `fetch("/api/...")` calls work in dev (same-origin proxy) but silently break once dashboard and API are deployed on different origins/ports. Found stray raw fetches in `JoueursPage.tsx` and `GlobalSearch.tsx`; grep for `fetch(\`/api` or `fetch("/api` when auditing frontend pages.

5. **Not yet fixed (lower priority, documented for follow-up):**
   - `POST/DELETE /api/scheduled-embeds/:id` matches ID via `.slice(-6)` suffix, which risks collisions between different documents whose IDs share the same last 6 chars — should match on full ID instead.
   - Several `utils/*.js` managers (levelManager, sondageManager, dashboardManager, autoBackup) have empty `catch {}` blocks that silently swallow DB errors.
   - `register.js`/`unregister.js` command race conditions were flagged but not addressed (needs a locking/dedup strategy).
   - Some dashboard pages (IaAnalyticsPage, TicketsPage, EventsPage) lack detailed error-state UI, showing only generic loading with no error message.
