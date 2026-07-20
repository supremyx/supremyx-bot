import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Absence {
  _id: string;
  guildId: string;
  userId: string;
  userTag?: string;
  teamName?: string;
  team?: string;
  raison?: string;
  reason?: string;
  until?: string;
  endAt?: string;
  active?: boolean;
  createdAt: string;
}

function fmtDate(d: string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function isActive(a: Absence) {
  if (typeof a.active === "boolean") return a.active;
  const until = a.until ?? a.endAt;
  if (!until) return true;
  return new Date(until) > new Date();
}

export default function AbsencesPage() {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "past">("all");

  useEffect(() => {
    fetch(apiUrl("/api/absences"))
      .then(r => r.json())
      .then(d => { setAbsences(d.absences ?? []); setLoading(false); })
      .catch(() => { setError("Impossible de charger les absences."); setLoading(false); });
  }, []);

  const activeCount = absences.filter(isActive).length;
  const teams = [...new Set(absences.map(a => a.teamName ?? a.team).filter(Boolean))];

  const filtered = absences.filter(a => {
    if (filterActive === "active" && !isActive(a)) return false;
    if (filterActive === "past"   &&  isActive(a)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = (a.userTag ?? a.userId ?? "").toLowerCase();
      const team = (a.teamName ?? a.team ?? "").toLowerCase();
      const reason = (a.raison ?? a.reason ?? "").toLowerCase();
      if (!name.includes(q) && !team.includes(q) && !reason.includes(q)) return false;
    }
    return true;
  });

  const FILTER_TABS: { key: typeof filterActive; label: string }[] = [
    { key: "all",    label: "Toutes" },
    { key: "active", label: "🔴 En cours" },
    { key: "past",   label: "✅ Passées" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-bold text-lg">📋 Absences</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Absences déclarées par les joueurs via le bot
        </p>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total",      value: absences.length, color: "var(--primary)", icon: "📋" },
            { label: "En cours",   value: activeCount,     color: "#f87171",        icon: "🔴" },
            { label: "Passées",    value: absences.length - activeCount, color: "#34d399", icon: "✅" },
            { label: "Équipes",    value: teams.length,    color: "#fb923c",        icon: "🛡️" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTER_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilterActive(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            style={{
              background: filterActive === t.key ? "var(--primary)" : "var(--muted)",
              color: filterActive === t.key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: `1px solid ${filterActive === t.key ? "var(--primary)" : "var(--border)"}`,
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Rechercher par joueur, équipe, raison…"
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
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm">Aucune absence trouvée.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {filtered.map((a, i) => {
            const active = isActive(a);
            const until = a.until ?? a.endAt;
            const team = a.teamName ?? a.team;
            const reason = a.raison ?? a.reason;
            const name = a.userTag ?? a.userId;
            return (
              <div
                key={a._id}
                className="px-5 py-4 flex items-start gap-3"
                style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <span className="text-lg mt-0.5 shrink-0">{active ? "🔴" : "✅"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm">{name}</span>
                    {team && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(212,150,58,0.15)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}>
                        {team}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${active ? "" : ""}`}
                      style={{
                        background: active ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.15)",
                        color: active ? "#f87171" : "#34d399",
                        border: `1px solid ${active ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`,
                      }}>
                      {active ? "En cours" : "Terminée"}
                    </span>
                  </div>
                  {reason && <p className="text-sm mb-1" style={{ color: "var(--foreground)" }}>{reason}</p>}
                  <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {until && <span>Jusqu'au {fmtDate(until)}</span>}
                    <span>Déclarée le {fmtDate(a.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
