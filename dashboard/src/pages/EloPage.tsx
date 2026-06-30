import { useState, useEffect } from "react";
import { apiUrl } from "../lib/api";

interface EloEntry {
  name: string;
  elo: number;
  matches: number;
  trend: number;
}

export default function EloPage() {
  const [data, setData]       = useState<EloEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/elo"))
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger le classement ELO"); setLoading(false); });
  }, []);

  const grade = (elo: number) =>
    elo >= 1200 ? { label: "S · Élite", color: "#fbbf24" } :
    elo >= 1100 ? { label: "A · Excellent", color: "#34d399" } :
    elo >= 1000 ? { label: "B · Bon", color: "#60a5fa" } :
    elo >= 900  ? { label: "C · Moyen", color: "#a78bfa" } :
    { label: "D · En difficulté", color: "#f87171" };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">📊 Classement ELO</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Score calculé depuis les placements et kills · Base 1000 · Tendance sur 5 derniers matchs
        </p>
      </div>

      {loading && (
        <div className="py-16 text-center">
          <div className="animate-spin text-4xl mb-3">⚙️</div>
          <p style={{ color: "var(--muted-foreground)" }}>Calcul des scores ELO…</p>
        </div>
      )}

      {error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-4xl mb-3">📭</div>
          <p>Aucune équipe avec des matchs enregistrés.</p>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <>
          {/* Top 3 podium */}
          {data.length >= 3 && (
            <div className="grid gap-4 sm:grid-cols-3 mb-8">
              {data.slice(0, 3).map((e, i) => {
                const g = grade(e.elo);
                const podiumColors = ["rgba(250,204,21,0.15)", "rgba(209,213,219,0.1)", "rgba(217,119,6,0.1)"];
                const borderColors = ["rgba(250,204,21,0.4)", "rgba(209,213,219,0.3)", "rgba(217,119,6,0.3)"];
                return (
                  <div key={e.name} className="rounded-xl p-5 text-center"
                    style={{ background: podiumColors[i], border: `1px solid ${borderColors[i]}` }}>
                    <div className="text-3xl mb-2">{["🥇","🥈","🥉"][i]}</div>
                    <h3 className="font-bold text-base">{e.name}</h3>
                    <p className="text-3xl font-bold mt-1" style={{ color: "var(--primary)" }}>{e.elo}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>ELO</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: g.color + "22", color: g.color, border: `1px solid ${g.color}44` }}>
                      {g.label}
                    </span>
                    <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>{e.matches} match(s)</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full table */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-bold">Classement complet</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                    <th className="py-3 px-4 text-center">#</th>
                    <th className="py-3 px-4 text-left">Équipe</th>
                    <th className="py-3 px-4 text-center">ELO</th>
                    <th className="py-3 px-4 text-center">Niveau</th>
                    <th className="py-3 px-4 text-center">Tendance</th>
                    <th className="py-3 px-4 text-center">Matchs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((e, i) => {
                    const g = grade(e.elo);
                    const trendIcon = e.trend > 10 ? "📈" : e.trend < -10 ? "📉" : "➡️";
                    const trendStr  = e.trend > 0 ? `+${e.trend}` : `${e.trend}`;
                    const rowBg = i < 3
                      ? ["rgba(250,204,21,0.04)", "rgba(209,213,219,0.03)", "rgba(217,119,6,0.03)"][i]
                      : "transparent";
                    return (
                      <tr key={e.name} style={{ borderBottom: "1px solid var(--border)", background: rowBg }}>
                        <td className="py-3 px-4 text-center font-bold" style={{ color: "var(--muted-foreground)" }}>
                          {i < 3 ? ["🥇","🥈","🥉"][i] : `#${i + 1}`}
                        </td>
                        <td className="py-3 px-4 font-semibold">{e.name}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-base" style={{ color: "var(--primary)" }}>{e.elo}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: g.color + "22", color: g.color, border: `1px solid ${g.color}44` }}>
                            {g.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-sm" style={{ color: e.trend > 0 ? "#34d399" : e.trend < 0 ? "#f87171" : "var(--muted-foreground)" }}>
                          {trendIcon} {trendStr}
                        </td>
                        <td className="py-3 px-4 text-center" style={{ color: "var(--muted-foreground)" }}>{e.matches}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs mt-4 text-center" style={{ color: "var(--muted-foreground)" }}>
            Formule ELO Battle Royale · K=32 · Placement pondéré + bonus kills · Base 1000 · Tendance sur 5 derniers matchs
          </p>
        </>
      )}
    </div>
  );
}
