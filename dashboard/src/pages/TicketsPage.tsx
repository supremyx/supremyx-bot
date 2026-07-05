import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Ticket {
  _id: string;
  channelId: string;
  userId: string;
  userTag: string;
  subject: string;
  category: string;
  status: string;
  claimedBy: string | null;
  claimedByTag: string | null;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TicketStats { open: number; closed: number; claimed: number; }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtAge(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const h  = Math.floor(ms / 3600000);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  open:     { bg: "rgba(34,197,94,0.15)",   text: "#4ade80", border: "rgba(34,197,94,0.3)",   label: "🟢 Ouvert" },
  pending:  { bg: "rgba(250,204,21,0.15)",  text: "#fde047", border: "rgba(250,204,21,0.3)",  label: "⏳ En attente" },
  closed:   { bg: "rgba(100,116,139,0.15)", text: "#94a3b8", border: "rgba(100,116,139,0.3)", label: "🔒 Fermé" },
};

function StatusBadge({ closed, status }: { closed: boolean; status: string }) {
  const key = closed ? "closed" : (STATUS_STYLE[status] ? status : "open");
  const s = STATUS_STYLE[key] ?? STATUS_STYLE.open;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

export default function TicketsPage() {
  const [tickets, setTickets]  = useState<Ticket[]>([]);
  const [stats, setStats]      = useState<TicketStats | null>(null);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState<string | null>(null);
  const [filter, setFilter]    = useState<"all" | "open" | "closed">("open");
  const [search, setSearch]    = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(apiUrl("/api/tickets?limit=100"))
      .then(async r => {
        if (!r.ok) throw new Error(`Le serveur a répondu avec une erreur (${r.status}).`);
        return r.json();
      })
      .then(d => { setTickets(d.tickets ?? []); setStats(d.stats ?? null); setLoading(false); })
      .catch((e: Error) => {
        setError(e.message?.startsWith("Le serveur") ? e.message : "Impossible de contacter le serveur. Vérifie ta connexion et réessaie.");
        setLoading(false);
      });
  }, [reloadKey]);

  const filtered = tickets
    .filter(t => {
      if (filter === "open")   return !t.closed;
      if (filter === "closed") return t.closed;
      return true;
    })
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return t.userTag?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q);
    });

  if (loading) return <div className="py-24 text-center text-sm animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement des tickets…</div>;
  if (error) return (
    <div className="py-24 flex flex-col items-center gap-3 text-center px-4">
      <span className="text-3xl">⚠️</span>
      <p className="text-sm text-red-400 max-w-sm">{error}</p>
      <button
        onClick={() => setReloadKey(k => k + 1)}
        className="px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        Réessayer
      </button>
    </div>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">🎫 Tickets de support</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>{tickets.length} ticket(s) au total</p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Ouverts",  value: stats.open,    color: "#4ade80" },
            { label: "Fermés",   value: stats.closed,  color: "#94a3b8" },
            { label: "En cours", value: stats.claimed, color: "#fbbf24" },
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
        {(["open", "closed", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            style={{
              background: filter === f ? "var(--primary)" : "var(--muted)",
              color:      filter === f ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {f === "open" ? "Ouverts" : f === "closed" ? "Fermés" : "Tous"}
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
        <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>Aucun ticket dans cette catégorie.</div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                {["Statut", "Utilisateur", "Sujet", "Catégorie", "Âge", "Staff"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t._id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3"><StatusBadge closed={t.closed} status={t.status} /></td>
                  <td className="px-4 py-3 font-medium">{t.userTag}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{t.subject || "—"}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs" style={{ background: "var(--muted)" }}>{t.category || "—"}</span></td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{fmtAge(t.createdAt)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{t.claimedByTag ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
