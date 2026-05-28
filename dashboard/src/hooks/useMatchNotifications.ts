import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiUrl } from "../lib/api";

interface MatchEvent {
  team: string;
  placement: number;
  kills: number;
  points: number;
  tournamentName: string | null;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function showMatchToast(m: MatchEvent) {
  const placement = m.placement > 0 ? (MEDAL[m.placement] ?? `#${m.placement}`) : null;
  toast(`🎮 Nouveau match — ${m.team}`, {
    description: [
      placement && `Place : ${placement}`,
      `+${m.points} pts · ${m.kills} kills`,
      m.tournamentName && `Tournoi : ${m.tournamentName}`,
    ]
      .filter(Boolean)
      .join("  ·  "),
    duration: 7000,
  });
}

export function useMatchNotifications() {
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      const es = new EventSource(apiUrl("/api/events"));
      esRef.current = es;

      es.addEventListener("newMatch", (e) => {
        try {
          const data: MatchEvent = JSON.parse(e.data);
          showMatchToast(data);
        } catch {
          // ignore malformed events
        }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Reconnect after 5s on error
        if (!unmounted) {
          reconnectTimer.current = setTimeout(connect, 5_000);
        }
      };
    }

    connect();

    return () => {
      unmounted = true;
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);
}
