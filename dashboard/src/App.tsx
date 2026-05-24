import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import TournoisPage from "./pages/TournoisPage";
import JoueursPage from "./pages/JoueursPage";
import RostersPage from "./pages/RostersPage";
import CalendrierPage from "./pages/CalendrierPage";
import GlobalSearch from "./components/GlobalSearch";

type Page = "classement" | "tournois" | "joueurs" | "rosters" | "calendrier";

interface Team {
  rank: number;
  team: string;
  points: number;
  kills: number;
  wins: number;
  losses: number;
}

interface MatchEntry {
  matchId: string;
  points: number;
  kills: number;
  placement: number;
  addedBy: string;
  date: string;
}

interface TimelinePoint {
  date: string;
  pts: number;
  match_pts: number;
  kills: number;
  placement: number;
}

interface TeamDetail {
  team: string;
  rank: number;
  points: number;
  kills: number;
  wins: number;
  losses: number;
  matchCount: number;
  timeline: TimelinePoint[];
  recentMatches: MatchEntry[];
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

// ─── Team Detail Modal ────────────────────────────────────────────────────────
function DetailModal({ teamName, onClose }: { teamName: string; onClose: () => void }) {
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ranking/${encodeURIComponent(teamName)}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger les données."); setLoading(false); });
  }, [teamName]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#1a1a2e] z-10">
          <div>
            <h2 className="font-bold text-lg">{teamName}</h2>
            {detail && (
              <p className="text-xs text-gray-400 mt-0.5">
                Rang #{detail.rank} · {detail.matchCount} match{detail.matchCount !== 1 ? "s" : ""} joués
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer text-lg"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="py-20 text-center text-gray-400 animate-pulse">Chargement…</div>
        )}
        {error && (
          <div className="py-20 text-center text-red-400">{error}</div>
        )}

        {detail && (
          <div className="p-6 space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Points",   value: detail.points.toLocaleString("fr-FR"), color: "text-indigo-300" },
                { label: "Kills",    value: detail.kills.toLocaleString("fr-FR"),  color: "text-red-400"   },
                { label: "Victoires", value: detail.wins,   color: "text-emerald-400" },
                { label: "Défaites", value: detail.losses, color: "text-rose-500"    },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                  <div className={`text-xl font-black ${color}`}>{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Points timeline chart */}
            {detail.timeline.length > 1 && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">
                  Évolution des points
                </h3>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={detail.timeline} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                      <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={fmtDate}
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={{ background: "#1a1a2e", border: "1px solid #ffffff20", borderRadius: 8 }}
                        labelStyle={{ color: "#9ca3af", fontSize: 11 }}
                        itemStyle={{ color: "#818cf8" }}
                        labelFormatter={fmtDate}
                        formatter={(v: number) => [`${v} pts`, "Total"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="pts"
                        stroke="#818cf8"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: "#818cf8" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Recent matches */}
            {detail.recentMatches.length > 0 && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">
                  10 derniers matchs
                </h3>
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-white/10">
                        <th className="py-2 px-3 text-left">Date</th>
                        <th className="py-2 px-3 text-center">Place</th>
                        <th className="py-2 px-3 text-center">Points</th>
                        <th className="py-2 px-3 text-center">Kills</th>
                        <th className="py-2 px-3 text-left text-gray-600 hidden sm:table-cell">Par</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.recentMatches.map((m, i) => (
                        <tr key={m.matchId} className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/3"}`}>
                          <td className="py-2 px-3 text-gray-400 text-xs">{fmtDate(m.date)}</td>
                          <td className="py-2 px-3 text-center font-semibold">
                            {m.placement > 0
                              ? (MEDAL[m.placement] ?? `#${m.placement}`)
                              : <span className="text-gray-500">—</span>}
                          </td>
                          <td className="py-2 px-3 text-center text-indigo-300 font-bold">+{m.points}</td>
                          <td className="py-2 px-3 text-center text-red-400">{m.kills}</td>
                          <td className="py-2 px-3 text-gray-600 text-xs hidden sm:table-cell">{m.addedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detail.recentMatches.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-4">Aucun match enregistré.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Team Row ─────────────────────────────────────────────────────────────────
function TeamRow({ t, flash, onClick }: { t: Team; flash: boolean; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-white/10 cursor-pointer transition-colors duration-300 hover:bg-indigo-500/10 ${
        flash ? "bg-indigo-500/20" : t.rank <= 3 ? "bg-white/5" : ""
      }`}
    >
      <td className="py-3 px-4 text-center font-bold text-lg w-12">
        {MEDAL[t.rank] ?? <span className="text-gray-400 text-base">{t.rank}</span>}
      </td>
      <td className="py-3 px-4 font-semibold text-white group-hover:text-indigo-300">{t.team}</td>
      <td className="py-3 px-4 text-center text-indigo-300 font-bold text-base">
        {t.points.toLocaleString("fr-FR")}
      </td>
      <td className="py-3 px-4 text-center text-red-400 font-semibold">
        {t.kills.toLocaleString("fr-FR")}
      </td>
      <td className="py-3 px-4 text-center text-emerald-400">{t.wins}</td>
      <td className="py-3 px-4 text-center text-rose-500">{t.losses}</td>
    </tr>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]                   = useState<Page>("classement");
  const [ranking, setRanking]             = useState<Team[]>([]);
  const [lastUpdate, setLastUpdate]       = useState<Date | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [flash, setFlash]                 = useState<Set<string>>(new Set());
  const [countdown, setCountdown]         = useState(30);
  const [selected, setSelected]           = useState<string | null>(null);
  const [searchedPlayer, setSearchedPlayer] = useState<string | undefined>(undefined);

  const handleSearchTeam = useCallback((name: string) => {
    setPage("classement");
    setSelected(name);
  }, []);

  const handleSearchPlayer = useCallback((name: string) => {
    setSearchedPlayer(undefined);
    setTimeout(() => setSearchedPlayer(name), 0);
    setPage("joueurs");
  }, []);

  const fetchRanking = useCallback(async () => {
    try {
      const res  = await fetch("/api/ranking");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setRanking(prev => {
        const newFlash = new Set<string>();
        const prevMap  = new Map(prev.map(t => [t.team, t]));
        for (const t of (data.ranking ?? [])) {
          const old = prevMap.get(t.team);
          if (old && (old.points !== t.points || old.kills !== t.kills)) {
            newFlash.add(t.team);
          }
        }
        if (newFlash.size > 0) {
          setFlash(newFlash);
          setTimeout(() => setFlash(new Set()), 1500);
        }
        return data.ranking ?? [];
      });

      setLastUpdate(new Date());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRanking();
    const id = setInterval(() => { fetchRanking(); setCountdown(30); }, 30_000);
    return () => clearInterval(id);
  }, [fetchRanking]);

  useEffect(() => {
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const totalKills  = ranking.reduce((s, t) => s + t.kills, 0);
  const totalPoints = ranking.reduce((s, t) => s + t.points, 0);

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {selected && (
        <DetailModal teamName={selected} onClose={() => setSelected(null)} />
      )}

      {/* Header */}
      <header className="bg-[#1a1a2e] border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center font-black text-lg select-none">S</div>
            <div>
              <h1 className="text-base font-bold leading-none">SUPREMYX</h1>
              <p className="text-xs text-gray-400 mt-0.5">Classement en direct</p>
            </div>
          </div>
          {/* Nav tabs */}
          <nav className="hidden sm:flex items-center gap-1 ml-2">
            {([
              { key: "classement",  label: "🏆 Classement" },
              { key: "tournois",    label: "🎮 Tournois"   },
              { key: "joueurs",     label: "💀 Joueurs"    },
              { key: "rosters",     label: "🛡️ Rosters"   },
              { key: "calendrier",  label: "📅 Calendrier" },
            ] as { key: Page; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPage(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  page === key
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <GlobalSearch onSelectTeam={handleSearchTeam} onSelectPlayer={handleSearchPlayer} />
          {lastUpdate && page === "classement" && (
            <span className="hidden lg:inline">Mis à jour à {lastUpdate.toLocaleTimeString("fr-FR")}</span>
          )}
          {page === "classement" && (
            <button
              onClick={() => { fetchRanking(); setCountdown(30); }}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              ↻ Actualiser <span className="opacity-60 font-normal">({countdown}s)</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile nav */}
      <div className="sm:hidden flex gap-1 bg-[#1a1a2e] border-b border-white/10 px-4 py-2">
        {([
          { key: "classement",  label: "🏆 Classement" },
          { key: "tournois",    label: "🎮 Tournois"   },
          { key: "joueurs",     label: "💀 Joueurs"    },
          { key: "rosters",     label: "🛡️ Rosters"   },
          { key: "calendrier",  label: "📅 Calendrier" },
        ] as { key: Page; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPage(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              page === key
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {page === "tournois"   && <TournoisPage />}
      {page === "joueurs"    && <JoueursPage initialSelected={searchedPlayer} />}
      {page === "rosters"    && <RostersPage />}
      {page === "calendrier" && <CalendrierPage />}

      <main className={`max-w-3xl mx-auto px-4 py-8 ${page !== "classement" ? "hidden" : ""}`}>
        {/* Summary cards */}
        {ranking.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Équipes",       value: ranking.length,                      color: "text-indigo-400"  },
              { label: "Points totaux", value: totalPoints.toLocaleString("fr-FR"), color: "text-indigo-300"  },
              { label: "Kills totaux",  value: totalKills.toLocaleString("fr-FR"),  color: "text-red-400"     },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10 text-center">
                <div className={`text-2xl font-black ${color}`}>{value}</div>
                <div className="text-xs text-gray-400 mt-1">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="font-bold">🏆 Classement Général</h2>
              <p className="text-xs text-gray-500 mt-0.5">Cliquer sur une équipe pour voir le détail</p>
            </div>
            {loading && <span className="text-xs text-gray-400 animate-pulse">Chargement…</span>}
          </div>

          {error ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-red-400 font-semibold">{error}</p>
              <p className="text-gray-500 text-sm mt-1">Le bot Discord est peut-être hors ligne</p>
            </div>
          ) : ranking.length === 0 && !loading ? (
            <div className="py-16 text-center text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <p>Aucune équipe enregistrée pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                    <th className="py-2 px-4 text-center">#</th>
                    <th className="py-2 px-4 text-left">Équipe</th>
                    <th className="py-2 px-4 text-center">Points</th>
                    <th className="py-2 px-4 text-center">Kills</th>
                    <th className="py-2 px-4 text-center">V</th>
                    <th className="py-2 px-4 text-center">D</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map(t => (
                    <TeamRow
                      key={t.team}
                      t={t}
                      flash={flash.has(t.team)}
                      onClick={() => setSelected(t.team)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          SUPREMYX Dashboard · Actualisation automatique toutes les 30 secondes
        </p>
      </main>
    </div>
  );
}
