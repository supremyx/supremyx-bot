---
name: Auto-achievements hook
description: How auto-achievements are triggered after addmatch and dedup strategy
---

The `checkAutoAchievements(client, teamName)` function in `utils/autoAchievement.js` must be called **after** `team.save()` in `commands/addmatch.js`. It re-fetches the team and its matches fresh from DB.

**Dedup:** The `Achievement` model has an `autoId` field (string, nullable). Each auto-achievement has a unique `id` (e.g. `'first_win'`). The checker queries `{ target: teamName, title: ach.title, autoId: ach.id }` before creating — if found, skips.

**Why `autoId` on Achievement:** The existing `awardedBy: 'SUPREMYX Bot'` alone is not sufficient to prevent duplicates across different achievement types. The `autoId` makes each auto-award uniquely identifiable.

**Announce channel:** `process.env.ACHIEVEMENT_CHANNEL_ID` is preferred; falls back to `LOG_CHANNEL_ID`.

**How to apply:** Any future command that modifies team stats (bulk addmatch, etc.) should also call `checkAutoAchievements` after the stat update.
