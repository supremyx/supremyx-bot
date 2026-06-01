---
name: birthday date validation
description: Simple range checks (day 1-31, month 1-12) accept invalid combos like 31/02; use Date rollover detection.
---

## Rule
```js
const testDate = new Date(year || 2000, month - 1, day);
const isValid = testDate.getFullYear() === (year || 2000)
  && testDate.getMonth() === month - 1
  && testDate.getDate() === day;
```

**Why:** `new Date(2000, 1, 31)` (Feb 31) auto-rolls over to March 2; comparing the output fields back to the input detects this.
Use year 2000 (a leap year) as the test year when no year is provided so Feb 29 is accepted.

**How to apply:** `commands/birthday.js` date parsing section.
