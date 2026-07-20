import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface XpEntry {
  _id: string;
  guildId: string;
  userId: string;
  username: string;
  xp: number;
  level: number;
  lastXpAt?: string;
}

function xpForNextLevel(level: number) {
  return (level + 1) * (level + 1) * 100;
}
function xpForLevel(level: number) {
  return level * level * 100;
}
function progressPct(xp: number, level: number) {
  const base = xpForLevel(level);
  const next = xpForNextLevel(level);
  return Math.min(100, Math.round(((xp - base) / (next - base)) * 100));
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const LEVEL_COLORS = [
  { min: 0,  color: "#94a3b8", label: "Recrue" },
  { min: 5,  color: "#34d399", label: "Actif" },
  { min: 10, color: "#60a5fa", label: "Expérimenté" },
  { min: 20, color: "#c084fc", label: "Vétéran" },
  { min: 30, color: "var(--primary)", label: "Légende" },
];
function levelColor(level: number) {
  for (let i = LEVEL_COLORS.length - 1; i >= 0; i--) {
    if (level >= LEVEL_COLORS[i].min) return LEVEL_COLORS[i].color;
  }
  return "#94a3b8";
}
function levelLabel(level: number) {
  for (let i = LEVEL_COLORS.length - 1; i >= 0; i--) {
    if (level >= LEVEL_COLORS[i].min) return LEVEL_COLORS[i].label;
  }
  return "Recrue";
}

export default function NiveauxPage() {
  const [entries, setEntries] = useState<XpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/niveaux"))
      .then(r => r.json())
      .then(d => { setEntries(d.entries ?? []); setLoading(false); })
      .catch(() => { setError("Impossible de charger le classement XP."); setLoading(false); });
  }, []);

  const filtered = entries.filter(e =>
    !search.trim() || e.username.toLowerCase().includes(search.toLowerCase())
  );

  const totalPlayers = entries.length;
  const maxLevel = entries.length ? Math.max(...entries.map(e => e.level)) : 0;
  const totalXp = entries.reduce((s, e) => s + e.xp, 0);
  const avgLevel = entries.length ? (entries.reduce((s, e) => s + e.level, 0) / entries.length).toFixed(1) : "0";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-bold text-lg">📈 Niveaux & XP</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Classement d'expérience des membres du serveur
        </p>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Joueurs", value: totalPlayers, color: "var(--primary)", icon: "👤" },
            { label: "Niveau max", value: maxLevel, color: "#facc15", icon: "⭐" },
            { label: "XP total", value: totalXp.toLocaleString("fr-FR"), color: "#fb923c", icon: "⚡" },
            { label: "Niveau moy.", value: avgLevel, color: "#34d399", icon: "📊" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      {!loading && !error && (
        <div className="flex flex-wrap gap-2 mb-5">
          {LEVEL_COLORS.map(l => (
            <span key={l.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: l.color }}>
              <span className="size-2 rounded-full inline-block" style={{ background: l.color }} />
              Niv.{l.min}+ {l.label}
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Rechercher un joueur…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : error ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">📈</div>
          <p className="text-sm">Aucun joueur trouvé.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {/* Table header */}
          <div className="grid text-xs uppercase tracking-wider font-semibold px-5 py-3"
            style={{ gridTemplateColumns: "40px 1fr 80px 100px 120px", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            <span className="text-center">#</span>
            <span>Joueur</span>
            <span className="text-center">Niveau</span>
            <span className="text-right">XP</span>
            <span className="text-right hidden sm:block">Dernière activité</span>
          </div>

          {filtered.map((entry, i) => {
            const rank = entries.findIndex(e => e._id === entry._id) + 1;
            const pct = progressPct(entry.xp, entry.level);
            const color = levelColor(entry.level);
            const label = levelLabel(entry.level);
            return (
              <div
                key={entry._id}
                className="grid items-center px-5 py-3 gap-2"
                style={{
                  gridTemplateColumns: "40px 1fr 80px 100px 120px",
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                  background: rank <= 3 ? "rgba(212,150,58,0.04)" : "transparent",
                }}
              >
                {/* Rank */}
                <div className="text-center font-bold text-sm" style={{ color: rank <= 3 ? "#facc15" : "var(--muted-foreground)" }}>
                  {rank <= 3 ? ["🥇","🥈","🥉"][rank - 1] : rank}
                </div>

                {/* Player info + progress */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm truncate">{entry.username}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                      {label}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {pct}% vers niv.{entry.level + 1} · manque {(xpForNextLevel(entry.level) - entry.xp).toLocaleString("fr-FR")} XP
                  </div>
                </div>

                {/* Level */}
                <div className="text-center font-black text-lg" style={{ color }}>{entry.level}</div>

                {/* XP */}
                <div className="text-right font-semibold text-sm" style={{ color: "#fb923c" }}>
                  {entry.xp.toLocaleString("fr-FR")}
                </div>

                {/* Last active */}
                <div className="text-right text-xs hidden sm:block" style={{ color: "var(--muted-foreground)" }}>
                  {entry.lastXpAt ? fmtDate(entry.lastXpAt) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
