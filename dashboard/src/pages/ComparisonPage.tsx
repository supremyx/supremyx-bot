import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { apiUrl } from "../lib/api";

interface MatchEntry {
  matchId: string;
  points: number;
  kills: number;
  placement: number;
  date: string;
  tournamentName: string | null;
}

interface TimelinePoint {
  date: string;
  pts: number;
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

interface SimpleTeam {
  team: string;
  rank: number;
  points: number;
}

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

// Merge two timelines into a single series keyed by index for recharts
function buildChartData(a: TimelinePoint[], b: TimelinePoint[]) {
  const len = Math.max(a.length, b.length);
  return Array.from({ length: len }, (_, i) => ({
    i: i + 1,
    a: a[i]?.pts ?? null,
    b: b[i]?.pts ?? null,
  }));
}

function StatBar({
  label,
  valA,
  valB,
  higherIsBetter = true,
  fmt = (v: number) => String(v),
}: {
  label: string;
  valA: number | null;
  valB: number | null;
  higherIsBetter?: boolean;
  fmt?: (v: number) => string;
}) {
  if (valA === null && valB === null) return null;
  const a = valA ?? 0;
  const b = valB ?? 0;
  const total = a + b || 1;
  const pctA = (a / total) * 100;

  const aWins = higherIsBetter ? a > b : a < b;
  const bWins = higherIsBetter ? b > a : b < a;

  return (
    <div className="py-3 px-5 border-b border-white/5 last:border-0">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
        <span className={`font-bold text-sm w-20 text-left truncate ${aWins ? "text-indigo-300" : "text-gray-300"}`}>
          {valA !== null ? fmt(valA) : "—"}
          {aWins && <span className="ml-1 text-[10px] text-indigo-400">▲</span>}
        </span>
        <span className="text-gray-500 text-xs text-center flex-1">{label}</span>
        <span className={`font-bold text-sm w-20 text-right truncate ${bWins ? "text-violet-300" : "text-gray-300"}`}>
          {bWins && <span className="mr-1 text-[10px] text-violet-400">▲</span>}
          {valB !== null ? fmt(valB) : "—"}
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-white/10">
        <div
          className="h-full bg-indigo-500 transition-all duration-700"
          style={{ width: `${pctA}%` }}
        />
        <div className="h-full bg-violet-500 flex-1 transition-all duration-700" />
      </div>
    </div>
  );
}

function TeamSelector({
  label,
  color,
  value,
  teams,
  onChange,
}: {
  label: string;
  color: string;
  value: string;
  teams: SimpleTeam[];
  onChange: (name: string) => void;
}) {
  return (
    <div className={`flex-1 min-w-0 rounded-2xl border ${color} bg-[#1a1a2e] p-4`}>
      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
      >
        <option value="">— Choisir une équipe —</option>
        {teams.map((t) => (
          <option key={t.team} value={t.team} className="bg-[#1a1a2e]">
            #{t.rank} {t.team}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ComparisonPage({
  initialA,
  initialB,
  onBack,
}: {
  initialA?: string;
  initialB?: string;
  onBack: () => void;
}) {
  const [teams, setTeams] = useState<SimpleTeam[]>([]);
  const [nameA, setNameA] = useState(initialA ?? "");
  const [nameB, setNameB] = useState(initialB ?? "");
  const [detailA, setDetailA] = useState<TeamDetail | null>(null);
  const [detailB, setDetailB] = useState<TeamDetail | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  // Fetch team list
  useEffect(() => {
    fetch(apiUrl("/api/ranking"))
      .then((r) => r.json())
      .then((d) =>
        setTeams(
          (d.ranking ?? []).map((t: { team: string; rank: number; points: number }) => ({
            team: t.team,
            rank: t.rank,
            points: t.points,
          }))
        )
      )
      .catch(() => {});
  }, []);

  // Fetch team A
  useEffect(() => {
    if (!nameA) { setDetailA(null); return; }
    setLoadingA(true);
    fetch(apiUrl(`/api/ranking/${encodeURIComponent(nameA)}`))
      .then((r) => r.json())
      .then((d) => { setDetailA(d); setLoadingA(false); })
      .catch(() => setLoadingA(false));
  }, [nameA]);

  // Fetch team B
  useEffect(() => {
    if (!nameB) { setDetailB(null); return; }
    setLoadingB(true);
    fetch(apiUrl(`/api/ranking/${encodeURIComponent(nameB)}`))
      .then((r) => r.json())
      .then((d) => { setDetailB(d); setLoadingB(false); })
      .catch(() => setLoadingB(false));
  }, [nameB]);

  const ready = detailA && detailB;
  const chartData = ready ? buildChartData(detailA.timeline, detailB.timeline) : [];

  // Shared tournaments
  const sharedTournaments = ready
    ? Array.from(
        new Set([
          ...detailA.matchHistory.map((m) => m.tournamentName).filter(Boolean),
          ...detailB.matchHistory.map((m) => m.tournamentName).filter(Boolean),
        ]).values()
      ).filter((tn) =>
        detailA.matchHistory.some((m) => m.tournamentName === tn) &&
        detailB.matchHistory.some((m) => m.tournamentName === tn)
      )
    : [];

  // Overall advantage
  let advantageA = 0;
  let advantageB = 0;
  if (ready) {
    if (detailA.points > detailB.points) advantageA++;
    else if (detailB.points > detailA.points) advantageB++;
    if (detailA.kills > detailB.kills) advantageA++;
    else if (detailB.kills > detailA.kills) advantageB++;
    if (detailA.wins > detailB.wins) advantageA++;
    else if (detailB.wins > detailA.wins) advantageB++;
    if (detailA.winRate != null && detailB.winRate != null) {
      if (detailA.winRate > detailB.winRate) advantageA++;
      else if (detailB.winRate > detailA.winRate) advantageB++;
    }
    if (detailA.avgPlacement != null && detailB.avgPlacement != null) {
      if (detailA.avgPlacement < detailB.avgPlacement) advantageA++;
      else if (detailB.avgPlacement < detailA.avgPlacement) advantageB++;
    }
    if (detailA.killsPerMatch != null && detailB.killsPerMatch != null) {
      if (detailA.killsPerMatch > detailB.killsPerMatch) advantageA++;
      else if (detailB.killsPerMatch > detailA.killsPerMatch) advantageB++;
    }
  }

  const winner =
    advantageA > advantageB ? detailA?.team :
    advantageB > advantageA ? detailB?.team :
    null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          ← Retour
        </button>
        <h1 className="text-2xl font-black">⚔️ Comparaison</h1>
      </div>

      {/* Team selectors */}
      <div className="flex gap-4 flex-col sm:flex-row">
        <TeamSelector
          label="Équipe A"
          color="border-indigo-500/30"
          value={nameA}
          teams={teams}
          onChange={setNameA}
        />
        <div className="flex items-center justify-center shrink-0 text-gray-600 font-black text-lg">VS</div>
        <TeamSelector
          label="Équipe B"
          color="border-violet-500/30"
          value={nameB}
          teams={teams}
          onChange={setNameB}
        />
      </div>

      {/* Loading states */}
      {(loadingA || loadingB) && (
        <div className="text-center text-gray-400 animate-pulse py-4 text-sm">
          Chargement des données…
        </div>
      )}

      {/* Empty state */}
      {!nameA || !nameB ? (
        <div className="py-16 text-center text-gray-500">
          <div className="text-5xl mb-4">⚔️</div>
          <p>Sélectionne deux équipes pour lancer la comparaison.</p>
        </div>
      ) : ready ? (
        <>
          {/* Verdict banner */}
          <div className={`rounded-2xl border p-4 text-center ${
            winner
              ? "bg-yellow-500/10 border-yellow-500/30"
              : "bg-white/5 border-white/10"
          }`}>
            {winner ? (
              <>
                <div className="text-2xl mb-1">🏆</div>
                <p className="font-black text-lg text-yellow-400">{winner}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Avantage sur {Math.max(advantageA, advantageB)} / {advantageA + advantageB} critères
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl mb-1">🤝</div>
                <p className="font-bold text-gray-300">Égalité parfaite</p>
                <p className="text-xs text-gray-500 mt-0.5">Résultats identiques sur tous les critères</p>
              </>
            )}
          </div>

          {/* Stats bars */}
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-bold text-sm">📊 Statistiques</h2>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 rounded-full bg-indigo-500 inline-block" />
                  <span className="text-gray-400">{detailA.team}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 rounded-full bg-violet-500 inline-block" />
                  <span className="text-gray-400">{detailB.team}</span>
                </span>
              </div>
            </div>
            <StatBar label="Points totaux" valA={detailA.points} valB={detailB.points} fmt={(v) => v.toLocaleString("fr-FR")} />
            <StatBar label="Kills totaux" valA={detailA.kills} valB={detailB.kills} fmt={(v) => v.toLocaleString("fr-FR")} />
            <StatBar label="Victoires" valA={detailA.wins} valB={detailB.wins} />
            <StatBar label="Défaites" valA={detailA.losses} valB={detailB.losses} higherIsBetter={false} />
            <StatBar label="Taux de victoire (%)" valA={detailA.winRate} valB={detailB.winRate} fmt={(v) => `${v}%`} />
            <StatBar label="Matchs joués" valA={detailA.matchCount} valB={detailB.matchCount} />
            <StatBar
              label="Placement moyen"
              valA={detailA.avgPlacement}
              valB={detailB.avgPlacement}
              higherIsBetter={false}
              fmt={(v) => `#${v}`}
            />
            <StatBar label="Kills / match" valA={detailA.killsPerMatch} valB={detailB.killsPerMatch} fmt={(v) => String(v)} />
          </div>

          {/* Overlapping points chart */}
          {chartData.length > 1 && (
            <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 p-5">
              <h2 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-4">
                📈 Évolution des points
              </h2>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="#ffffff10" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="i"
                      tick={{ fill: "#6b7280", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "Match #", position: "insideBottomRight", offset: -4, fill: "#6b7280", fontSize: 10 }}
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
                      labelFormatter={(v) => `Match #${v}`}
                      formatter={(val: number, name: string) => {
                        const label = name === "a" ? detailA.team : detailB.team;
                        return [`${val} pts`, label];
                      }}
                    />
                    <Legend
                      formatter={(value) => (value === "a" ? detailA.team : detailB.team)}
                      wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="a"
                      stroke="#818cf8"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="b"
                      stroke="#a78bfa"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                      strokeDasharray="5 3"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Shared tournaments */}
          {sharedTournaments.length > 0 && (
            <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="font-bold text-sm">🏆 Tournois en commun</h2>
                <p className="text-xs text-gray-500 mt-0.5">Les deux équipes ont participé à ces tournois</p>
              </div>
              <div className="divide-y divide-white/5">
                {sharedTournaments.map((tn) => {
                  const ptsA = detailA.matchHistory
                    .filter((m) => m.tournamentName === tn)
                    .reduce((s, m) => s + m.points, 0);
                  const ptsB = detailB.matchHistory
                    .filter((m) => m.tournamentName === tn)
                    .reduce((s, m) => s + m.points, 0);
                  return (
                    <div key={String(tn)} className="px-5 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-200">{tn}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className={`font-bold ${ptsA > ptsB ? "text-indigo-300" : "text-gray-500"}`}>
                          {detailA.team} {ptsA} pts
                        </span>
                        <span className="text-gray-600">·</span>
                        <span className={`font-bold ${ptsB > ptsA ? "text-violet-300" : "text-gray-500"}`}>
                          {detailB.team} {ptsB} pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
