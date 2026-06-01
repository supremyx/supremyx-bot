---
name: eventcmd race condition
description: Concurrent reaction events require atomic MongoDB ops; in-memory array mutation + save() causes data loss.
---

## Rule
Use `$pull` + `$addToSet` atomically for list membership changes under concurrent access:
```js
await Model.updateOne({ _id }, { $pull: { listA: userId, listB: userId } });
if (added) await Model.updateOne({ _id }, { $addToSet: { targetList: userId } });
const updated = await Model.findById(_id); // reload for embed
```

**Why:** Multiple users reacting simultaneously would race: two handlers read the same stale doc, both `filter()` and `push()`, then both `save()` — one overwrites the other's change.

**How to apply:** `commands/eventcmd.js` `handleReaction()` function.
