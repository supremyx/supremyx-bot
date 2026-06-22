import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "../lib/api";

interface ScheduledEmbedDoc {
  _id: string;
  guildId: string;
  channelId: string;
  title: string;
  description: string;
  color: number;
  scheduledAt: string;
  createdBy: string;
  sent: boolean;
  createdAt: string;
}

interface EmbedStats {
  pending: number;
  sentToday: number;
  sentWeek: number;
  next: string | null;
}

interface EmbedData {
  stats: EmbedStats;
  pending: ScheduledEmbedDoc[];
  history: ScheduledEmbedDoc[];
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeRelative(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  if (diff < 0) return "dépassé";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `dans ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `dans ${h}h`;
  const days = Math.floor(h / 24);
  return `dans ${days}j`;
}

function hexColor(n: number) {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function shortId(id: string) {
  return id.slice(-6);
}

export default function EmbedsProgrammesPage() {
  const [data, setData]       = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [tab, setTab]         = useState<"pending" | "history">("pending");

  const load = useCallback(() => {
    setLoading(true);
    fetch(apiUrl("/api/scheduled-embeds"))
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger les embeds programmés."); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function cancel(id: string) {
    if (!confirm(`Annuler l'embed programmé #${id} ?`)) return;
    setCanceling(id);
    try {
      const r = await fetch(apiUrl(`/api/scheduled-embeds/${id}`), { method: "DELETE" });
      if (r.ok) {
        setData(prev => prev ? {
          ...prev,
          stats: { ...prev.stats, pending: prev.stats.pending - 1 },
          pending: prev.pending.filter(d => d._id.slice(-6) !== id && d._id !== id),
        } : null);
      } else {
        alert("Erreur lors de l'annulation.");
      }
    } catch {
      alert("Erreur réseau.");
    }
    setCanceling(null);
  }

  const pending = data?.pending ?? [];
  const history = data?.history ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-bold text-lg">📨 Embeds Programmés</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Visualise, planifie et annule les embeds en attente de publication
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
        >
          ↻ Actualiser
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : error ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : data && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { icon: "⏳", label: "En attente",       value: data.stats.pending,  color: "#d4963a" },
              { icon: "📤", label: "Publiés aujourd'hui", value: data.stats.sentToday, color: "#57F287" },
              { icon: "📆", label: "Publiés cette semaine", value: data.stats.sentWeek, color: "#6366f1" },
              {
                icon: "🕐",
                label: "Prochain",
                value: data.stats.next ? timeRelative(data.stats.next) : "—",
                color: "#ec4899",
              },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="flex flex-col items-center gap-2 rounded-xl p-4 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <span className="text-xl">{icon}</span>
                <span className="text-xl font-bold" style={{ color }}>{value}</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Prochain embed */}
          {pending.length > 0 && (
            <div className="rounded-xl p-4 mb-8 flex items-center gap-4" style={{ border: "1px solid rgba(212,150,58,0.35)", background: "rgba(212,150,58,0.06)" }}>
              <div
                className="w-1 self-stretch rounded-full flex-shrink-0"
                style={{ background: hexColor(pending[0].color) }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold mb-0.5" style={{ color: "#d4963a" }}>⚡ Prochain embed à publier</p>
                <p className="text-sm font-bold truncate">{pending[0].title || "(sans titre)"}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>{pending[0].description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    📍 <span className="font-mono">#{shortId(pending[0]._id)}</span>
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    🕐 {fmtDate(pending[0].scheduledAt)} ({timeRelative(pending[0].scheduledAt)})
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    ✍️ {pending[0].createdBy}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: "var(--muted)" }}>
            {(["pending", "history"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                style={{
                  background: tab === t ? "var(--card)" : "transparent",
                  color: tab === t ? "var(--foreground)" : "var(--muted-foreground)",
                  border: tab === t ? "1px solid var(--border)" : "1px solid transparent",
                }}
              >
                {t === "pending" ? `⏳ En attente (${pending.length})` : `📜 Publiés (${history.length})`}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            {tab === "pending" && (
              pending.length === 0 ? (
                <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-sm">Aucun embed programmé en attente.</p>
                  <p className="text-xs mt-1">Utilise <code className="px-1 py-0.5 rounded" style={{ background: "var(--muted)" }}>!embed programmer</code> dans Discord.</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {pending.map(doc => {
                    const sid = shortId(doc._id);
                    return (
                      <div key={doc._id} className="px-5 py-4 flex items-center gap-4">
                        {/* Color bar */}
                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: hexColor(doc.color), minHeight: 40 }} />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold truncate">{doc.title || "(sans titre)"}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                              #{sid}
                            </span>
                          </div>
                          <p className="text-xs truncate mb-1" style={{ color: "var(--muted-foreground)" }}>{doc.description}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                              🕐 {fmtDate(doc.scheduledAt)}
                            </span>
                            <span className="text-[11px] font-semibold" style={{ color: "#d4963a" }}>
                              {timeRelative(doc.scheduledAt)}
                            </span>
                            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                              ✍️ {doc.createdBy}
                            </span>
                          </div>
                        </div>

                        {/* Cancel */}
                        <button
                          onClick={() => cancel(sid)}
                          disabled={canceling === sid}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
                        >
                          {canceling === sid ? "…" : "✕ Annuler"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {tab === "history" && (
              history.length === 0 ? (
                <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
                  <div className="text-4xl mb-3">📂</div>
                  <p className="text-sm">Aucun embed publié pour le moment.</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {history.map(doc => (
                    <div key={doc._id} className="px-5 py-4 flex items-center gap-4 opacity-70">
                      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: hexColor(doc.color), minHeight: 40 }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold truncate">{doc.title || "(sans titre)"}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                            #{shortId(doc._id)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(87,242,135,0.1)", color: "#57F287", border: "1px solid rgba(87,242,135,0.25)" }}>
                            ✓ Publié
                          </span>
                        </div>
                        <p className="text-xs truncate mb-1" style={{ color: "var(--muted-foreground)" }}>{doc.description}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                            📤 {fmtDate(doc.scheduledAt)}
                          </span>
                          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                            ✍️ {doc.createdBy}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Help footer */}
          <div className="mt-6 rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>📖 Commandes Discord</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { cmd: "!embed programmer #salon | Titre | Desc | couleur | YYYY-MM-DD HH:MM", desc: "Planifier un embed" },
                { cmd: "!embed programmes",                                                      desc: "Voir la liste" },
                { cmd: "!embed déprogrammer <id>",                                              desc: "Annuler un embed" },
              ].map(({ cmd, desc }) => (
                <div key={cmd} className="rounded-lg p-3" style={{ background: "var(--muted)" }}>
                  <code className="text-[10px] block truncate" style={{ color: "var(--foreground)" }}>{cmd}</code>
                  <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
