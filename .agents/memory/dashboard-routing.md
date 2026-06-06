---
name: Dashboard state routing
description: Pattern for adding new pages to the React dashboard (no react-router)
---

The dashboard uses state-based routing in `dashboard/src/App.tsx`. Adding a new page requires exactly 4 edits:

1. **Import** the page component at the top
2. **Page type union** — add `| "mypage"` to the `type Page = ...` line
3. **NAV_ITEMS array** — add `{ key: "mypage", label: "Label", icon: "🔤" }` 
4. **Conditional render** — add `{page === "mypage" && <MyPage />}` in the Pages section (lines ~275-300)

**Why:** No react-router is used; `navigate(key)` sets the `page` state. The `<main>` classement block uses `className={... page !== "classement" ? "hidden" : ""}` so it hides when other pages are shown.

**API proxy:** In dev, Vite proxies `/api/*` → `localhost:3000`. Always use `apiUrl("/api/...")` from `lib/api.ts` for all fetches. New API endpoints are added to `api/server.js` using the `router` object, before the `// ─── Mount` section.
