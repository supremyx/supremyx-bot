---
name: DM Guard pattern
description: Every Discord command file needs a guild check before any message.member access to prevent crashes when bot is DM'd.
---

## Rule
All `messageCreate` listeners that access `message.member`, `message.guild`, `message.mentions.members`, etc. must have `if (!message.guild) return;` as an early guard.

**Why:** Discord allows users to DM bots. When a message arrives in a DM, `message.guild` and `message.member` are `null`. Any `.permissions`, `.roles`, `.joinedAt`, etc. access crashes with "Cannot read properties of null".

**How to apply:**
- If listener starts with `if (!message.content.startsWith('!xxx')) return;` → add guild guard on the next line.
- If listener computes `isStaff = message.member.permissions...` at the top before any command filter → add guild guard before that line.
- If listener uses `if (cmd === '!xxx') { ... }` block pattern → add guard as first line inside the block.
- Optional chaining (`message.member?.permissions`) is NOT sufficient — `message.guild.id` will still crash.

All 53+ command files in this project now have the guard applied (verified June 2026).
