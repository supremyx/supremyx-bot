import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { apiUrl } from "../lib/api";

export type NotifType = "match" | "tournamentStart" | "tournamentEnd" | "iaFallback";

export interface MatchEvent {
  team: string;
  placement: number;
  kills: number;
  points: number;
  tournamentName: string | null;
}

export interface TournamentStartEvent {
  name: string;
  startedBy: string;
}

export interface TournamentEndEvent {
  name: string;
  winner: string | null;
  winnerPts: number;
  matchCount: number;
  endedBy: string;
}

export interface IaFallbackEvent {
  primaryModel: string;
  fallbackModel: string;
  reason: string | number;
  date: string;
}

export interface Notification {
  id: string;
  type: NotifType;
  data: MatchEvent | TournamentStartEvent | TournamentEndEvent;
  time: Date;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
let _idCounter = 0;
function nextId() { return `notif-${Date.now()}-${++_idCounter}`; }

function showMatchToast(m: MatchEvent) {
  const placement = m.placement > 0 ? (MEDAL[m.placement] ?? `#${m.placement}`) : null;
  toast(`🎮 Nouveau match — ${m.team}`, {
    description: [
      placement && `Place : ${placement}`,
      `+${m.points} pts · ${m.kills} kills`,
      m.tournamentName && `Tournoi : ${m.tournamentName}`,
    ].filter(Boolean).join("  ·  "),
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

function showIaFallbackToast(f: IaFallbackEvent) {
  const short = (m: string) => m.split("/").pop()?.replace(":free", "") ?? m;
  toast.warning(`⚡ Fallback IA déclenché`, {
    description: `"${short(f.primaryModel)}" indisponible (${f.reason}) → basculement sur "${short(f.fallbackModel)}"`,
    duration: 10000,
  });
}

const MAX_NOTIFS = 20;

export function useMatchNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const push = useCallback((type: NotifType, data: Notification["data"]) => {
    const notif: Notification = { id: nextId(), type, data, time: new Date() };
    setNotifications(prev => [notif, ...prev].slice(0, MAX_NOTIFS));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => setNotifications([]), []);

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
          push("match", data);
        } catch { /* ignore */ }
      });

      es.addEventListener("newTournament", (e) => {
        try {
          const data: TournamentStartEvent = JSON.parse(e.data);
          showTournamentStartToast(data);
          push("tournamentStart", data);
        } catch { /* ignore */ }
      });

      es.addEventListener("endTournament", (e) => {
        try {
          const data: TournamentEndEvent = JSON.parse(e.data);
          showTournamentEndToast(data);
          push("tournamentEnd", data);
        } catch { /* ignore */ }
      });

      es.addEventListener("iaFallback", (e) => {
        try {
          const data: IaFallbackEvent = JSON.parse(e.data);
          showIaFallbackToast(data);
          push("iaFallback", data);
        } catch { /* ignore */ }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!unmounted) reconnectTimer.current = setTimeout(connect, 5_000);
      };
    }

    connect();
    return () => {
      unmounted = true;
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [push]);

  return { notifications, dismiss, dismissAll };
}
