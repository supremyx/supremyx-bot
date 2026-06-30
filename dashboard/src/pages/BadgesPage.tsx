import { useState, useEffect } from "react";
import { apiUrl } from "../lib/api";

interface Badge {
  _id: string;
  displayName: string;
  teamName: string;
  badgeName: string;
  emoji: string;
  description: string;
  awardedBy: string;
  awardedAt: string;
}

export default function BadgesPage() {
  const [badges, setBadges]   = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState<"all" | "player" | "type">("all");

  useEffect(() => {
    fetch(apiUrl("/api/badges"))
      .then(r => r.json())
      .then(d => { setBadges(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setError("Impossible de charger les badges"); setLoading(false); });
  }, []);

  const filtered = badges.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.displayName.toLowerCase().includes(q) ||
           b.badgeName.toLowerCase().includes(q) ||
           b.teamName.toLowerCase().includes(q);
  });

  // Group by badge type
  const grouped: Record<string, Badge[]> = {};
  for (const b of filtered) {
    if (!grouped[b.badgeName]) grouped[b.badgeName] = [];
    grouped[b.badgeName].push(b);
  }

  // Group by player
  const byPlayer: Record<string, Badge[]> = {};
  for (const b of filtered) {
    if (!byPlayer[b.displayName]) byPlayer[b.displayName] = [];
    byPlayer[b.displayName].push(b);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">🎖️ Badges</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            {badges.length} badge(s) distribué(s) · {Object.keys(grouped).length} type(s)
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }}
          />
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as "all" | "player" | "type")}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }}
          >
            <option value="type">Par type</option>
            <option value="player">Par joueur</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center">
          <div className="animate-pulse text-4xl mb-3">🎖️</div>
          <p style={{ color: "var(--muted-foreground)" }}>Chargement des badges…</p>
        </div>
      )}

      {error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      )}

      {!loading && !error && badges.length === 0 && (
        <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-4xl mb-3">📭</div>
          <p>Aucun badge distribué pour le moment.</p>
          <p className="text-sm mt-2">Utilise <code className="px-1 rounded" style={{ background: "var(--muted)" }}>!badge donner @membre 🏅 NomDuBadge</code> sur Discord</p>
        </div>
      )}

      {/* By type */}
      {!loading && !error && badges.length > 0 && filter === "type" && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([badgeName, list]) => {
            const first = list[0];
            return (
              <div key={badgeName} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-2xl">{first.emoji}</span>
                  <div>
                    <h3 className="font-bold">{badgeName}</h3>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{first.description || "Pas de description"} · {list.length} joueur(s)</p>
                  </div>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {list.map(b => (
                    <div key={b._id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                      style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                      <span className="font-semibold">{b.displayName}</span>
                      {b.teamName && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>· {b.teamName}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* By player */}
      {!loading && !error && badges.length > 0 && filter === "player" && (
        <div className="space-y-3">
          {Object.entries(byPlayer).sort((a, b) => b[1].length - a[1].length).map(([player, pBadges]) => (
            <div key={player} className="rounded-xl p-4 flex items-start gap-4"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                style={{ background: "var(--primary)22", color: "var(--primary)", border: "1px solid var(--primary)44" }}>
                {player[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold">{player}</span>
                  {pBadges[0].teamName && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                      {pBadges[0].teamName}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {pBadges.map(b => (
                    <span key={b._id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ background: "var(--primary)15", color: "var(--primary)", border: "1px solid var(--primary)33" }}>
                      {b.emoji} {b.badgeName}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>{pBadges.length}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
