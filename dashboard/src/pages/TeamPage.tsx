import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { apiUrl } from "../lib/api";

interface MatchEntry {
  matchId: string;
  points: number;
  kills: number;
  placement: number;
  addedBy: string;
  date: string;
  tournamentName: string | null;
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
  avgPlacement: number | null;
  killsPerMatch: number | null;
  winRate: number | null;
  timeline: TimelinePoint[];
  matchHistory: MatchEntry[];
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

const placementColor = (p: number) => {
  if (p === 1) return "text-yellow-400";
  if (p === 2) return "text-gray-300";
  if (p === 3) return "text-amber-600";
  return "text-gray-400";
};

const rankBadge = (rank: number) => {
  if (rank === 1) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
  if (rank === 2) return "bg-gray-400/20 text-gray-300 border-gray-400/40";
  if (rank === 3) return "bg-amber-700/20 text-amber-500 border-amber-700/40";
  return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
};

const ROWS_PER_PAGE = 20;

export default function TeamPage({
  teamName,
  onBack,
  onCompare,
}: {
  teamName: string;
  onBack: () => void;
  onCompare?: (name: string) => void;
}) {
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [histPage, setHistPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setHistPage(1);
    fetch(apiUrl(`/api/ranking/${encodeURIComponent(teamName)}`))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setDetail(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [teamName]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400 animate-pulse">
        Chargement du profil…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-400 font-semibold">{error ?? "Équipe introuvable"}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors cursor-pointer"
        >
          ← Retour
        </button>
      </div>
    );
  }

  const totalPages = Math.ceil((detail.matchHistory?.length ?? 0) / ROWS_PER_PAGE);
  const pagedHistory = (detail.matchHistory ?? []).slice(
    (histPage - 1) * ROWS_PER_PAGE,
    histPage * ROWS_PER_PAGE,
  );

  const statCards = [
    { label: "Points", value: detail.points.toLocaleString("fr-FR"), color: "text-indigo-300" },
    { label: "Kills totaux", value: detail.kills.toLocaleString("fr-FR"), color: "text-red-400" },
    { label: "Victoires", value: detail.wins, color: "text-emerald-400" },
    { label: "Défaites", value: detail.losses, color: "text-rose-500" },
    {
      label: "Place. moy.",
      value: detail.avgPlacement != null ? `#${detail.avgPlacement}` : "—",
      color: "text-amber-400",
    },
    {
      label: "Kills / match",
      value: detail.killsPerMatch != null ? detail.killsPerMatch : "—",
      color: "text-orange-400",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* Back + header */}
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="mt-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          ← Retour
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black truncate">{detail.team}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${rankBadge(detail.rank)}`}
            >
              Rang #{detail.rank}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {detail.matchCount} match{detail.matchCount !== 1 ? "s" : ""} joués
            {detail.winRate != null && (
              <span className="ml-2">· {detail.winRate}% de victoires</span>
            )}
          </p>
        </div>
        {onCompare && (
          <button
            onClick={() => onCompare(detail.team)}
            className="mt-1 px-3 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-300 hover:text-white text-sm font-semibold transition-colors cursor-pointer shrink-0"
          >
            ⚔️ Comparer
          </button>
        )}
      </div>

      {/* Win-rate bar */}
      {detail.winRate != null && detail.matchCount > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Taux de victoire</span>
            <span className="text-emerald-400 font-semibold">{detail.winRate}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(detail.winRate, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statCards.map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-[#1a1a2e] rounded-xl p-4 text-center border border-white/10"
          >
            <div className={`text-2xl font-black ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Points evolution chart */}
      {detail.timeline.length > 1 && (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-5">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-4">
            📈 Évolution des points
          </h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={detail.timeline}
                margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
              >
                <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDateShort}
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1a2e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                  labelFormatter={(v) => fmtDateShort(String(v))}
                  formatter={(val: number, name: string) => {
                    if (name === "pts") return [`${val} pts`, "Total cumulé"];
                    if (name === "match_pts") return [`+${val} pts`, "Ce match"];
                    return [val, name];
                  }}
                />
                <ReferenceLine y={0} stroke="#ffffff10" />
                <Line
                  type="monotone"
                  dataKey="pts"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  dot={detail.timeline.length < 30 ? { r: 3, fill: "#818cf8" } : false}
                  activeDot={{ r: 5, fill: "#818cf8" }}
                  name="pts"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Full match history */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="font-bold">📋 Historique complet</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {detail.matchHistory?.length ?? 0} match{(detail.matchHistory?.length ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <button
                onClick={() => setHistPage((p) => Math.max(1, p - 1))}
                disabled={histPage === 1}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors cursor-pointer"
              >
                ‹
              </button>
              <span>
                {histPage} / {totalPages}
              </span>
              <button
                onClick={() => setHistPage((p) => Math.min(totalPages, p + 1))}
                disabled={histPage === totalPages}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors cursor-pointer"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {pagedHistory.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <div className="text-4xl mb-3">📋</div>
            <p>Aucun match enregistré pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                  <th className="py-2 px-4 text-left">Date</th>
                  <th className="py-2 px-4 text-center">Place</th>
                  <th className="py-2 px-4 text-center">Points</th>
                  <th className="py-2 px-4 text-center">Kills</th>
                  <th className="py-2 px-4 text-left hidden sm:table-cell">Tournoi</th>
                  <th className="py-2 px-4 text-left hidden sm:table-cell text-gray-600">Ajouté par</th>
                </tr>
              </thead>
              <tbody>
                {pagedHistory.map((m, i) => (
                  <tr
                    key={String(m.matchId)}
                    className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                      i % 2 === 0 ? "" : "bg-white/[0.02]"
                    }`}
                  >
                    <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">
                      {fmtDate(m.date)}
                    </td>
                    <td className={`py-3 px-4 text-center font-bold ${placementColor(m.placement)}`}>
                      {m.placement > 0 ? (MEDAL[m.placement] ?? `#${m.placement}`) : "—"}
                    </td>
                    <td className="py-3 px-4 text-center text-indigo-300 font-bold">+{m.points}</td>
                    <td className="py-3 px-4 text-center text-red-400 font-semibold">{m.kills}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs hidden sm:table-cell">
                      {m.tournamentName ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs hidden sm:table-cell">
                      {m.addedBy ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
