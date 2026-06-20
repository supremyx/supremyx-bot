import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface GuildEvent {
  _id: string;
  guildId: string;
  eventNumber: number;
  title: string;
  description: string;
  date: string;
  channelId: string;
  createdBy: string;
  joined: string[];
  declined: string[];
  cancelled: boolean;
  createdAt: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ cancelled, date }: { cancelled: boolean; date: string }) {
  const isPast = new Date(date) < new Date();
  if (cancelled) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>Annulé</span>;
  if (isPast)    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(100,116,139,0.15)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.3)" }}>Terminé</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>À venir</span>;
}

export default function EventsPage() {
  const [events, setEvents]   = useState<GuildEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<"all" | "upcoming" | "past">("upcoming");

  useEffect(() => {
    fetch(apiUrl("/api/guild-events?limit=100"))
      .then(r => r.json())
      .then(d => { setEvents(d.events ?? []); setLoading(false); })
      .catch(() => { setError("Erreur de chargement"); setLoading(false); });
  }, []);

  const now = new Date();
  const filtered = events.filter(e => {
    const isPast = new Date(e.date) < now || e.cancelled;
    if (filter === "upcoming") return !isPast;
    if (filter === "past")     return isPast;
    return true;
  });

  if (loading) return <div className="py-24 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement des événements…</div>;
  if (error)   return <div className="py-24 text-center text-red-400">{error}</div>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">📅 Événements RSVP</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>{events.length} événement(s) trouvé(s)</p>

      {/* Filtres */}
      <div className="flex gap-2 mb-6">
        {(["upcoming", "all", "past"] as const).map(f => (
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
            {f === "upcoming" ? "À venir" : f === "past" ? "Passés" : "Tous"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>Aucun événement dans cette catégorie.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(event => (
            <div key={event._id} className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>#{event.eventNumber}</span>
                    <StatusBadge cancelled={event.cancelled} date={event.date} />
                  </div>
                  <h2 className="font-bold text-base">{event.title}</h2>
                </div>
                <div className="text-right text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <div>📅 {fmtDate(event.date)}</div>
                  <div className="mt-1">Créé par {event.createdBy}</div>
                </div>
              </div>

              {event.description && (
                <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>{event.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <div className="font-semibold text-emerald-400 mb-1">✅ Inscrits ({event.joined?.length ?? 0})</div>
                  {(event.joined?.length ?? 0) > 0
                    ? <div style={{ color: "var(--muted-foreground)" }}>{event.joined.length} participant(s)</div>
                    : <div style={{ color: "var(--muted-foreground)" }}>Aucun inscrit</div>
                  }
                </div>
                <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div className="font-semibold text-red-400 mb-1">❌ Déclinés ({event.declined?.length ?? 0})</div>
                  {(event.declined?.length ?? 0) > 0
                    ? <div style={{ color: "var(--muted-foreground)" }}>{event.declined.length} personne(s)</div>
                    : <div style={{ color: "var(--muted-foreground)" }}>Aucun déclin</div>
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
