import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../lib/api";

interface MatchEntry {
  id: string;
  team: string;
  placement: number;
  kills: number;
  points: number;
  tournamentName: string | null;
  date: string;
}

interface CompletedMatch {
  id: string;
  date: string;
  teams: string[];
  tournamentName: string | null;
  resultPostedAt: string;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const placementColor = (p: number) => {
  if (p === 1) return "#facc15";
  if (p === 2) return "#d1d5db";
  if (p === 3) return "#d97706";
  return "var(--muted-foreground)";
};

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
      <span className="relative flex size-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
      </span>
      LIVE
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>{children}</div>;
}

export default function ResultsPage({ onTeamClick }: { onTeamClick?: (name: string) => void }) {
  const [entries, setEntries] = useState<MatchEntry[]>([]);
  const [completed, setCompleted] = useState<CompletedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"entries" | "completed">("entries");
  const [liveConnected, setLiveConnected] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/results?limit=50"))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setEntries(data.recentMatchEntries ?? []); setCompleted(data.completedMatches ?? []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    let unmounted = false;
    function connect() {
      if (unmounted) return;
      const es = new EventSource(apiUrl("/api/events"));
      esRef.current = es;
      es.onopen = () => setLiveConnected(true);
      es.addEventListener("newMatch", (e) => {
        try {
          const data = JSON.parse(e.data);
          const freshEntry: MatchEntry = { id: `live-${Date.now()}`, team: data.team, placement: data.placement, kills: data.kills, points: data.points, tournamentName: data.tournamentName ?? null, date: new Date().toISOString() };
          setEntries(prev => [freshEntry, ...prev].slice(0, 50));
          setNewIds(prev => { const next = new Set(prev); next.add(freshEntry.id); setTimeout(() => setNewIds(s => { const n = new Set(s); n.delete(freshEntry.id); return n; }), 4000); return next; });
          setTab("entries");
        } catch {}
      });
      es.onerror = () => { setLiveConnected(false); es.close(); esRef.current = null; if (!unmounted) reconnectTimer.current = setTimeout(connect, 5_000); };
    }
    connect();
    return () => { unmounted = true; esRef.current?.close(); if (reconnectTimer.current) clearTimeout(reconnectTimer.current); };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {(["entries", "completed"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              style={{ background: tab === t ? "var(--primary)" : "transparent", color: tab === t ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
            >
              {t === "entries" ? "🎯 Résultats par équipe" : "✅ Matchs terminés"}
            </button>
          ))}
        </div>
        {liveConnected && <LiveDot />}
      </div>

      {loading && <div className="py-20 text-center animate-pulse text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement des résultats…</div>}
      {error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Le bot Discord est peut-être hors ligne</p>
        </div>
      )}

      {!loading && !error && tab === "entries" && (
        <Card>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 className="font-bold text-sm">Derniers résultats de matchs</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{entries.length} entrée{entries.length !== 1 ? "s" : ""} récente{entries.length !== 1 ? "s" : ""}</p>
            </div>
            {liveConnected && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>mise à jour en temps réel</span>}
          </div>

          {entries.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
              <div className="text-4xl mb-3">📋</div>
              <p>Aucun résultat enregistré pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                    <th className="py-2 px-4 text-left">Date</th>
                    <th className="py-2 px-4 text-left">Équipe</th>
                    <th className="py-2 px-4 text-center">Place</th>
                    <th className="py-2 px-4 text-center">Points</th>
                    <th className="py-2 px-4 text-center">Kills</th>
                    <th className="py-2 px-4 text-left hidden sm:table-cell">Tournoi</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((m, i) => {
                    const isNew = newIds.has(m.id);
                    return (
                      <tr key={m.id} className="transition-all duration-700" style={{ borderBottom: "1px solid var(--border)", background: isNew ? "rgba(52,211,153,0.08)" : i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                        <td className="py-3 px-4 text-xs whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                          {isNew ? <span className="text-emerald-400 font-semibold">À l'instant</span> : fmtDate(m.date)}
                        </td>
                        <td className="py-3 px-4 font-semibold">
                          <button onClick={() => onTeamClick?.(m.team)} className={`transition-colors ${onTeamClick ? "cursor-pointer" : "cursor-default"}`}
                            onMouseEnter={e => { if (onTeamClick) (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)"; }}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = ""}
                          >
                            {m.team}
                          </button>
                          {isNew && <span className="ml-2 text-[10px] text-emerald-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide" style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)" }}>nouveau</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-bold" style={{ color: placementColor(m.placement) }}>
                          {MEDAL[m.placement] ?? `#${m.placement}`}
                        </td>
                        <td className="py-3 px-4 text-center font-bold" style={{ color: "var(--primary)" }}>+{m.points}</td>
                        <td className="py-3 px-4 text-center text-red-400 font-semibold">{m.kills}</td>
                        <td className="py-3 px-4 text-xs hidden sm:table-cell" style={{ color: "var(--muted-foreground)" }}>{m.tournamentName ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {!loading && !error && tab === "completed" && (
        <Card>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="font-bold text-sm">Matchs planifiés terminés</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{completed.length} match{completed.length !== 1 ? "s" : ""} terminé{completed.length !== 1 ? "s" : ""}</p>
          </div>
          {completed.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
              <div className="text-4xl mb-3">📅</div>
              <p>Aucun match planifié terminé pour le moment.</p>
            </div>
          ) : (
            <div>
              {completed.map(m => (
                <div key={m.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors" style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {(m.teams ?? []).map(team => (
                        <span key={team} className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: "rgba(212,150,58,0.15)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}>
                          {team}
                        </span>
                      ))}
                    </div>
                    {m.tournamentName && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>🏆 {m.tournamentName}</p>}
                  </div>
                  <div className="text-right text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>
                    <div>Prévu : {fmtDate(m.date)}</div>
                    <div className="text-emerald-400">Terminé : {fmtDate(m.resultPostedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
