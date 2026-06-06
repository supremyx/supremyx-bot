import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
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
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

const placementColor = (p: number) => {
  if (p === 1) return "#facc15";
  if (p === 2) return "#d1d5db";
  if (p === 3) return "#d97706";
  return "var(--muted-foreground)";
};

const rankBadgeStyle = (rank: number) => {
  if (rank === 1) return { background: "rgba(234,179,8,0.15)", color: "#fde047", border: "1px solid rgba(234,179,8,0.3)" };
  if (rank === 2) return { background: "rgba(209,213,219,0.15)", color: "#d1d5db", border: "1px solid rgba(209,213,219,0.3)" };
  if (rank === 3) return { background: "rgba(217,119,6,0.15)", color: "#d97706", border: "1px solid rgba(217,119,6,0.3)" };
  return { background: "rgba(212,150,58,0.15)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" };
};

const ROWS_PER_PAGE = 20;

const tooltipStyle = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--muted-foreground)" },
};

interface FormaData {
  forma: string[];
  avgKills: string | null;
  avgPts: string | null;
  last5: { placement: number; kills: number; points: number; date: string }[];
}

const FORMA_ICON: Record<string, string> = { win: '🥇', top3: '🟢', top5: '🟡', loss: '🔴' };
const FORMA_LABEL: Record<string, string> = { win: 'Victoire', top3: 'Top 3', top5: 'Top 5', loss: 'Défaite' };

export default function TeamPage({ teamName, onBack, onCompare }: { teamName: string; onBack: () => void; onCompare?: (name: string) => void }) {
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [histPage, setHistPage] = useState(1);
  const [forma, setForma] = useState<FormaData | null>(null);

  useEffect(() => {
    setLoading(true); setError(null); setHistPage(1); setForma(null);
    fetch(apiUrl(`/api/ranking/${encodeURIComponent(teamName)}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setDetail(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
    fetch(apiUrl(`/api/forma/${encodeURIComponent(teamName)}`))
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.success && setForma(d))
      .catch(() => {});
  }, [teamName]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement du profil…</div>;

  if (error || !detail) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="text-red-400 font-semibold">{error ?? "Équipe introuvable"}</p>
      <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>← Retour</button>
    </div>
  );

  const totalPages = Math.ceil((detail.matchHistory?.length ?? 0) / ROWS_PER_PAGE);
  const pagedHistory = (detail.matchHistory ?? []).slice((histPage - 1) * ROWS_PER_PAGE, histPage * ROWS_PER_PAGE);
  const rbs = rankBadgeStyle(detail.rank);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-start gap-4">
        <button onClick={onBack} className="mt-1 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>← Retour</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black truncate">{detail.team}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={rbs}>Rang #{detail.rank}</span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            {detail.matchCount} match{detail.matchCount !== 1 ? "s" : ""} joués
            {detail.winRate != null && <span className="ml-2">· {detail.winRate}% de victoires</span>}
          </p>
        </div>
        {onCompare && (
          <button onClick={() => onCompare(detail.team)} className="mt-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer shrink-0" style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#d8b4fe" }}>
            ⚔️ Comparer
          </button>
        )}
      </div>

      {detail.winRate != null && detail.matchCount > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
            <span>Taux de victoire</span>
            <span className="text-emerald-400 font-semibold">{detail.winRate}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(detail.winRate, 100)}%`, background: "linear-gradient(90deg, #059669, #34d399)" }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Points",      value: detail.points.toLocaleString("fr-FR"),                          color: "var(--primary)" },
          { label: "Kills",       value: detail.kills.toLocaleString("fr-FR"),                           color: "#f87171" },
          { label: "Victoires",   value: detail.wins,                                                    color: "#34d399" },
          { label: "Défaites",    value: detail.losses,                                                  color: "#f43f5e" },
          { label: "Place. moy.", value: detail.avgPlacement != null ? `#${detail.avgPlacement}` : "—", color: "#fbbf24" },
          { label: "Kills/match", value: detail.killsPerMatch != null ? detail.killsPerMatch : "—",     color: "#fb923c" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Forma récente */}
      {forma && forma.forma.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <h2 className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: "var(--muted-foreground)" }}>📈 Forme récente</h2>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {forma.forma.map((f, i) => {
              const match = forma.last5[i];
              return (
                <div key={i} className="flex flex-col items-center gap-1" title={match ? `Pl. ${match.placement} · ${match.kills} kills · ${match.points} pts` : ''}>
                  <span className="text-2xl">{FORMA_ICON[f] ?? '⬜'}</span>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{FORMA_LABEL[f]}</span>
                </div>
              );
            })}
            <div className="ml-auto flex flex-col gap-1 text-right text-xs" style={{ color: "var(--muted-foreground)" }}>
              {forma.avgKills && <span>Moy. kills : <span className="font-bold text-red-400">{forma.avgKills}</span></span>}
              {forma.avgPts  && <span>Moy. pts : <span className="font-bold" style={{ color: "var(--primary)" }}>{forma.avgPts}</span></span>}
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            🥇 Victoire &nbsp;·&nbsp; 🟢 Top 3 &nbsp;·&nbsp; 🟡 Top 5 &nbsp;·&nbsp; 🔴 Hors top 5
          </p>
        </div>
      )}

      {detail.timeline.length > 1 && (
        <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <h2 className="text-xs uppercase tracking-wider font-semibold mb-4" style={{ color: "var(--muted-foreground)" }}>📈 Évolution des points</h2>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={detail.timeline} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={fmtDateShort} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip {...tooltipStyle} labelFormatter={(v) => fmtDateShort(String(v))} formatter={(val: number, name: string) => {
                  if (name === "pts") return [`${val} pts`, "Total cumulé"];
                  if (name === "match_pts") return [`+${val} pts`, "Ce match"];
                  return [val, name];
                }} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.04)" />
                <Line type="monotone" dataKey="pts" stroke="oklch(0.7 0.18 55)" strokeWidth={2.5} dot={detail.timeline.length < 30 ? { r: 3, fill: "oklch(0.7 0.18 55)" } : false} activeDot={{ r: 5 }} name="pts" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="font-bold text-sm">Historique complet</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{detail.matchHistory?.length ?? 0} match{(detail.matchHistory?.length ?? 0) !== 1 ? "s" : ""}</p>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <button onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1} className="px-2 py-1 rounded transition-colors cursor-pointer disabled:opacity-30" style={{ background: "var(--muted)" }}>‹</button>
              <span>{histPage} / {totalPages}</span>
              <button onClick={() => setHistPage(p => Math.min(totalPages, p + 1))} disabled={histPage === totalPages} className="px-2 py-1 rounded transition-colors cursor-pointer disabled:opacity-30" style={{ background: "var(--muted)" }}>›</button>
            </div>
          )}
        </div>

        {pagedHistory.length === 0 ? (
          <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
            <div className="text-4xl mb-3">📋</div>
            <p>Aucun match enregistré pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                  <th className="py-2 px-4 text-left">Date</th>
                  <th className="py-2 px-4 text-center">Place</th>
                  <th className="py-2 px-4 text-center">Points</th>
                  <th className="py-2 px-4 text-center">Kills</th>
                  <th className="py-2 px-4 text-left hidden sm:table-cell">Tournoi</th>
                  <th className="py-2 px-4 text-left hidden sm:table-cell">Ajouté par</th>
                </tr>
              </thead>
              <tbody>
                {pagedHistory.map((m, i) => (
                  <tr key={String(m.matchId)} className="transition-colors" style={{ borderBottom: "1px solid var(--border)", background: i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent")}
                  >
                    <td className="py-3 px-4 text-xs whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>{fmtDate(m.date)}</td>
                    <td className="py-3 px-4 text-center font-bold" style={{ color: placementColor(m.placement) }}>{m.placement > 0 ? (MEDAL[m.placement] ?? `#${m.placement}`) : "—"}</td>
                    <td className="py-3 px-4 text-center font-bold" style={{ color: "var(--primary)" }}>+{m.points}</td>
                    <td className="py-3 px-4 text-center text-red-400 font-semibold">{m.kills}</td>
                    <td className="py-3 px-4 text-xs hidden sm:table-cell" style={{ color: "var(--muted-foreground)" }}>{m.tournamentName ?? "—"}</td>
                    <td className="py-3 px-4 text-xs hidden sm:table-cell" style={{ color: "oklch(0.4 0 0)" }}>{m.addedBy ?? "—"}</td>
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
