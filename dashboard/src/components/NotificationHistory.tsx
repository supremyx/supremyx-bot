import { useEffect } from "react";
import type { Notification, MatchEvent, TournamentStartEvent, TournamentEndEvent, IaFallbackEvent, StaleTicketEvent, UpcomingEventEvent } from "../hooks/useMatchNotifications";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function fmtTime(d: Date) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function accentColor(type: Notification["type"]) {
  if (type === "match")           return "#d4963a";
  if (type === "tournamentStart") return "#34d399";
  if (type === "iaFallback")      return "#f97316";
  if (type === "staleTicket")     return "#ef4444";
  if (type === "upcomingEvent")   return "#38bdf8";
  if (type === "tournamentEnd")   return "#facc15";
  return "#facc15";
}

function typeLabel(type: Notification["type"]) {
  if (type === "match")           return "🎮 Match";
  if (type === "tournamentStart") return "🏁 Tournoi démarré";
  if (type === "iaFallback")      return "⚡ Fallback IA";
  if (type === "staleTicket")     return "🎫 Ticket sans réponse";
  if (type === "upcomingEvent")   return "📅 Événement bientôt";
  return "🏆 Tournoi terminé";
}

function NotifRow({ notif, onDismiss }: { notif: Notification; onDismiss: (id: string) => void }) {
  const color = accentColor(notif.type);

  let headline = "";
  let detail   = "";

  if (notif.type === "match") {
    const m = notif.data as MatchEvent;
    const placement = m.placement > 0 ? (MEDAL[m.placement] ?? `#${m.placement}`) : null;
    headline = m.team;
    detail   = [placement && `Place : ${placement}`, `+${m.points} pts`, `${m.kills} kills`, m.tournamentName && `Tournoi : ${m.tournamentName}`].filter(Boolean).join("  ·  ");
  } else if (notif.type === "tournamentStart") {
    const t = notif.data as TournamentStartEvent;
    headline = t.name;
    detail   = `Lancé par ${t.startedBy}`;
  } else if (notif.type === "iaFallback") {
    const f = notif.data as IaFallbackEvent;
    const short = (m: string) => m.split("/").pop()?.replace(":free", "") ?? m;
    headline = `${short(f.primaryModel)} → ${short(f.fallbackModel)}`;
    detail   = `Code erreur : ${f.reason}`;
  } else if (notif.type === "staleTicket") {
    const s = notif.data as StaleTicketEvent;
    headline = s.userTag;
    detail   = `${s.subject || "Sans sujet"} · ouvert depuis ${s.hoursOpen}h sans prise en charge`;
  } else if (notif.type === "upcomingEvent") {
    const u = notif.data as UpcomingEventEvent;
    headline = `#${u.eventNumber} ${u.title}`;
    detail   = `Commence dans ${u.minutesUntil} min`;
  } else {
    const t = notif.data as TournamentEndEvent;
    headline = t.name;
    detail   = `${t.winner ? `🥇 ${t.winner} (${t.winnerPts} pts)` : "Aucun vainqueur"} · ${t.matchCount} match${t.matchCount > 1 ? "s" : ""}`;
  }

  return (
    <div
      data-testid={`history-row-${notif.id}`}
      className="group flex items-start gap-3 px-4 py-3 transition-colors"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Color dot */}
      <span className="mt-1 size-2 rounded-full shrink-0" style={{ background: color }} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>{typeLabel(notif.type)}</span>
          <span className="text-[10px] shrink-0" style={{ color: "var(--muted-foreground)" }}>{fmtTime(notif.time)}</span>
        </div>
        <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{headline}</p>
        {detail && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{detail}</p>}
      </div>

      {/* Dismiss */}
      <button
        data-testid={`button-dismiss-history-${notif.id}`}
        onClick={() => onDismiss(notif.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 size-5 flex items-center justify-center rounded text-xs cursor-pointer shrink-0"
        style={{ color: "var(--muted-foreground)", background: "rgba(255,255,255,0.06)" }}
        title="Supprimer"
      >
        ✕
      </button>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

export default function NotificationHistory({ open, onClose, notifications, onDismiss, onDismissAll }: Props) {
  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="notification-history-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          background: "rgba(0,0,0,0.45)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Drawer */}
      <div
        data-testid="notification-history-panel"
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: "min(380px, 92vw)",
          background: "var(--card)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: "var(--foreground)" }}>🔔 Historique</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {notifications.length === 0 ? "Aucun événement cette session" : `${notifications.length} événement${notifications.length > 1 ? "s" : ""} cette session`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                data-testid="button-clear-all-history"
                onClick={onDismissAll}
                className="text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-colors font-medium"
                style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
              >
                Tout effacer
              </button>
            )}
            <button
              data-testid="button-close-history"
              onClick={onClose}
              className="size-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors text-sm"
              style={{ color: "var(--muted-foreground)", background: "rgba(255,255,255,0.06)" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.2)" }}>
          {[["#d4963a", "Match"], ["#34d399", "Tournoi démarré"], ["#facc15", "Tournoi terminé"], ["#f97316", "Fallback IA"], ["#ef4444", "Ticket sans réponse"], ["#38bdf8", "Événement bientôt"]].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16" style={{ color: "var(--muted-foreground)" }}>
              <span className="text-4xl">🔕</span>
              <p className="text-sm text-center">Aucun événement reçu.<br />Les matchs et tournois apparaîtront ici en temps réel.</p>
            </div>
          ) : (
            notifications.map(n => (
              <NotifRow key={n.id} notif={n} onDismiss={onDismiss} />
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-3 text-xs text-center" style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            Données de la session en cours uniquement
          </div>
        )}
      </div>
    </>
  );
}
