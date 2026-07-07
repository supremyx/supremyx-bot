---
name: Note guild isolation
description: Note model had no guildId; staff notes bled between guilds sharing team names.
---

## Rule
All Note creates must pass guildId: message.guild.id and all Note reads must filter by guildId.

**Why:** The original schema had no guildId. depistage and notes commands returned notes from any guild whose team name matched — leaking staff intel across servers.

**How to apply:** Any new command reading/writing Notes must include guildId in both create payload and find filter. The field is optional (null) on legacy docs so old data does not break queries.
