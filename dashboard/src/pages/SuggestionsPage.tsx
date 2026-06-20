import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Suggestion {
  _id: string;
  guildId: string;
  authorId: string;
  authorTag: string;
  text: string;
  messageId: string;
  channelId: string;
  status: "pending" | "accepted" | "refused";
  staffNote: string;
  createdAt: string;
}

interface SuggestionStats { pending: number; accepted: number; refused: number; total: number; }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_STYLE = {
  pending:  { bg: "rgba(250,204,21,0.12)",  text: "#fde047", border: "rgba(250,204,21,0.3)",  label: "⏳ En attente", dot: "#fde047" },
  accepted: { bg: "rgba(34,197,94,0.12)",   text: "#4ade80", border: "rgba(34,197,94,0.3)",   label: "✅ Acceptée",   dot: "#4ade80" },
  refused:  { bg: "rgba(239,68,68,0.12)",   text: "#f87171", border: "rgba(239,68,68,0.3)",   label: "❌ Refusée",    dot: "#f87171" },
};

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats]             = useState<SuggestionStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [filter, setFilter]           = useState<"all" | "pending" | "accepted" | "refused">("all");
  const [search, setSearch]           = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/suggestions?limit=100"))
      .then(r => r.json())
      .then(d => { setSuggestions(d.suggestions ?? []); setStats(d.stats ?? null); setLoading(false); })
      .catch(() => { setError("Erreur de chargement"); setLoading(false); });
  }, []);

  const filtered = suggestions
    .filter(s => filter === "all" || s.status === filter)
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.text?.toLowerCase().includes(q) || s.authorTag?.toLowerCase().includes(q) || s.staffNote?.toLowerCase().includes(q);
    });

  if (loading) return <div className="py-24 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement des suggestions…</div>;
  if (error)   return <div className="py-24 text-center text-red-400">{error}</div>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">💡 Suggestions</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>{suggestions.length} suggestion(s) au total</p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total",      value: stats.total,    color: "var(--primary)" },
            { label: "En attente", value: stats.pending,  color: "#fde047" },
            { label: "Acceptées",  value: stats.accepted, color: "#4ade80" },
            { label: "Refusées",   value: stats.refused,  color: "#f87171" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-4 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <div className="text-2xl font-bold" style={{ color }}>{value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres + recherche */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "pending", "accepted", "refused"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            style={{
              background: filter === f ? "var(--primary)" : "var(--muted)",
              color:      filter === f ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {f === "all" ? "Toutes" : STATUS_STYLE[f].label}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="flex-1 min-w-32 px-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>Aucune suggestion trouvée.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(s => {
            const style = STATUS_STYLE[s.status] ?? STATUS_STYLE.pending;
            return (
              <div key={s._id} className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                      {style.label}
                    </span>
                    <span className="text-xs font-semibold">{s.authorTag}</span>
                  </div>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{fmtDate(s.createdAt)}</span>
                </div>

                <p className="text-sm mb-3 leading-relaxed">{s.text}</p>

                {s.staffNote && (
                  <div className="rounded-lg px-4 py-2 text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                    <span className="font-semibold" style={{ color: "var(--muted-foreground)" }}>📋 Note staff : </span>
                    {s.staffNote}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
