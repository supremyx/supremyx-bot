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

interface TournamentStartEvent {
  name: string;
  startedBy: string;
}

interface TournamentEndEvent {
  name: string;
  winner: string | null;
  winnerPts: number;
  matchCount: number;
  endedBy: string;
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

function showTournamentStartToast(t: TournamentStartEvent) {
  toast.success(`🏁 Tournoi démarré — ${t.name}`, {
    description: `Lancé par ${t.startedBy} · Bonne chance à toutes les équipes !`,
    duration: 10000,
  });
}

function showTournamentEndToast(t: TournamentEndEvent) {
  const winnerLine = t.winner
    ? `🥇 Vainqueur : ${t.winner} (${t.winnerPts} pts)`
    : "Aucun vainqueur enregistré";
  toast(`🏆 Tournoi terminé — ${t.name}`, {
    description: `${winnerLine}  ·  ${t.matchCount} match${t.matchCount > 1 ? "s" : ""} joué${t.matchCount > 1 ? "s" : ""}`,
    duration: 12000,
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

      es.addEventListener("newTournament", (e) => {
        try {
          const data: TournamentStartEvent = JSON.parse(e.data);
          showTournamentStartToast(data);
        } catch {
          // ignore malformed events
        }
      });

      es.addEventListener("endTournament", (e) => {
        try {
          const data: TournamentEndEvent = JSON.parse(e.data);
          showTournamentEndToast(data);
        } catch {
          // ignore malformed events
        }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
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
