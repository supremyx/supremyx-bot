import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../lib/api";
import type { Notification, MatchEvent, TournamentStartEvent, TournamentEndEvent } from "../hooks/useMatchNotifications";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

type RawEvent = {
  kind: "match" | "tournamentStart" | "tournamentEnd";
  date: string;
  team?: string;
  placement?: number;
  kills?: number;
  points?: number;
  tournamentName?: string | null;
  name?: string;
  startedBy?: string;
  winner?: string | null;
  winnerPts?: number;
  matchCount?: number;
  endedBy?: string;
};

interface FeedItem {
  id: string;
  type: "match" | "tournamentStart" | "tournamentEnd";
  data: MatchEvent | TournamentStartEvent | TournamentEndEvent;
  time: Date;
  isLive?: boolean;
}

let _counter = 0;
function uid() { return `live-${Date.now()}-${++_counter}`; }

function rawToFeedItem(e: RawEvent): FeedItem {
  const time = new Date(e.date);
  if (e.kind === "match") {
    return {
      id: uid(), type: "match", time, isLive: false,
      data: {
        team: e.team ?? "?",
        placement: e.placement ?? 0,
        kills: e.kills ?? 0,
        points: e.points ?? 0,
        tournamentName: e.tournamentName ?? null,
      } as MatchEvent,
    };
  }
  if (e.kind === "tournamentStart") {
    return {
      id: uid(), type: "tournamentStart", time, isLive: false,
      data: { name: e.name ?? "?", startedBy: e.startedBy ?? "?" } as TournamentStartEvent,
    };
  }
  return {
    id: uid(), type: "tournamentEnd", time, isLive: false,
    data: {
      name: e.name ?? "?",
      winner: e.winner ?? null,
      winnerPts: e.winnerPts ?? 0,
      matchCount: e.matchCount ?? 0,
      endedBy: e.endedBy ?? "?",
    } as TournamentEndEvent,
  };
}

function notifToFeedItem(n: Notification): FeedItem {
  return { id: n.id, type: n.type, data: n.data, time: n.time, isLive: true };
}

function MatchCard({ data, time, isLive }: { data: MatchEvent; time: Date; isLive?: boolean }) {
  const medal = data.placement > 0 ? (MEDAL[data.placement] ?? `#${data.placement}`) : null;
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 size-9 rounded-xl flex items-center justify-center text-lg"
        style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.2)" }}>
        🎮
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm truncate">{data.team}</span>
          {isLive && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
              style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
              LIVE
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          {medal && <span className="mr-1">{medal}</span>}
          <span style={{ color: "var(--primary)" }} className="font-semibold">+{data.points} pts</span>
          <span className="mx-1">·</span>
          <span className="text-red-400 font-semibold">{data.kills} kills</span>
          {data.tournamentName && <><span className="mx-1">·</span>{data.tournamentName}</>}
        </p>
      </div>
      <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
        {timeAgo(time)}
      </span>
    </div>
  );
}

function TournamentStartCard({ data, time, isLive }: { data: TournamentStartEvent; time: Date; isLive?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 size-9 rounded-xl flex items-center justify-center text-lg"
        style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.2)" }}>
        🏁
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm truncate">{data.name}</span>
          {isLive && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
              style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
              LIVE
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Tournoi démarré · par <span className="font-medium" style={{ color: "var(--foreground)" }}>{data.startedBy}</span>
        </p>
      </div>
      <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
        {timeAgo(time)}
      </span>
    </div>
  );
}

function TournamentEndCard({ data, time, isLive }: { data: TournamentEndEvent; time: Date; isLive?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 size-9 rounded-xl flex items-center justify-center text-lg"
        style={{ background: "rgba(212,150,58,0.12)", border: "1px solid rgba(212,150,58,0.2)" }}>
        🏆
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm truncate">{data.name}</span>
          {isLive && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
              style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
              LIVE
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Terminé · {data.winner
            ? <><span className="font-medium" style={{ color: "var(--primary)" }}>🥇 {data.winner}</span> ({data.winnerPts} pts)</>
            : "Aucun vainqueur"
          }
          <span className="mx-1">·</span>{data.matchCount} match{data.matchCount !== 1 ? "s" : ""}
        </p>
      </div>
      <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
        {timeAgo(time)}
      </span>
    </div>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <div
      data-testid={`activity-item-${item.id}`}
      className="px-4 py-3 transition-all"
      style={{
        borderBottom: "1px solid var(--border)",
        background: item.isLive ? "rgba(52,211,153,0.03)" : "transparent",
      }}
    >
      {item.type === "match" && (
        <MatchCard data={item.data as MatchEvent} time={item.time} isLive={item.isLive} />
      )}
      {item.type === "tournamentStart" && (
        <TournamentStartCard data={item.data as TournamentStartEvent} time={item.time} isLive={item.isLive} />
      )}
      {item.type === "tournamentEnd" && (
        <TournamentEndCard data={item.data as TournamentEndEvent} time={item.time} isLive={item.isLive} />
      )}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  all: "Tout",
  match: "Matchs",
  tournamentStart: "Débuts",
  tournamentEnd: "Fins",
};

export default function LiveActivityPage({ liveNotifications }: { liveNotifications: Notification[] }) {
  const [history, setHistory] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "match" | "tournamentStart" | "tournamentEnd">("all");
  const [connected, setConnected] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const prevNotifIds = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(apiUrl("/api/activity"))
      .then(r => r.json())
      .then(d => {
        const items: FeedItem[] = (d.events ?? []).map((e: RawEvent) => rawToFeedItem(e));
        setHistory(items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const es = new EventSource(apiUrl("/api/events"));
    const onOpen = () => setConnected(true);
    const onError = () => setConnected(false);
    es.addEventListener("open", onOpen);
    es.onerror = onError;
    return () => { es.close(); setConnected(false); };
  }, []);

  useEffect(() => {
    const newOnes = liveNotifications.filter(n => !prevNotifIds.current.has(n.id));
    if (newOnes.length === 0) return;
    newOnes.forEach(n => prevNotifIds.current.add(n.id));
    const newItems = newOnes.map(n => notifToFeedItem(n));
    setHistory(prev => [...newItems, ...prev].slice(0, 100));
    setLiveCount(c => c + newOnes.length);
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [liveNotifications]);

  const allItems: FeedItem[] = history;
  const filtered = filter === "all" ? allItems : allItems.filter(i => i.type === filter);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>📡</span> Activité en direct
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Fil en temps réel — matchs, tournois et événements du bot
          </p>
        </div>

        {/* Connection status */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: connected ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
            border: `1px solid ${connected ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
            color: connected ? "#34d399" : "#f87171",
          }}
          data-testid="live-connection-status"
        >
          <span className={`size-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          {connected ? "Connecté" : "Reconnexion…"}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total événements", value: allItems.length, color: "var(--primary)" },
          { label: "En direct (session)", value: liveCount, color: "#34d399" },
          { label: "Matchs récents", value: allItems.filter(i => i.type === "match").length, color: "#f87171" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-3 text-center"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-xl font-bold" style={{ color }}>{value}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["all", "match", "tournamentStart", "tournamentEnd"] as const).map(f => (
          <button
            key={f}
            data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            style={{
              background: filter === f ? "rgba(212,150,58,0.15)" : "var(--muted)",
              color: filter === f ? "var(--primary)" : "var(--muted-foreground)",
              border: `1px solid ${filter === f ? "rgba(212,150,58,0.4)" : "var(--border)"}`,
            }}
          >
            {TYPE_LABELS[f]}
            {f !== "all" && (
              <span className="ml-1.5 opacity-60">
                {allItems.filter(i => i.type === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>

        {/* Feed header */}
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
            {filter === "all" ? "Tous les événements" : TYPE_LABELS[filter]}
            {!loading && <span className="ml-2 opacity-60">({filtered.length})</span>}
          </span>
          {liveCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
              +{liveCount} nouveau{liveCount > 1 ? "x" : ""}
            </span>
          )}
        </div>

        {/* Items */}
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: "60vh" }}>
          {loading && (
            <div className="py-16 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>
              <div className="text-3xl mb-3">📡</div>
              <p className="text-sm">Chargement de l'historique…</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
              <div className="text-3xl mb-3">🔇</div>
              <p className="text-sm font-medium">Aucun événement pour l'instant</p>
              <p className="text-xs mt-1">Les événements apparaîtront ici automatiquement</p>
            </div>
          )}

          {!loading && filtered.map(item => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2.5 text-center text-xs" style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            Mise à jour en temps réel · les 50 derniers événements sont affichés
          </div>
        )}
      </div>
    </main>
  );
}
