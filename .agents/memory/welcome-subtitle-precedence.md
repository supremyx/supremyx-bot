---
name: Welcome card subtitle precedence
description: Where the SUPREMYX welcome card's displayed subtitle text actually comes from, since there are 3 look-alike default strings in different files.
---

The rendered welcome-card subtitle is controlled by the Mongoose **schema default** on
`cardSubtitle` in `database/models/WelcomeConfig.js`. `commands/welcome.js` always calls
`WelcomeConfig.findOne(...)` (a hydrated document, not `.lean()`), so Mongoose auto-fills
`cardSubtitle` with the schema default whenever no value is stored for that guild — and
`config.cardSubtitle` is therefore always truthy in practice.

Because of that, the fallback strings hardcoded in `commands/welcome.js`
(`'HELLO AND WELCOME TO {server}'`) and in `utils/welcomeCard.js`
(`subtitle || '...'`) are dead code — `subtitle` passed into `generateWelcomeCard` is never
falsy, so those inline defaults never actually render.

**Why:** the user edited the dead fallback line in `utils/welcomeCard.js` directly on GitHub
expecting it to change the live text, but nothing changed — causing confusion that the agent
had "reverted" their edit. It hadn't; the real value lived in the schema default and in the
per-guild DB document.

**How to apply:** to change what actually displays, update the schema `default` in
`WelcomeConfig.js` (for new guilds) AND/or the stored `cardSubtitle` field on the guild's
`WelcomeConfig` document in MongoDB (for existing guilds) — e.g. via `!bienvenue soustitre` or
a direct DB update. Editing the inline fallback strings in `commands/welcome.js` or
`utils/welcomeCard.js` has no visible effect while a config document exists (it always does,
since `cardTitle`/`cardSubtitle` etc. all have schema defaults).
