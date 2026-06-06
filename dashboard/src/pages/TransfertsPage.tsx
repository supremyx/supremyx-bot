import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Transfer {
  _id: string;
  playerName: string;
  userId: string;
  fromTeam: string;
  toTeam: string;
  reason: string;
  transferredBy: string;
  createdAt: string;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function TransfertsPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/transfers"))
      .then(r => r.json())
      .then(d => { setTransfers(d.transfers ?? []); setLoading(false); })
      .catch(() => { setError("Impossible de charger les transferts."); setLoading(false); });
  }, []);

  const filtered = transfers.filter(t =>
    !search || [t.playerName, t.fromTeam, t.toTeam].some(v => v.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">🔄 Historique des Transferts</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Tous les mouvements de joueurs entre équipes
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Rechercher un joueur ou une équipe…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-80 px-4 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-16 justify-center" style={{ color: "var(--muted-foreground)" }}>
          <span className="animate-spin text-2xl">⟳</span>
          <span>Chargement…</span>
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-4xl mb-3">📋</div>
          <p>{search ? "Aucun résultat pour cette recherche." : "Aucun transfert enregistré."}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            {filtered.length} transfert{filtered.length !== 1 ? "s" : ""}
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {filtered.map(t => (
              <div key={t._id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Player */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold">{t.playerName}</span>
                  </div>
                  {t.reason && (
                    <p className="text-xs mt-0.5 italic" style={{ color: "var(--muted-foreground)" }}>
                      {t.reason}
                    </p>
                  )}
                </div>

                {/* Transfer arrow */}
                <div className="flex items-center gap-3 text-sm font-semibold flex-wrap">
                  <span className="px-3 py-1 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                    📤 {t.fromTeam}
                  </span>
                  <span style={{ color: "var(--muted-foreground)" }}>→</span>
                  <span className="px-3 py-1 rounded-lg text-xs" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                    📥 {t.toTeam}
                  </span>
                </div>

                {/* Date & by */}
                <div className="text-right text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>
                  <div>{fmtDate(t.createdAt)}</div>
                  <div className="mt-0.5">par {t.transferredBy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
