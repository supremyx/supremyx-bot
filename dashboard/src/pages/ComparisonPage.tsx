import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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

function buildChartData(a: TimelinePoint[], b: TimelinePoint[]) {
  const len = Math.max(a.length, b.length);
  return Array.from({ length: len }, (_, i) => ({ i: i + 1, a: a[i]?.pts ?? null, b: b[i]?.pts ?? null }));
}

function StatBar({ label, valA, valB, higherIsBetter = true, fmt = (v: number) => String(v) }: {
  label: string; valA: number | null; valB: number | null; higherIsBetter?: boolean; fmt?: (v: number) => string;
}) {
  if (valA === null && valB === null) return null;
  const a = valA ?? 0, b = valB ?? 0;
  const total = a + b || 1;
  const pctA = (a / total) * 100;
  const aWins = higherIsBetter ? a > b : a < b;
  const bWins = higherIsBetter ? b > a : b < a;

  return (
    <div className="py-3 px-5" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
        <span className="font-bold text-sm w-20 text-left truncate" style={{ color: aWins ? "var(--primary)" : "var(--foreground)" }}>
          {valA !== null ? fmt(valA) : "—"}
          {aWins && <span className="ml-1 text-[10px]" style={{ color: "var(--primary)" }}>▲</span>}
        </span>
        <span className="text-xs text-center flex-1" style={{ color: "var(--muted-foreground)" }}>{label}</span>
        <span className="font-bold text-sm w-20 text-right truncate" style={{ color: bWins ? "#a78bfa" : "var(--foreground)" }}>
          {bWins && <span className="mr-1 text-[10px] text-violet-400">▲</span>}
          {valB !== null ? fmt(valB) : "—"}
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
        <div className="h-full transition-all duration-700" style={{ width: `${pctA}%`, background: "oklch(0.7 0.18 55)" }} />
        <div className="h-full flex-1 transition-all duration-700" style={{ background: "#a78bfa" }} />
      </div>
    </div>
  );
}

function TeamSelector({ label, color, value, teams, onChange }: {
  label: string; color: string; value: string; teams: SimpleTeam[]; onChange: (name: string) => void;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl p-4" style={{ background: "var(--card)", border: `1px solid ${color}` }}>
      <p className="text-xs mb-2 uppercase tracking-wider font-semibold" style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer"
        style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      >
        <option value="">— Choisir une équipe —</option>
        {teams.map(t => (
          <option key={t.team} value={t.team} style={{ background: "var(--card)" }}>#{t.rank} {t.team}</option>
        ))}
      </select>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--muted-foreground)" },
};

export default function ComparisonPage({ initialA, initialB, onBack }: { initialA?: string; initialB?: string; onBack: () => void }) {
  const [teams, setTeams] = useState<SimpleTeam[]>([]);
  const [nameA, setNameA] = useState(initialA ?? "");
  const [nameB, setNameB] = useState(initialB ?? "");
  const [detailA, setDetailA] = useState<TeamDetail | null>(null);
  const [detailB, setDetailB] = useState<TeamDetail | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/ranking")).then(r => r.json()).then(d =>
      setTeams((d.ranking ?? []).map((t: { team: string; rank: number; points: number }) => ({ team: t.team, rank: t.rank, points: t.points })))
    ).catch(() => {});
  }, []);

  useEffect(() => {
    if (!nameA) { setDetailA(null); return; }
    setLoadingA(true);
    fetch(apiUrl(`/api/ranking/${encodeURIComponent(nameA)}`)).then(r => r.json()).then(d => { setDetailA(d); setLoadingA(false); }).catch(() => setLoadingA(false));
  }, [nameA]);

  useEffect(() => {
    if (!nameB) { setDetailB(null); return; }
    setLoadingB(true);
    fetch(apiUrl(`/api/ranking/${encodeURIComponent(nameB)}`)).then(r => r.json()).then(d => { setDetailB(d); setLoadingB(false); }).catch(() => setLoadingB(false));
  }, [nameB]);

  const ready = detailA && detailB;
  const chartData = ready ? buildChartData(detailA.timeline, detailB.timeline) : [];

  const sharedTournaments = ready
    ? Array.from(new Set([...detailA.matchHistory.map(m => m.tournamentName).filter(Boolean), ...detailB.matchHistory.map(m => m.tournamentName).filter(Boolean)]).values())
        .filter(tn => detailA.matchHistory.some(m => m.tournamentName === tn) && detailB.matchHistory.some(m => m.tournamentName === tn))
    : [];

  let advantageA = 0, advantageB = 0;
  if (ready) {
    if (detailA.points > detailB.points) advantageA++; else if (detailB.points > detailA.points) advantageB++;
    if (detailA.kills > detailB.kills) advantageA++; else if (detailB.kills > detailA.kills) advantageB++;
    if (detailA.wins > detailB.wins) advantageA++; else if (detailB.wins > detailA.wins) advantageB++;
    if (detailA.winRate != null && detailB.winRate != null) {
      if (detailA.winRate > detailB.winRate) advantageA++; else if (detailB.winRate > detailA.winRate) advantageB++;
    }
    if (detailA.avgPlacement != null && detailB.avgPlacement != null) {
      if (detailA.avgPlacement < detailB.avgPlacement) advantageA++; else if (detailB.avgPlacement < detailA.avgPlacement) advantageB++;
    }
    if (detailA.killsPerMatch != null && detailB.killsPerMatch != null) {
      if (detailA.killsPerMatch > detailB.killsPerMatch) advantageA++; else if (detailB.killsPerMatch > detailA.killsPerMatch) advantageB++;
    }
  }
  const winner = advantageA > advantageB ? detailA?.team : advantageB > advantageA ? detailB?.team : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>← Retour</button>
        <h1 className="text-2xl font-black">⚔️ Comparaison</h1>
      </div>

      <div className="flex gap-4 flex-col sm:flex-row">
        <TeamSelector label="Équipe A" color="rgba(212,150,58,0.3)" value={nameA} teams={teams} onChange={setNameA} />
        <div className="flex items-center justify-center shrink-0 font-black text-lg" style={{ color: "var(--muted-foreground)" }}>VS</div>
        <TeamSelector label="Équipe B" color="rgba(168,85,247,0.3)" value={nameB} teams={teams} onChange={setNameB} />
      </div>

      {(loadingA || loadingB) && <div className="text-center animate-pulse py-4 text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement des données…</div>}

      {(!nameA || !nameB) ? (
        <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-5xl mb-4">⚔️</div>
          <p>Sélectionne deux équipes pour lancer la comparaison.</p>
        </div>
      ) : ready ? (
        <>
          <div className="rounded-xl p-4 text-center" style={{ background: winner ? "rgba(212,150,58,0.08)" : "var(--card)", border: `1px solid ${winner ? "rgba(212,150,58,0.3)" : "var(--border)"}` }}>
            {winner ? (
              <>
                <div className="text-2xl mb-1">🏆</div>
                <p className="font-black text-lg" style={{ color: "var(--primary)" }}>{winner}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Avantage sur {Math.max(advantageA, advantageB)} / {advantageA + advantageB} critères</p>
              </>
            ) : (
              <>
                <div className="text-2xl mb-1">🤝</div>
                <p className="font-bold">Égalité parfaite</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Résultats identiques sur tous les critères</p>
              </>
            )}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-bold text-sm">Statistiques</h2>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full inline-block" style={{ background: "oklch(0.7 0.18 55)" }} /><span style={{ color: "var(--muted-foreground)" }}>{detailA.team}</span></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-violet-500 inline-block" /><span style={{ color: "var(--muted-foreground)" }}>{detailB.team}</span></span>
              </div>
            </div>
            <StatBar label="Points totaux" valA={detailA.points} valB={detailB.points} fmt={v => v.toLocaleString("fr-FR")} />
            <StatBar label="Kills totaux" valA={detailA.kills} valB={detailB.kills} fmt={v => v.toLocaleString("fr-FR")} />
            <StatBar label="Victoires" valA={detailA.wins} valB={detailB.wins} />
            <StatBar label="Défaites" valA={detailA.losses} valB={detailB.losses} higherIsBetter={false} />
            <StatBar label="Taux de victoire (%)" valA={detailA.winRate} valB={detailB.winRate} fmt={v => `${v}%`} />
            <StatBar label="Matchs joués" valA={detailA.matchCount} valB={detailB.matchCount} />
            <StatBar label="Placement moyen" valA={detailA.avgPlacement} valB={detailB.avgPlacement} higherIsBetter={false} fmt={v => `#${v}`} />
            <StatBar label="Kills / match" valA={detailA.killsPerMatch} valB={detailB.killsPerMatch} />
          </div>

          {chartData.length > 1 && (
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="text-xs uppercase tracking-wider font-semibold mb-4" style={{ color: "var(--muted-foreground)" }}>📈 Évolution des points</h2>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                    <XAxis dataKey="i" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: "Match #", position: "insideBottomRight", offset: -4, fill: "var(--muted-foreground)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip {...tooltipStyle} labelFormatter={v => `Match #${v}`} formatter={(val: number, name: string) => [`${val} pts`, name === "a" ? detailA.team : detailB.team]} />
                    <Legend formatter={value => value === "a" ? detailA.team : detailB.team} wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
                    <Line type="monotone" dataKey="a" stroke="oklch(0.7 0.18 55)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
                    <Line type="monotone" dataKey="b" stroke="#a78bfa" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} strokeDasharray="5 3" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {sharedTournaments.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <h2 className="font-bold text-sm">🏆 Tournois en commun</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Les deux équipes ont participé à ces tournois</p>
              </div>
              <div>
                {sharedTournaments.map(tn => {
                  const ptsA = detailA.matchHistory.filter(m => m.tournamentName === tn).reduce((s, m) => s + m.points, 0);
                  const ptsB = detailB.matchHistory.filter(m => m.tournamentName === tn).reduce((s, m) => s + m.points, 0);
                  return (
                    <div key={String(tn)} className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="text-sm font-semibold">{tn}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-bold" style={{ color: ptsA > ptsB ? "var(--primary)" : "var(--muted-foreground)" }}>{detailA.team} {ptsA} pts</span>
                        <span style={{ color: "var(--muted-foreground)" }}>·</span>
                        <span className="font-bold" style={{ color: ptsB > ptsA ? "#a78bfa" : "var(--muted-foreground)" }}>{detailB.team} {ptsB} pts</span>
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
