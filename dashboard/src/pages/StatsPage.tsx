import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface Team {
  rank: number;
  team: string;
  points: number;
  kills: number;
  wins: number;
  losses: number;
}

interface MatchEntry {
  id: string;
  team: string;
  placement: number;
  kills: number;
  points: number;
  tournamentName: string;
  date: string;
}

const COLORS = [
  "var(--primary)", "#f87171", "#34d399", "#a78bfa",
  "#60a5fa", "#f472b6", "#4ade80", "#fbbf24",
];

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

const tooltipStyle = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" },
  labelStyle: { color: "var(--muted-foreground)", fontSize: 11 },
  itemStyle: { fontSize: 12 },
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-bold mb-1 text-sm">{children}</h2>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs mb-5" style={{ color: "var(--muted-foreground)" }}>{children}</p>;
}

export default function StatsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTeams, setActiveTeams] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/ranking")).then(r => r.json()),
      fetch(apiUrl("/api/results?limit=50")).then(r => r.json()),
    ]).then(([r, res]) => {
      const t: Team[] = r.ranking ?? [];
      setTeams(t);
      setMatches(res.recentMatchEntries ?? []);
      setActiveTeams(new Set(t.slice(0, 5).map((x: Team) => x.team)));
      setLoading(false);
    }).catch(() => { setError("Impossible de charger les données."); setLoading(false); });
  }, []);

  function toggleTeam(name: string) {
    setActiveTeams(prev => {
      const next = new Set(prev);
      if (next.has(name)) { if (next.size > 1) next.delete(name); }
      else next.add(name);
      return next;
    });
  }

  const barData = teams.slice(0, 10).map(t => ({
    name: t.team.length > 12 ? t.team.slice(0, 12) + "…" : t.team,
    Points: t.points,
    Kills: t.kills,
  }));

  const teamNames = [...activeTeams];
  const cumulMap: Record<string, number> = {};
  for (const n of teamNames) cumulMap[n] = 0;

  const timelineRaw = [...matches]
    .filter(m => activeTeams.has(m.team))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const timelineData: Record<string, string | number>[] = [];
  for (const m of timelineRaw) {
    cumulMap[m.team] = (cumulMap[m.team] ?? 0) + m.points;
    timelineData.push({ date: m.date, ...Object.fromEntries(Object.entries(cumulMap)) });
  }
  const mergedByDate: Record<string, Record<string, string | number>> = {};
  for (const row of timelineData) {
    const d = fmtDate(row.date as string);
    mergedByDate[d] = { ...mergedByDate[d], date: d, ...row, date_label: d };
  }
  const lineData = Object.values(mergedByDate);

  const matchesPerTeam: Record<string, { kills: number; count: number }> = {};
  for (const m of matches) {
    if (!matchesPerTeam[m.team]) matchesPerTeam[m.team] = { kills: 0, count: 0 };
    matchesPerTeam[m.team].kills += m.kills;
    matchesPerTeam[m.team].count += 1;
  }
  const avgKillsData = Object.entries(matchesPerTeam)
    .map(([team, { kills, count }]) => ({ name: team.length > 12 ? team.slice(0, 12) + "…" : team, "Moy. kills": count > 0 ? parseFloat((kills / count).toFixed(1)) : 0 }))
    .sort((a, b) => b["Moy. kills"] - a["Moy. kills"])
    .slice(0, 10);

  const winRateData = teams
    .filter(t => t.wins + t.losses > 0)
    .map(t => ({ name: t.team.length > 12 ? t.team.slice(0, 12) + "…" : t.team, "Taux victoire (%)": Math.round((t.wins / (t.wins + t.losses)) * 100) }))
    .sort((a, b) => b["Taux victoire (%)"] - a["Taux victoire (%)"])
    .slice(0, 10);

  if (loading) return <div className="py-20 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>;
  if (error) return (
    <div className="py-16 text-center max-w-3xl mx-auto px-4">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="text-red-400 font-semibold">{error}</p>
    </div>
  );

  if (teams.length === 0) return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Card>
        <div className="py-12 text-center" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm">Aucune donnée disponible pour le moment.</p>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <Card>
        <SectionTitle>📊 Points & Kills — Top 10 équipes</SectionTitle>
        <SubTitle>Comparaison cumulée par équipe</SubTitle>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
              <Bar dataKey="Points" fill="oklch(0.7 0.18 55)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Kills"  fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {lineData.length > 1 && (
        <Card>
          <SectionTitle>📈 Évolution des points dans le temps</SectionTitle>
          <SubTitle>Basé sur les 50 derniers matchs · Cliquer pour afficher/masquer</SubTitle>
          <div className="flex flex-wrap gap-2 mb-5">
            {teams.slice(0, 10).map((t, i) => {
              const color = COLORS[i % COLORS.length];
              const isActive = activeTeams.has(t.team);
              return (
                <button
                  key={t.team}
                  onClick={() => toggleTeam(t.team)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
                  style={{
                    background: isActive ? `${color}22` : "var(--muted)",
                    border: `1px solid ${isActive ? `${color}55` : "var(--border)"}`,
                    color: isActive ? color : "var(--muted-foreground)",
                  }}
                >
                  <span className="size-2 rounded-full" style={{ background: color }} />
                  {t.team.length > 14 ? t.team.slice(0, 14) + "…" : t.team}
                </button>
              );
            })}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date_label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip {...tooltipStyle} />
                {teamNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[teams.findIndex(t => t.team === name) % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {avgKillsData.length > 0 && (
          <Card>
            <SectionTitle>💀 Moy. kills par match</SectionTitle>
            <SubTitle>Top 10 équipes</SubTitle>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgKillsData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="Moy. kills" fill="#f87171" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        {winRateData.length > 0 && (
          <Card>
            <SectionTitle>🏆 Taux de victoire</SectionTitle>
            <SubTitle>Top 10 équipes</SubTitle>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={winRateData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" unit="%" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, "Taux"]} />
                  <Bar dataKey="Taux victoire (%)" fill="#34d399" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
