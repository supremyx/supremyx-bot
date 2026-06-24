import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Dispo {
  _id: string;
  username: string;
  teamName: string | null;
  scheduleId: string | null;
  status: "oui" | "non" | "incertain";
  raison: string;
  createdAt: string;
}

interface DispoData {
  dispos: Dispo[];
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_CONFIG = {
  oui:      { label: "Disponible",   color: "#22c55e", bg: "rgba(34,197,94,0.12)",   emoji: "✅" },
  non:      { label: "Indisponible", color: "#ef4444", bg: "rgba(239,68,68,0.12)",   emoji: "❌" },
  incertain:{ label: "Incertain",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)", emoji: "⚠️" },
};

export default function DisponibilitesPage() {
  const [data, setData] = useState<DispoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "oui" | "non" | "incertain">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/dispos"))
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const dispos = data?.dispos ?? [];
  const counts = {
    oui: dispos.filter(d => d.status === "oui").length,
    non: dispos.filter(d => d.status === "non").length,
    incertain: dispos.filter(d => d.status === "incertain").length,
  };

  const filtered = dispos.filter(d => {
    if (filter !== "all" && d.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.username.toLowerCase().includes(q) || (d.teamName ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black" style={{ color: "var(--foreground)" }}>📋 Disponibilités</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Disponibilités des joueurs pour les prochains matchs</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(["oui", "non", "incertain"] as const).map(s => {
              const cfg = STATUS_CONFIG[s];
              return (
                <div key={s} className="rounded-xl p-4 flex flex-col gap-1 cursor-pointer transition-all"
                  style={{ border: `1px solid ${filter === s ? cfg.color : "var(--border)"}`, background: filter === s ? cfg.bg : "var(--card)" }}
                  onClick={() => setFilter(filter === s ? "all" : s)}>
                  <div className="text-2xl font-black" style={{ color: cfg.color }}>{counts[s]}</div>
                  <div className="text-xs font-semibold flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                    <span>{cfg.emoji}</span>{cfg.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Chercher un joueur ou une équipe…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="text-xs px-3 py-2 rounded-lg"
                style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                Réinitialiser
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: "var(--muted-foreground)" }}>Aucune disponibilité trouvée.</div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(212,150,58,0.05)" }}>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>Joueur</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>Équipe</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>Statut</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>Raison</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs" style={{ color: "var(--muted-foreground)" }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => {
                    const cfg = STATUS_CONFIG[d.status];
                    return (
                      <tr key={d._id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <td className="px-4 py-3 font-medium">{d.username}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{d.teamName ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.emoji} {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{d.raison || "—"}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{fmtDate(d.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
