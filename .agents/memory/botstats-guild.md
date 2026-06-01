---
name: botstats per-guild filtering
description: CommandStat queries must always filter by guildId to avoid cross-guild stat bleed.
---

## Rule
All `CommandStat` queries (countDocuments, aggregate, findOne) in `commands/botstats.js` must include `{ guildId: message.guild.id }` in the filter/match stage.

**Why:** If the bot is in multiple servers, stats from all servers would be summed together without the filter, making the command misleading.
