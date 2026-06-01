---
name: scheduleManager singleton guard
description: Module-level started flag prevents duplicate setInterval() calls if the module is loaded multiple times.
---

## Rule
```js
let scheduleManagerStarted = false;
function startScheduleManager(client) {
  if (scheduleManagerStarted) return;
  scheduleManagerStarted = true;
  setInterval(...);
}
```

**Why:** Node.js module caching usually prevents double-loading, but hot-reloads or explicit multiple calls can bypass this. Without the guard, multiple intervals fire simultaneously causing duplicate DB writes and duplicate notifications.
