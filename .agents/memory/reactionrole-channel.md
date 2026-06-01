---
name: reactionrole channel scan
description: Scanning all guild channels to find a message by ID is slow and rate-limit-prone; require a channel mention instead.
---

## Rule
The `!reactionrole add` command now requires a channel mention:
`!reactionrole add #channel <messageId> <emoji> @role [label]`

**Why:** Iterating `message.guild.channels.cache` and calling `channel.messages.fetch(id)` on each channel until found makes O(n) API calls and can hit Discord rate limits on large servers.

**How to apply:** Use `message.mentions.channels.first()` to get the channel, then fetch the message directly from it.
