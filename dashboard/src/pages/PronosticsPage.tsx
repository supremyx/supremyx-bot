import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Pronostic {
  _id: string;
  username: string;
  team1: string;
  team2: string;
  prediction: string;
  correct: boolean | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface PronosticStats {
  total: number;
  resolved: number;
  correct: number;
}

interface PronosticData {
  pronostics: Pronostic[];
  stats: PronosticStats;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function StatusBadge({ correct }: { correct: boolean | null }) {
  if (correct === null)
    return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(148,163,184,0.15)", color: "var(--muted-foreground)" }}>⏳ En attente</span>;
  if (correct)
    return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>✅ Correct</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>❌ Raté</span>;
}

export default function PronosticsPage() {
  const [data, setData] = useState<PronosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "correct" | "wrong">("all");

  useEffect(() => {
    fetch(apiUrl("/api/pronostics?limit=100"))
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const pronostics = data?.pronostics ?? [];
  const stats = data?.stats ?? { total: 0, resolved: 0, correct: 0 };
  const accuracy = stats.resolved > 0 ? Math.round((stats.correct / stats.resolved) * 100) : 0;

  const filtered = pronostics.filter(p => {
    if (filter === "pending") return p.correct === null;
    if (filter === "correct") return p.correct === true;
    if (filter === "wrong") return p.correct === false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black" style={{ color: "var(--foreground)" }}>🔮 Pronostics</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Prédictions de la communauté sur les matchs à venir</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total", value: stats.total, color: "var(--primary)" },
              { label: "Résolus", value: stats.resolved, color: "#3b82f6" },
              { label: "Corrects", value: stats.correct, color: "#22c55e" },
              { label: "Précision", value: `${accuracy}%`, color: "#f59e0b" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 flex flex-col gap-1" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "correct", "wrong"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
                style={{
                  background: filter === f ? "var(--primary)" : "var(--card)",
                  color: filter === f ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                {{ all: "Tous", pending: "⏳ En attente", correct: "✅ Corrects", wrong: "❌ Ratés" }[f]}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: "var(--muted-foreground)" }}>Aucun pronostic trouvé.</div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(212,150,58,0.05)" }}>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>Joueur</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>Match</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>Prédiction</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>Résultat</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p._id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <td className="px-4 py-3 font-medium">{p.username}</td>
                      <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>
                        <span className="font-semibold" style={{ color: "var(--foreground)" }}>{p.team1}</span>
                        <span className="mx-1">vs</span>
                        <span className="font-semibold" style={{ color: "var(--foreground)" }}>{p.team2}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "rgba(212,150,58,0.15)", color: "var(--primary)" }}>
                          {p.prediction}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge correct={p.correct} /></td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
