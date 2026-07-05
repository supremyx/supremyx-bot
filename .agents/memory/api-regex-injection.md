---
name: API regex injection
description: URL params used directly in new RegExp() allow regex injection attacks; must escape first.
---

## Rule
Always escape user-supplied strings before inserting into `new RegExp()`:
```js
const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
new RegExp(`^${escaped}$`, 'i')
```

**Why:** Without escaping, a request to `/ranking/Team(A)` would generate an invalid regex and crash, or a crafted input like `.*` could match unintended documents.

**How to apply:** Fixed in `api/server.js` for routes `/ranking/:team`, `/players/:name`, `/rosters/:team`.
Also applies to the `getRoster()` helper in `commands/roster.js` (uses teamName from command args).

## Related: NoSQL filter injection
Separately, any `req.query.*` value used directly as a Mongoose filter value (e.g. `{ guildId }`) must be guarded with `typeof x === 'string'` before use — an object query param (`?guildId[$ne]=null`) bypasses truthy checks and injects operators. A full audit (2026-07-05) swept every GET route filter in `api/server.js` for this; when adding new filtered routes, always add the typeof guard up front rather than relying on a follow-up audit.
