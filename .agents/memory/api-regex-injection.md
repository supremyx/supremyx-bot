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
