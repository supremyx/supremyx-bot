import { useEffect, useRef, useState } from "react";
import type { Notification, MatchEvent, TournamentStartEvent, TournamentEndEvent } from "../hooks/useMatchNotifications";

const AUTO_DISMISS_MS = 15_000;

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function fmtTime(d: Date) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function NotifContent({ notif }: { notif: Notification }) {
  if (notif.type === "match") {
    const m = notif.data as MatchEvent;
    const placement = m.placement > 0 ? (MEDAL[m.placement] ?? `#${m.placement}`) : null;
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-bold text-sm">🎮 Nouveau match — <span style={{ color: "#d4963a" }}>{m.team}</span></span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
          {[placement && `Place : ${placement}`, `+${m.points} pts`, `${m.kills} kills`, m.tournamentName && `Tournoi : ${m.tournamentName}`].filter(Boolean).join("  ·  ")}
        </span>
      </div>
    );
  }
  if (notif.type === "tournamentStart") {
    const t = notif.data as TournamentStartEvent;
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-bold text-sm">🏁 Tournoi démarré — <span style={{ color: "#34d399" }}>{t.name}</span></span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Lancé par {t.startedBy}</span>
      </div>
    );
  }
  const t = notif.data as TournamentEndEvent;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-bold text-sm">🏆 Tournoi terminé — <span style={{ color: "#facc15" }}>{t.name}</span></span>
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
        {t.winner ? `🥇 ${t.winner} (${t.winnerPts} pts)` : "Aucun vainqueur"} · {t.matchCount} match{t.matchCount > 1 ? "s" : ""}
      </span>
    </div>
  );
}

function accentColor(type: Notification["type"]) {
  if (type === "match")           return "#d4963a";
  if (type === "tournamentStart") return "#34d399";
  return "#facc15";
}

interface SingleBannerProps {
  notif: Notification;
  onDismiss: (id: string) => void;
  extra: number;
  onDismissAll: () => void;
}

function SingleBanner({ notif, onDismiss, extra, onDismissAll }: SingleBannerProps) {
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef    = useRef(Date.now());
  const color = accentColor(notif.type);

  useEffect(() => {
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(pct);
      if (pct <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onDismiss(notif.id);
      }
    }, 80);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [notif.id, onDismiss]);

  return (
    <div
      data-testid={`notification-banner-${notif.type}`}
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, rgba(22,21,30,0.97) 0%, rgba(30,28,40,0.97) 100%)`,
        borderLeft: `3px solid ${color}`,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-[2px] transition-none" style={{ width: `${progress}%`, background: color, opacity: 0.6 }} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-3">
        {/* Pulse dot */}
        <span className="relative flex size-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: color }} />
          <span className="relative inline-flex rounded-full size-2.5" style={{ background: color }} />
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <NotifContent notif={notif} />
        </div>

        {/* Time */}
        <span className="text-[10px] shrink-0 hidden sm:block" style={{ color: "rgba(255,255,255,0.35)" }}>
          {fmtTime(notif.time)}
        </span>

        {/* Extra badge */}
        {extra > 0 && (
          <button
            data-testid="button-show-all-notifications"
            onClick={onDismissAll}
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
            title="Tout effacer"
          >
            +{extra} autre{extra > 1 ? "s" : ""}
          </button>
        )}

        {/* Dismiss */}
        <button
          data-testid="button-dismiss-notification"
          onClick={() => onDismiss(notif.id)}
          className="shrink-0 size-6 flex items-center justify-center rounded-full text-xs transition-colors cursor-pointer"
          style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)" }}
          title="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

interface Props {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

export default function NotificationBanner({ notifications, onDismiss, onDismissAll }: Props) {
  if (notifications.length === 0) return null;

  const latest = notifications[0];
  const extra  = notifications.length - 1;

  return (
    <div
      className="w-full"
      style={{ animation: "slideDown 0.25s ease-out" }}
    >
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <SingleBanner
        notif={latest}
        onDismiss={onDismiss}
        extra={extra}
        onDismissAll={onDismissAll}
      />
    </div>
  );
}
