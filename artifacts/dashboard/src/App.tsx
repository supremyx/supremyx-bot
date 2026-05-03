import { useEffect, useState, useCallback } from "react";

interface Team {
  rank: number;
  team: string;
  points: number;
  kills: number;
  wins: number;
  losses: number;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function TeamRow({ t, flash }: { t: Team; flash: boolean }) {
  return (
    <tr
      className={`border-b border-white/10 transition-colors duration-500 ${
        flash ? "bg-indigo-500/20" : t.rank <= 3 ? "bg-white/5" : ""
      }`}
    >
      <td className="py-3 px-4 text-center font-bold text-lg w-12">
        {MEDAL[t.rank] ?? <span className="text-gray-400 text-base">{t.rank}</span>}
      </td>
      <td className="py-3 px-4 font-semibold text-white">{t.team}</td>
      <td className="py-3 px-4 text-center text-indigo-300 font-bold text-lg">
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

export default function App() {
  const [ranking, setRanking]     = useState<Team[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [flash, setFlash]         = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState(30);

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

  // Auto-refresh every 30s
  useEffect(() => {
    fetchRanking();
    const id = setInterval(() => { fetchRanking(); setCountdown(30); }, 30_000);
    return () => clearInterval(id);
  }, [fetchRanking]);

  // Countdown ticker
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const totalKills  = ranking.reduce((s, t) => s + t.kills, 0);
  const totalPoints = ranking.reduce((s, t) => s + t.points, 0);

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>

      {/* Header */}
      <header className="bg-[#1a1a2e] border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center font-black text-lg select-none">
            M
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">MoSeTo</h1>
            <p className="text-xs text-gray-400 mt-0.5">Classement en direct</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          {lastUpdate && (
            <span className="hidden sm:inline">
              Mis à jour à {lastUpdate.toLocaleTimeString("fr-FR")}
            </span>
          )}
          <button
            onClick={() => { fetchRanking(); setCountdown(30); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            ↻ Actualiser <span className="opacity-60 font-normal">({countdown}s)</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Summary cards */}
        {ranking.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Équipes",        value: ranking.length,                         color: "text-indigo-400" },
              { label: "Points totaux",  value: totalPoints.toLocaleString("fr-FR"),    color: "text-indigo-300" },
              { label: "Kills totaux",   value: totalKills.toLocaleString("fr-FR"),     color: "text-red-400"    },
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
            <h2 className="font-bold">🏆 Classement Général</h2>
            {loading && (
              <span className="text-xs text-gray-400 animate-pulse">Chargement…</span>
            )}
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
                    <TeamRow key={t.team} t={t} flash={flash.has(t.team)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          MoSeTo Dashboard · Actualisation automatique toutes les 30 secondes
        </p>
      </main>
    </div>
  );
}
