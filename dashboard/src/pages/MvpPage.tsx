import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface MVP {
  _id: string;
  guildId: string;
  matchId?: string;
  displayName: string;
  teamName?: string;
  kills: number;
  tournamentName?: string;
  awardedBy?: string;
  awardedAt?: string;
  createdAt?: string;
}

function fmtDate(d: string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MvpPage() {
  const [mvps, setMvps] = useState<MVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTournoi, setFilterTournoi] = useState("all");

  useEffect(() => {
    fetch(apiUrl("/api/mvps"))
      .then(r => r.json())
      .then(d => {
        // API returns array directly or { mvps: [] }
        const list = Array.isArray(d) ? d : (d.mvps ?? []);
        setMvps(list);
        setLoading(false);
      })
      .catch(() => { setError("Impossible de charger les MVPs."); setLoading(false); });
  }, []);

  const tournaments = [...new Set(mvps.map(m => m.tournamentName).filter(Boolean))];

  const filtered = mvps.filter(m => {
    if (filterTournoi !== "all" && m.tournamentName !== filterTournoi) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return m.displayName.toLowerCase().includes(q) ||
        (m.teamName?.toLowerCase().includes(q) ?? false) ||
        (m.tournamentName?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  // Aggregate: total MVPs per player
  const playerStats = Object.values(
    mvps.reduce((acc, m) => {
      if (!acc[m.displayName]) acc[m.displayName] = { name: m.displayName, team: m.teamName, count: 0, totalKills: 0 };
      acc[m.displayName].count++;
      acc[m.displayName].totalKills += m.kills ?? 0;
      return acc;
    }, {} as Record<string, { name: string; team?: string; count: number; totalKills: number }>)
  ).sort((a, b) => b.count - a.count).slice(0, 3);

  const totalKills = mvps.reduce((s, m) => s + (m.kills ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-bold text-lg">🏅 MVPs</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Meilleurs joueurs récompensés à l'issue des matchs
        </p>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total MVPs",    value: mvps.length, color: "var(--primary)", icon: "🏅" },
            { label: "Kills totaux",  value: totalKills.toLocaleString("fr-FR"), color: "#f87171", icon: "💀" },
            { label: "Tournois",      value: tournaments.length, color: "#fb923c", icon: "🎮" },
            { label: "Top MVP", value: playerStats[0]?.name ?? "—", color: "#facc15", icon: "👑" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="text-base font-black truncate px-1" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Podium top MVPs */}
      {!loading && !error && playerStats.length >= 1 && (
        <div className="mb-8">
          <h3 className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: "var(--muted-foreground)" }}>
            🏆 Classement global MVPs
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {playerStats.map((p, i) => (
              <div key={p.name} className="rounded-xl p-4 text-center"
                style={{
                  background: "var(--card)",
                  border: `1px solid ${i === 0 ? "rgba(250,204,21,0.4)" : i === 1 ? "rgba(209,213,219,0.3)" : "rgba(217,119,6,0.3)"}`,
                }}>
                <div className="text-2xl mb-2">{["🥇","🥈","🥉"][i]}</div>
                <div className="font-bold text-sm truncate">{p.name}</div>
                {p.team && <div className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{p.team}</div>}
                <div className="mt-2 flex items-center justify-center gap-3 text-xs">
                  <span style={{ color: "var(--primary)" }}>{p.count} MVP{p.count > 1 ? "s" : ""}</span>
                  <span className="text-red-400">{p.totalKills} kills</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Tournament filter */}
        {tournaments.length > 0 && (
          <select
            value={filterTournoi}
            onChange={e => setFilterTournoi(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm cursor-pointer focus:outline-none"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            <option value="all">🎮 Tous les tournois</option>
            {tournaments.map(t => <option key={t} value={t!}>{t}</option>)}
          </select>
        )}
        <input
          type="text"
          placeholder="Rechercher joueur, équipe…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-40 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : error ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">🏅</div>
          <p className="text-sm">Aucun MVP trouvé.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {/* Table header */}
          <div className="grid text-xs uppercase tracking-wider font-semibold px-5 py-3"
            style={{ gridTemplateColumns: "40px 1fr 80px 80px 1fr 100px", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            <span className="text-center">#</span>
            <span>Joueur</span>
            <span className="text-center">Kills</span>
            <span className="text-center hidden sm:block">Équipe</span>
            <span className="hidden sm:block">Tournoi</span>
            <span className="text-right hidden md:block">Date</span>
          </div>
          {filtered.map((m, i) => (
            <div
              key={m._id}
              className="grid items-center px-5 py-3 gap-2"
              style={{
                gridTemplateColumns: "40px 1fr 80px 80px 1fr 100px",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                background: i === 0 ? "rgba(250,204,21,0.04)" : "transparent",
              }}
            >
              <div className="text-center text-sm font-bold" style={{ color: i < 3 ? "#facc15" : "var(--muted-foreground)" }}>
                {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
              </div>
              <div className="font-semibold text-sm truncate">{m.displayName}</div>
              <div className="text-center font-black text-red-400">{m.kills ?? 0}</div>
              <div className="text-center text-xs truncate hidden sm:block" style={{ color: "var(--primary)" }}>{m.teamName ?? "—"}</div>
              <div className="text-xs truncate hidden sm:block" style={{ color: "var(--muted-foreground)" }}>{m.tournamentName ?? "—"}</div>
              <div className="text-right text-xs hidden md:block" style={{ color: "var(--muted-foreground)" }}>{fmtDate(m.awardedAt ?? m.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
