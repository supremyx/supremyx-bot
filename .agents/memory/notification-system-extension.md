---
name: Notification system extension pattern
description: How to add a new alert/notification type to the dashboard's toast + banner + history system
---

The dashboard has a single unified notification pipeline: `useMatchNotifications.ts` owns the `NotifType` union, per-type data interfaces, and a `push(type, data)` callback. `NotificationBanner.tsx` and `NotificationHistory.tsx` both switch on `notif.type` to render content, accent color, and legend/labels.

To add a new alert type (event-driven via SSE, or condition-driven via polling):
1. Add the type to `NotifType` and its data interface in `useMatchNotifications.ts`, include it in the `Notification["data"]` union.
2. If it's condition-driven (not a discrete server push), create a separate hook (e.g. `useOperationalAlerts.ts`) that polls the relevant REST endpoint(s) on an interval, tracks already-alerted IDs in a `useRef<Set>` to avoid re-notifying every poll cycle, and calls the shared `push` from `useMatchNotifications`.
3. Update `NotificationBanner.tsx` and `NotificationHistory.tsx`: add a content/headline branch, an `accentColor` entry, a `typeLabel` entry (history only), and a legend entry (history only).
4. Any page that consumes the shared `notifications` array for a narrower purpose (e.g. `LiveActivityPage.tsx`, which is specifically a match/tournament feed) must filter to only the types it cares about — don't widen its own narrower type union to match the global one.

**Why:** keeps all alert rendering logic in one place instead of scattering ad-hoc toast calls, and avoids type-union mismatches in narrow-purpose consumers when the global union grows.

**How to apply:** whenever asked to add a new kind of dashboard alert (stale tickets, upcoming events, etc.), follow this four-step pattern rather than building a parallel notification UI.
