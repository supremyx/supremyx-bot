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

// ─── Couleurs preset ─────────────────────────────────────────────────────────
const COLOR_PRESETS = [
  { label: "Bleu",   hex: "#5865F2", num: 0x5865F2 },
  { label: "Or",     hex: "#d4963a", num: 0xd4963a },
  { label: "Vert",   hex: "#57F287", num: 0x57F287 },
  { label: "Rouge",  hex: "#ED4245", num: 0xED4245 },
  { label: "Violet", hex: "#9B59B6", num: 0x9B59B6 },
  { label: "Rose",   hex: "#FF73FA", num: 0xFF73FA },
  { label: "Cyan",   hex: "#1ABC9C", num: 0x1ABC9C },
  { label: "Gris",   hex: "#95A5A6", num: 0x95A5A6 },
];

function hexColor(n: number) {
  return `#${n.toString(16).padStart(6, "0")}`;
}
function numFromHex(h: string) {
  return parseInt(h.replace("#", ""), 16);
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
  return `dans ${Math.floor(h / 24)}j`;
}
function shortId(id: string) { return id.slice(-6); }

// ─── Default form state ───────────────────────────────────────────────────────
function todayLocal() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function defaultTime() {
  const d = new Date(Date.now() + 3_600_000);
  return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
}

const EMPTY_FORM = {
  channelId: "",
  title: "",
  description: "",
  colorHex: "#5865F2",
  date: todayLocal(),
  time: defaultTime(),
  createdBy: "Dashboard",
};

// ─── Embed preview ─────────────────────────────────────────────────────────────
function EmbedPreview({ title, description, colorHex }: { title: string; description: string; colorHex: string }) {
  return (
    <div className="rounded-lg overflow-hidden flex" style={{ background: "#36393f", border: "1px solid #202225" }}>
      <div className="w-1 flex-shrink-0" style={{ background: colorHex }} />
      <div className="px-3 py-3 flex-1 min-w-0">
        {title && (
          <p className="text-sm font-bold leading-snug mb-1" style={{ color: "#ffffff" }}>
            {title}
          </p>
        )}
        <p className="text-xs whitespace-pre-wrap break-words leading-relaxed" style={{ color: "#dcddde" }}>
          {description || <span style={{ color: "#72767d" }}><em>Description…</em></span>}
        </p>
        <p className="text-[10px] mt-2" style={{ color: "#72767d" }}>
          Programmé par {EMPTY_FORM.createdBy} • aujourd'hui à {defaultTime()}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmbedsProgrammesPage() {
  const [data, setData]           = useState<EmbedData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [tab, setTab]             = useState<"pending" | "history">("pending");

  // Form
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(apiUrl("/api/scheduled-embeds"))
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger les embeds programmés."); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  function setField(k: keyof typeof EMPTY_FORM, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setFormError(null);
    setFormSuccess(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!form.channelId.trim()) return setFormError("L'ID du salon est requis.");
    if (!form.description.trim()) return setFormError("La description est requise.");
    if (!form.date || !form.time) return setFormError("La date et l'heure sont requises.");

    const [y, mo, d] = form.date.split("-").map(Number);
    const [h, mi]    = form.time.split(":").map(Number);
    const scheduledAt = new Date(Date.UTC(y, mo - 1, d, h, mi));

    if (scheduledAt <= new Date()) return setFormError("La date doit être dans le futur (heure d'Abidjan = UTC+0).");

    setSubmitting(true);
    try {
      const r = await fetch(apiUrl("/api/scheduled-embeds"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId:   form.channelId.trim(),
          title:       form.title.trim(),
          description: form.description.trim(),
          color:       numFromHex(form.colorHex),
          scheduledAt: scheduledAt.toISOString(),
          createdBy:   "Dashboard",
        }),
      });
      const json = await r.json();
      if (!r.ok) return setFormError(json.error || "Erreur lors de la création.");
      setFormSuccess(`✅ Embed programmé ! ID : ${json.id}`);
      setForm({ ...EMPTY_FORM, date: todayLocal(), time: defaultTime() });
      load();
    } catch {
      setFormError("Erreur réseau. Vérifie ta connexion.");
    } finally {
      setSubmitting(false);
    }
  }

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

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-bold text-lg">📨 Embeds Programmés</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Visualise, planifie et annule les embeds en attente de publication
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
          >
            ↻ Actualiser
          </button>
          <button
            onClick={() => { setShowForm(f => !f); setFormError(null); setFormSuccess(null); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            style={{
              background: showForm ? "rgba(212,150,58,0.2)" : "var(--primary)",
              color: showForm ? "var(--primary)" : "var(--primary-foreground)",
              border: showForm ? "1px solid rgba(212,150,58,0.4)" : "none",
            }}
          >
            {showForm ? "✕ Fermer" : "+ Nouveau"}
          </button>
        </div>
      </div>

      {/* ── Formulaire de création ──────────────────────────────────────────── */}
      {showForm && (
        <div className="rounded-xl mb-8 overflow-hidden" style={{ border: "1px solid rgba(212,150,58,0.35)", background: "rgba(212,150,58,0.04)" }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(212,150,58,0.2)" }}>
            <span className="text-sm font-bold" style={{ color: "#d4963a" }}>✏️ Programmer un embed</span>
          </div>

          <form onSubmit={submitForm} className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── Champs gauche ──────────────────────────────────────────── */}
              <div className="flex flex-col gap-4">

                {/* Channel ID */}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                    📍 ID du salon Discord <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.channelId}
                    onChange={e => setField("channelId", e.target.value)}
                    placeholder="ex : 1234567890123456789"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                    Discord → clic droit sur le salon → "Copier l'identifiant"
                  </p>
                </div>

                {/* Titre */}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                    📋 Titre <span style={{ color: "var(--muted-foreground)" }}>(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setField("title", e.target.value)}
                    placeholder="ex : 🏆 Tournoi du weekend"
                    maxLength={256}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                    📝 Description <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={e => setField("description", e.target.value)}
                    placeholder="Contenu de l'embed…"
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                    style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                  <p className="text-[10px] mt-0.5 text-right" style={{ color: "var(--muted-foreground)" }}>
                    {form.description.length} / 2000
                  </p>
                </div>

                {/* Couleur */}
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                    🎨 Couleur
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {COLOR_PRESETS.map(c => (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.label}
                        onClick={() => setField("colorHex", c.hex)}
                        className="w-7 h-7 rounded-full transition-transform cursor-pointer"
                        style={{
                          background: c.hex,
                          outline: form.colorHex === c.hex ? `2px solid ${c.hex}` : "none",
                          outlineOffset: "2px",
                          transform: form.colorHex === c.hex ? "scale(1.15)" : "scale(1)",
                        }}
                      />
                    ))}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={form.colorHex}
                        onChange={e => setField("colorHex", e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                        style={{ background: "none" }}
                        title="Couleur personnalisée"
                      />
                      <span className="text-[11px] font-mono" style={{ color: "var(--muted-foreground)" }}>
                        {form.colorHex}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Date + Heure */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                      📅 Date <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      min={todayLocal()}
                      onChange={e => setField("date", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                      🕐 Heure (UTC+0) <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={e => setField("time", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    />
                  </div>
                </div>
                <p className="text-[10px] -mt-2" style={{ color: "var(--muted-foreground)" }}>
                  ⚠️ L'heure est en heure d'Abidjan (UTC+0 = GMT)
                </p>
              </div>

              {/* ── Aperçu droite ───────────────────────────────────────────── */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  👁️ Aperçu en temps réel
                </p>
                <EmbedPreview
                  title={form.title}
                  description={form.description}
                  colorHex={form.colorHex}
                />

                {/* Récap publication */}
                {form.channelId && form.date && form.time && (
                  <div className="rounded-lg p-3 text-xs" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                    <p className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>📋 Récapitulatif</p>
                    <div className="flex flex-col gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <span>📍 Salon ID : <code className="px-1 rounded" style={{ background: "var(--card)" }}>{form.channelId || "—"}</code></span>
                      <span>🕐 Publication : <strong style={{ color: "var(--foreground)" }}>{form.date} à {form.time} (UTC+0)</strong></span>
                      <span>🎨 Couleur : <span className="inline-block w-3 h-3 rounded-full align-middle mr-1" style={{ background: form.colorHex }} />{form.colorHex}</span>
                    </div>
                  </div>
                )}

                {/* Aide commande Discord */}
                <div className="rounded-lg p-3 text-[10px]" style={{ background: "rgba(88,101,242,0.08)", border: "1px solid rgba(88,101,242,0.2)" }}>
                  <p className="font-semibold mb-1" style={{ color: "#5865F2" }}>💡 Équivalent Discord</p>
                  <code className="break-all leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                    !embed programmer #{form.channelId || "salon"} | {form.title || "Titre"} | {form.description.slice(0, 40) || "Description"} | {form.colorHex} | {form.date} {form.time}
                  </code>
                </div>
              </div>
            </div>

            {/* Feedback + submit */}
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg text-sm font-bold cursor-pointer transition-opacity disabled:opacity-60"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {submitting ? "Envoi…" : "📅 Programmer l'embed"}
              </button>
              {formError && (
                <p className="text-sm font-semibold" style={{ color: "#f87171" }}>⚠️ {formError}</p>
              )}
              {formSuccess && (
                <p className="text-sm font-semibold" style={{ color: "#57F287" }}>{formSuccess}</p>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-16 animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : error ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { icon: "⏳", label: "En attente",          value: data.stats.pending,  color: "#d4963a" },
              { icon: "📤", label: "Publiés aujourd'hui", value: data.stats.sentToday, color: "#57F287" },
              { icon: "📆", label: "Cette semaine",       value: data.stats.sentWeek,  color: "#6366f1" },
              { icon: "🕐", label: "Prochain",            value: data.stats.next ? timeRelative(data.stats.next) : "—", color: "#ec4899" },
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
              <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: hexColor(pending[0].color) }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold mb-0.5" style={{ color: "#d4963a" }}>⚡ Prochain embed à publier</p>
                <p className="text-sm font-bold truncate">{pending[0].title || "(sans titre)"}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>{pending[0].description}</p>
                <div className="flex flex-wrap gap-x-4 mt-1">
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>📍 <code>#{shortId(pending[0]._id)}</code></span>
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>🕐 {fmtDate(pending[0].scheduledAt)} ({timeRelative(pending[0].scheduledAt)})</span>
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>✍️ {pending[0].createdBy}</span>
                </div>
              </div>
            </div>
          )}

          {/* Onglets */}
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

          {/* Liste */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            {tab === "pending" && (
              pending.length === 0 ? (
                <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-sm">Aucun embed programmé en attente.</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    + Créer le premier
                  </button>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {pending.map(doc => {
                    const sid = shortId(doc._id);
                    return (
                      <div key={doc._id} className="px-5 py-4 flex items-center gap-4">
                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: hexColor(doc.color), minHeight: 40 }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold truncate">{doc.title || "(sans titre)"}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                              #{sid}
                            </span>
                          </div>
                          <p className="text-xs truncate mb-1" style={{ color: "var(--muted-foreground)" }}>{doc.description}</p>
                          <div className="flex flex-wrap gap-x-4">
                            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>🕐 {fmtDate(doc.scheduledAt)}</span>
                            <span className="text-[11px] font-semibold" style={{ color: "#d4963a" }}>{timeRelative(doc.scheduledAt)}</span>
                            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>✍️ {doc.createdBy}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => cancel(sid)}
                          disabled={canceling === sid}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
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
                        <div className="flex flex-wrap gap-x-4">
                          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>📤 {fmtDate(doc.scheduledAt)}</span>
                          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>✍️ {doc.createdBy}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Footer aide */}
          <div className="mt-6 rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>📖 Commandes Discord équivalentes</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { cmd: "!embed programmer #salon | Titre | Desc | couleur | YYYY-MM-DD HH:MM", desc: "Planifier un embed" },
                { cmd: "!embed programmes",  desc: "Voir la liste" },
                { cmd: "!embed déprogrammer <id>", desc: "Annuler un embed" },
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
