import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface NewsletterConfig {
  guildId: string;
  channelId?: string;
  active: boolean;
  lastSentAt?: string;
}

interface BilanEntry {
  _id: string;
  guildId?: string;
  content?: string;
  summary?: string;
  createdAt?: string;
  weekOf?: string;
}

function fmtDate(d: string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function nextSunday() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? 7 : 7 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  next.setHours(20, 0, 0, 0);
  return next.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" }) + " à 20h00";
}

export default function NewsletterPage() {
  const [config, setConfig] = useState<NewsletterConfig | null>(null);
  const [bilans, setBilans] = useState<BilanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/newsletter")).then(r => r.json()).catch(() => ({ config: null })),
      fetch(apiUrl("/api/ia/bilans")).then(r => r.json()).catch(() => ({ bilans: [] })),
    ]).then(([nlData, bilanData]) => {
      setConfig(nlData.config ?? null);
      setBilans(bilanData.bilans ?? bilanData ?? []);
      setLoading(false);
    }).catch(() => {
      setError("Impossible de charger les données.");
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-bold text-lg">📰 Newsletter & Bilans</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Configuration de la newsletter automatique et bilans hebdomadaires IA
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : error ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Config card */}
          <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-sm" style={{ color: "var(--primary)" }}>📬 Configuration Newsletter</h3>
              {config && (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{
                    background: config.active ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                    color: config.active ? "#34d399" : "#f87171",
                    border: `1px solid ${config.active ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                  }}>
                  {config.active ? "● Active" : "○ Inactive"}
                </span>
              )}
            </div>

            {!config ? (
              <div className="text-center py-8" style={{ color: "var(--muted-foreground)" }}>
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">Aucune configuration de newsletter trouvée.</p>
                <p className="text-xs mt-1">Utilisez <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--muted)" }}>!infolettre</code> sur Discord pour configurer.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Salon de diffusion</span>
                  <span className="font-semibold text-sm">
                    {config.channelId ? <code className="px-2 py-0.5 rounded text-xs" style={{ background: "var(--muted)" }}>#{config.channelId}</code> : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Statut</span>
                  <span className="font-semibold text-sm" style={{ color: config.active ? "#34d399" : "#f87171" }}>
                    {config.active ? "Active" : "Désactivée"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Dernier envoi</span>
                  <span className="text-sm">{fmtDate(config.lastSentAt)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Prochain envoi</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{nextSunday()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Schedule info */}
          <div className="rounded-xl p-5" style={{ background: "rgba(212,150,58,0.06)", border: "1px solid rgba(212,150,58,0.2)" }}>
            <h3 className="font-bold text-sm mb-3" style={{ color: "var(--primary)" }}>⏰ Envoi automatique</h3>
            <div className="space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
              <div className="flex items-start gap-2">
                <span>📨</span>
                <span>La newsletter est envoyée automatiquement <strong style={{ color: "var(--foreground)" }}>chaque dimanche à 20h00</strong> si elle est activée.</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🧠</span>
                <span>Le bilan IA hebdomadaire est publié <strong style={{ color: "var(--foreground)" }}>le dimanche à 20h30</strong>, résumant l'activité de la semaine.</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🔧</span>
                <span>Utilisez <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--muted)", color: "var(--foreground)" }}>!infolettre</code> sur Discord pour activer/désactiver et configurer le salon.</span>
              </div>
            </div>
          </div>

          {/* Recent bilans */}
          {bilans.length > 0 && (
            <div>
              <h3 className="font-bold text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>
                📋 Bilans IA récents ({bilans.length})
              </h3>
              <div className="space-y-3">
                {bilans.slice(0, 5).map((b, i) => (
                  <div key={b._id ?? i} className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
                        Bilan du {fmtDate(b.weekOf ?? b.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                      {b.summary ?? b.content ?? "Contenu non disponible."}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
