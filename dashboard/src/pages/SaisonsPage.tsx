import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface SeasonSnapshot {
  rank: number;
  name: string;
  points: number;
  kills: number;
  wins: number;
  losses: number;
}

interface Season {
  _id: string;
  name: string;
  active: boolean;
  startedBy: string;
  endedBy: string;
  endedAt: string | null;
  createdAt: string;
  snapshot: SeasonSnapshot[];
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function SaisonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Season | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/seasons"))
      .then(r => r.json())
      .then(d => { setSeasons(d.seasons ?? []); setLoading(false); })
      .catch(() => { setError("Impossible de charger les saisons."); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="text-center py-16 animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
    </div>
  );

  if (error) return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="text-3xl mb-2">⚠️</div>
        <p className="text-red-400 font-semibold">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h2 className="font-bold text-lg">🗓️ Saisons</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          {seasons.length} saison{seasons.length !== 1 ? "s" : ""} enregistrée{seasons.length !== 1 ? "s" : ""}
        </p>
      </div>

      {seasons.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">🗓️</div>
          <p className="text-sm">Aucune saison enregistrée.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {seasons.map(s => (
            <div key={s._id} className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: `1px solid ${s.active ? "rgba(52,211,153,0.3)" : "var(--border)"}` }}>
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer"
                style={{ borderBottom: selected?._id === s._id ? "1px solid var(--border)" : "none" }}
                onClick={() => setSelected(selected?._id === s._id ? null : s)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏁</span>
                  <div>
                    <h3 className="font-bold text-sm">{s.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      Débutée le {fmtDate(s.createdAt)}
                      {s.endedAt ? ` · Terminée le ${fmtDate(s.endedAt)}` : ""}
                      {s.startedBy ? ` · par ${s.startedBy}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{
                    background: s.active ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.05)",
                    color: s.active ? "#34d399" : "var(--muted-foreground)",
                    border: `1px solid ${s.active ? "rgba(52,211,153,0.3)" : "var(--border)"}`
                  }}>
                    {s.active ? "🟢 En cours" : "🔴 Terminée"}
                  </span>
                  {s.snapshot.length > 0 && (
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                      {s.snapshot.length} équipes
                    </span>
                  )}
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {selected?._id === s._id ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {selected?._id === s._id && s.snapshot.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                        <th className="py-2 px-4 text-center">#</th>
                        <th className="py-2 px-4 text-left">Équipe</th>
                        <th className="py-2 px-4 text-center">Points</th>
                        <th className="py-2 px-4 text-center">Kills</th>
                        <th className="py-2 px-4 text-center">V</th>
                        <th className="py-2 px-4 text-center">D</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.snapshot.sort((a, b) => a.rank - b.rank).map(t => (
                        <tr key={t.name} style={{ borderBottom: "1px solid var(--border)", background: t.rank <= 3 ? "rgba(212,150,58,0.04)" : "transparent" }}>
                          <td className="py-2 px-4 text-center font-bold text-sm" style={{ color: t.rank === 1 ? "#facc15" : t.rank === 2 ? "#d1d5db" : t.rank === 3 ? "#d97706" : "var(--muted-foreground)" }}>
                            {t.rank === 1 ? "🥇" : t.rank === 2 ? "🥈" : t.rank === 3 ? "🥉" : `#${t.rank}`}
                          </td>
                          <td className="py-2 px-4 font-semibold text-sm">{t.name}</td>
                          <td className="py-2 px-4 text-center text-sm font-bold" style={{ color: "var(--primary)" }}>{t.points.toLocaleString("fr-FR")}</td>
                          <td className="py-2 px-4 text-center text-sm text-red-400">{t.kills.toLocaleString("fr-FR")}</td>
                          <td className="py-2 px-4 text-center text-sm text-emerald-400">{t.wins}</td>
                          <td className="py-2 px-4 text-center text-sm text-rose-400">{t.losses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selected?._id === s._id && s.snapshot.length === 0 && (
                <div className="px-5 py-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Aucun classement archivé pour cette saison.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
