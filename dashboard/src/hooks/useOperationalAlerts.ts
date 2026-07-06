import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiUrl } from "../lib/api";
import type { StaleTicketEvent, UpcomingEventEvent } from "./useMatchNotifications";

export type { StaleTicketEvent, UpcomingEventEvent };

interface Ticket {
  _id: string;
  userTag: string;
  subject: string;
  claimedBy: string;
  closed: boolean;
  createdAt: string;
}

interface GuildEvent {
  _id: string;
  eventNumber: number;
  title: string;
  date: string;
  cancelled: boolean;
}

const STALE_TICKET_HOURS = 2;
const UPCOMING_EVENT_MINUTES = 30;
const POLL_INTERVAL_MS = 60_000;

function showStaleTicketToast(t: StaleTicketEvent) {
  toast.warning(`🎫 Ticket sans réponse — ${t.userTag}`, {
    description: `${t.subject || "Sans sujet"} · ouvert depuis ${t.hoursOpen}h sans prise en charge`,
    duration: 12000,
  });
}

function showUpcomingEventToast(e: UpcomingEventEvent) {
  toast(`📅 Événement bientôt — #${e.eventNumber} ${e.title}`, {
    description: `Commence dans ${e.minutesUntil} min`,
    duration: 12000,
  });
}

export type OperationalAlertType = "staleTicket" | "upcomingEvent";

export function useOperationalAlerts(
  push: (type: OperationalAlertType, data: StaleTicketEvent | UpcomingEventEvent) => void
) {
  const alertedTicketIds = useRef<Set<string>>(new Set());
  const alertedEventIds  = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function checkTickets() {
      try {
        const r = await fetch(apiUrl("/api/tickets?limit=100"));
        if (!r.ok) return;
        const json = await r.json();
        const tickets: Ticket[] = json.tickets ?? [];
        const now = Date.now();
        for (const t of tickets) {
          if (t.closed || t.claimedBy) continue;
          if (alertedTicketIds.current.has(t._id)) continue;
          const created = new Date(t.createdAt).getTime();
          if (Number.isNaN(created)) continue;
          const hoursOpen = (now - created) / 3_600_000;
          if (hoursOpen >= STALE_TICKET_HOURS) {
            alertedTicketIds.current.add(t._id);
            const data: StaleTicketEvent = {
              ticketId: t._id,
              userTag: t.userTag,
              subject: t.subject,
              hoursOpen: Math.floor(hoursOpen),
            };
            showStaleTicketToast(data);
            push("staleTicket", data);
          }
        }
      } catch {
        /* silent — will retry on next poll */
      }
    }

    async function checkEvents() {
      try {
        const r = await fetch(apiUrl("/api/guild-events?limit=100"));
        if (!r.ok) return;
        const json = await r.json();
        const events: GuildEvent[] = json.events ?? [];
        const now = Date.now();
        for (const e of events) {
          if (e.cancelled) continue;
          if (alertedEventIds.current.has(e._id)) continue;
          const start = new Date(e.date).getTime();
          if (Number.isNaN(start)) continue;
          const minutesUntil = (start - now) / 60_000;
          if (minutesUntil > 0 && minutesUntil <= UPCOMING_EVENT_MINUTES) {
            alertedEventIds.current.add(e._id);
            const data: UpcomingEventEvent = {
              eventId: e._id,
              eventNumber: e.eventNumber,
              title: e.title,
              minutesUntil: Math.ceil(minutesUntil),
            };
            showUpcomingEventToast(data);
            push("upcomingEvent", data);
          }
        }
      } catch {
        /* silent — will retry on next poll */
      }
    }

    function runChecks() {
      if (cancelled) return;
      checkTickets();
      checkEvents();
    }

    runChecks();
    const interval = setInterval(runChecks, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [push]);
}
