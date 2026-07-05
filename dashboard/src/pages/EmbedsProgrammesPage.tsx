import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "../lib/api";

interface ScheduledEmbedDoc {
  _id: string;
  guildId: string;
  channelId: string;
  title: string;
  description: string;
  color: number;
  imageUrl: string;
  thumbnailUrl: string;
  authorName: string;
  authorIconUrl: string;
  footer: string;
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
  { label: "Or",     hex: "#d4963a" },
  { label: "Bleu",   hex: "#5865F2" },
  { label: "Vert",   hex: "#57F287" },
  { label: "Rouge",  hex: "#ED4245" },
  { label: "Jaune",  hex: "#FEE75C" },
  { label: "Violet", hex: "#9B59B6" },
  { label: "Rose",   hex: "#FF73FA" },
  { label: "Cyan",   hex: "#1ABC9C" },
];

function hexColor(n: number) { return `#${n.toString(16).padStart(6, "0")}`; }
function numFromHex(h: string) { return parseInt(h.replace("#", ""), 16); }
function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
function todayLocal() { return new Date().toISOString().slice(0, 10); }
function defaultTime() {
  const d = new Date(Date.now() + 3_600_000);
  return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
}

const EMPTY_FORM = {
  channelId: "", title: "", description: "", colorHex: "#d4963a",
  imageUrl: "", thumbnailUrl: "", authorName: "", authorIconUrl: "", footer: "",
  date: todayLocal(), time: defaultTime(),
};

// ─── Discord-style Embed Preview ─────────────────────────────────────────────
function DiscordEmbedPreview({ f }: { f: typeof EMPTY_FORM }) {
  const hasContent = f.title || f.description || f.imageUrl || f.thumbnailUrl || f.authorName || f.footer;
  return (
    <div className="rounded-lg overflow-hidden flex" style={{ background: "#2f3136", border: "1px solid #202225", maxWidth: 440 }}>
      <div className="w-1 flex-shrink-0 rounded-l" style={{ background: f.colorHex }} />
      <div className="flex-1 min-w-0 p-3">
        {!hasContent && (
          <p className="text-xs italic" style={{ color: "#72767d" }}>L'aperçu apparaît ici…</p>
        )}
        {/* Author */}
        {f.authorName && (
          <div className="flex items-center gap-2 mb-2">
            {f.authorIconUrl && (
              <img src={f.authorIconUrl} alt="" className="w-5 h-5 rounded-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <span className="text-xs font-semibold" style={{ color: "#dcddde" }}>{f.authorName}</span>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Title */}
            {f.title && (
              <p className="text-sm font-bold mb-1 leading-snug" style={{ color: "#ffffff" }}>{f.title}</p>
            )}
            {/* Description — render [text](url) as blue spans */}
            {f.description && (
              <p className="text-xs leading-relaxed whitespace-pre-wrap break-words" style={{ color: "#dcddde" }}>
                {f.description.split(/(\[[^\]]+\]\([^)]+\))/g).map((chunk, i) => {
                  const m = chunk.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                  if (m) return <span key={i} style={{ color: "#00b0f4", textDecoration: "underline", cursor: "pointer" }}>{m[1]}</span>;
                  return chunk;
                })}
              </p>
            )}
            {/* Image */}
            {f.imageUrl && (
              <img src={f.imageUrl} alt="" className="mt-2 rounded max-w-full" style={{ maxHeight: 160, objectFit: "cover" }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
          </div>

          {/* Thumbnail */}
          {f.thumbnailUrl && (
            <img src={f.thumbnailUrl} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
        </div>

        {/* Footer */}
        {f.footer && (
          <p className="text-[10px] mt-2 pt-1" style={{ color: "#72767d", borderTop: "1px solid #40444b" }}>{f.footer}</p>
        )}
      </div>
    </div>
  );
}

// ─── Field input helper ────────────────────────────────────────────────────
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
        {label} {required && <span style={{ color: "#f87171" }}>*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{hint}</p>}
    </div>
  );
}
function TextInput({ value, onChange, placeholder, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { onChange: (v: string) => void }) {
  return (
    <input
      type="text" value={value as string}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
      style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      {...rest}
    />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmbedsProgrammesPage() {
  const [data, setData]           = useState<EmbedData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [canceling, setCanceling] = useState<string | null>(null);
  const [tab, setTab]             = useState<"pending" | "history">("pending");

  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);
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
    setFormError(null); setFormSuccess(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null); setFormSuccess(null);
    if (!form.channelId.trim()) return setFormError("L'ID du salon est requis.");
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
          channelId:    form.channelId.trim(),
          title:        form.title.trim(),
          description:  form.description.trim(),
          color:        numFromHex(form.colorHex),
          imageUrl:     form.imageUrl.trim(),
          thumbnailUrl: form.thumbnailUrl.trim(),
          authorName:   form.authorName.trim(),
          authorIconUrl:form.authorIconUrl.trim(),
          footer:       form.footer.trim(),
          scheduledAt:  scheduledAt.toISOString(),
          createdBy:    "Dashboard",
        }),
      });
      const json = await r.json();
      if (!r.ok) return setFormError(json.error || "Erreur lors de la création.");
      setFormSuccess(`✅ Embed programmé ! ID : ${json.id}`);
      setForm({ ...EMPTY_FORM, date: todayLocal(), time: defaultTime() });
      load();
    } catch { setFormError("Erreur réseau."); }
    finally { setSubmitting(false); }
  }

  async function cancel(fullId: string, displayId: string) {
    if (!confirm(`Annuler l'embed programmé #${displayId} ?`)) return;
    setCanceling(fullId);
    try {
      const r = await fetch(apiUrl(`/api/scheduled-embeds/${fullId}`), { method: "DELETE" });
      if (r.ok) {
        setData(prev => prev ? {
          ...prev,
          stats: { ...prev.stats, pending: prev.stats.pending - 1 },
          pending: prev.pending.filter(d => d._id !== fullId),
        } : null);
      } else { alert("Erreur lors de l'annulation."); }
    } catch { alert("Erreur réseau."); }
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
            Planifie des embeds riches (thumbnail, auteur, liens) et gère leur publication automatique
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
            ↻ Actualiser
          </button>
          <button
            onClick={() => { setShowForm(f => !f); setFormError(null); setFormSuccess(null); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{
              background: showForm ? "rgba(212,150,58,0.15)" : "var(--primary)",
              color: showForm ? "var(--primary)" : "var(--primary-foreground)",
              border: showForm ? "1px solid rgba(212,150,58,0.4)" : "none",
            }}>
            {showForm ? "✕ Fermer" : "+ Nouveau"}
          </button>
        </div>
      </div>

      {/* ── Formulaire ─────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="rounded-xl mb-8 overflow-hidden" style={{ border: "1px solid rgba(212,150,58,0.35)", background: "rgba(212,150,58,0.03)" }}>
          <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(212,150,58,0.2)" }}>
            <span className="text-sm font-bold" style={{ color: "#d4963a" }}>✏️ Programmer un embed riche</span>
          </div>

          <form onSubmit={submitForm}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

              {/* ── Champs ──────────────────────────────────────────────────── */}
              <div className="flex flex-col gap-4 p-5" style={{ borderRight: "1px solid rgba(212,150,58,0.15)" }}>

                <Field label="📍 ID du salon Discord" required hint="Discord → clic droit sur le salon → Copier l'identifiant">
                  <TextInput value={form.channelId} onChange={v => setField("channelId", v)} placeholder="1234567890123456789" />
                </Field>

                <Field label="📋 Titre" hint="Gras en haut de l'embed">
                  <TextInput value={form.title} onChange={v => setField("title", v)} placeholder="🤝 Let's get social !" maxLength={256} />
                </Field>

                <Field label="📝 Description" hint="Supporte [texte](https://url) pour les liens cliquables">
                  <textarea
                    value={form.description}
                    onChange={e => { setField("description", e.target.value); }}
                    placeholder={"♡ [TELEGRAM](https://t.me/...)\n♡ [INSTAGRAM](https://instagram.com/...)\n♡ [FACEBOOK](https://facebook.com/...)"}
                    rows={5}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none font-mono"
                    style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                  <p className="text-[10px] mt-0.5 text-right" style={{ color: "var(--muted-foreground)" }}>
                    {form.description.length} / 4000
                  </p>
                </Field>

                {/* Couleur */}
                <Field label="🎨 Couleur de la barre">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {COLOR_PRESETS.map(c => (
                      <button key={c.hex} type="button" title={c.label} onClick={() => setField("colorHex", c.hex)}
                        className="w-7 h-7 rounded-full cursor-pointer transition-transform"
                        style={{ background: c.hex, outline: form.colorHex === c.hex ? `2px solid ${c.hex}` : "none", outlineOffset: "2px", transform: form.colorHex === c.hex ? "scale(1.2)" : "scale(1)" }}
                      />
                    ))}
                    <div className="flex items-center gap-1.5">
                      <input type="color" value={form.colorHex} onChange={e => setField("colorHex", e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-0 p-0" style={{ background: "none" }} />
                      <span className="text-[11px] font-mono" style={{ color: "var(--muted-foreground)" }}>{form.colorHex}</span>
                    </div>
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="🖼️ Image (bas)" hint="Grande image en bas de l'embed">
                    <TextInput value={form.imageUrl} onChange={v => setField("imageUrl", v)} placeholder="https://…" />
                  </Field>
                  <Field label="📌 Thumbnail (haut-droite)" hint="Petite image en haut à droite">
                    <TextInput value={form.thumbnailUrl} onChange={v => setField("thumbnailUrl", v)} placeholder="https://…" />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="👤 Auteur (nom)" hint="Ligne au-dessus du titre">
                    <TextInput value={form.authorName} onChange={v => setField("authorName", v)} placeholder="SUPREMYX CI" />
                  </Field>
                  <Field label="🪪 Icône auteur (URL)" hint="Avatar circulaire à gauche de l'auteur">
                    <TextInput value={form.authorIconUrl} onChange={v => setField("authorIconUrl", v)} placeholder="https://…" />
                  </Field>
                </div>

                <Field label="📄 Pied de page" hint="Petite ligne en bas, après l'image">
                  <TextInput value={form.footer} onChange={v => setField("footer", v)} placeholder="| SUPREMYX INTERNATIONAL SCRIMS & EVENTS" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="📅 Date" required>
                    <input type="date" value={form.date} min={todayLocal()} onChange={e => setField("date", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                  </Field>
                  <Field label="🕐 Heure (UTC+0)" required hint="Abidjan = UTC+0">
                    <input type="time" value={form.time} onChange={e => setField("time", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                  </Field>
                </div>
              </div>

              {/* ── Aperçu droite ─────────────────────────────────────────── */}
              <div className="flex flex-col gap-3 p-5 bg-[#1e1f22]">
                <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>👁️ Aperçu Discord en temps réel</p>
                <DiscordEmbedPreview f={form} />

                <div className="rounded-lg p-3 mt-1" style={{ background: "rgba(88,101,242,0.08)", border: "1px solid rgba(88,101,242,0.2)" }}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: "#5865F2" }}>💡 Syntaxe liens cliquables</p>
                  <code className="text-[10px] leading-relaxed block" style={{ color: "var(--muted-foreground)" }}>
                    [texte visible](https://lien)<br/>
                    ♡ [TELEGRAM](https://t.me/mongroupe)<br/>
                    ♡ [INSTAGRAM](https://instagram.com/moi)
                  </code>
                </div>

                <div className="rounded-lg p-3" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--foreground)" }}>📋 Équivalent commande Discord</p>
                  <code className="text-[10px] leading-relaxed break-all block" style={{ color: "var(--muted-foreground)" }}>
                    !embed riche #{form.channelId || "salon"} | {form.title || "Titre"} | {form.description.slice(0,40) || "Description"} | {form.colorHex}{form.imageUrl ? ` | ${form.imageUrl.slice(0,30)}…` : ""}{form.thumbnailUrl ? ` | ${form.thumbnailUrl.slice(0,30)}…` : ""}{form.authorName ? ` | ${form.authorName}` : ""}
                  </code>
                </div>
              </div>
            </div>

            {/* Submit bar */}
            <div className="px-5 py-4 flex items-center gap-3 flex-wrap" style={{ borderTop: "1px solid rgba(212,150,58,0.15)" }}>
              <button type="submit" disabled={submitting}
                className="px-5 py-2 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-60"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                {submitting ? "Envoi…" : "📅 Programmer l'embed"}
              </button>
              {formError   && <p className="text-sm font-semibold" style={{ color: "#f87171" }}>⚠️ {formError}</p>}
              {formSuccess && <p className="text-sm font-semibold" style={{ color: "#57F287" }}>{formSuccess}</p>}
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
              { icon: "⏳", label: "En attente",          value: data.stats.pending,   color: "#d4963a" },
              { icon: "📤", label: "Publiés aujourd'hui", value: data.stats.sentToday,  color: "#57F287" },
              { icon: "📆", label: "Cette semaine",       value: data.stats.sentWeek,   color: "#6366f1" },
              { icon: "🕐", label: "Prochain",            value: data.stats.next ? timeRelative(data.stats.next) : "—", color: "#ec4899" },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="flex flex-col items-center gap-2 rounded-xl p-4 text-center"
                style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <span className="text-xl">{icon}</span>
                <span className="text-xl font-bold" style={{ color }}>{value}</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Prochain embed */}
          {pending.length > 0 && (
            <div className="rounded-xl p-4 mb-8 flex items-center gap-4"
              style={{ border: "1px solid rgba(212,150,58,0.35)", background: "rgba(212,150,58,0.06)" }}>
              <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: hexColor(pending[0].color) }} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold mb-0.5" style={{ color: "#d4963a" }}>⚡ Prochain embed à publier</p>
                <p className="text-sm font-bold truncate">{pending[0].title || "(sans titre)"}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>{pending[0].description}</p>
                <div className="flex flex-wrap gap-x-4 mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  <span>📍 <code>#{shortId(pending[0]._id)}</code></span>
                  <span>🕐 {fmtDate(pending[0].scheduledAt)} ({timeRelative(pending[0].scheduledAt)})</span>
                  <span>✍️ {pending[0].createdBy}</span>
                  {pending[0].thumbnailUrl && <span>📌 Thumbnail</span>}
                  {pending[0].authorName   && <span>👤 {pending[0].authorName}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Onglets */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: "var(--muted)" }}>
            {(["pending", "history"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{
                  background: tab === t ? "var(--card)" : "transparent",
                  color: tab === t ? "var(--foreground)" : "var(--muted-foreground)",
                  border: tab === t ? "1px solid var(--border)" : "1px solid transparent",
                }}>
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
                  <button onClick={() => setShowForm(true)}
                    className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                    + Créer le premier
                  </button>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {pending.map(doc => {
                    const sid = shortId(doc._id);
                    const badges = [
                      doc.thumbnailUrl ? "📌 Thumbnail" : null,
                      doc.imageUrl     ? "🖼️ Image"     : null,
                      doc.authorName   ? `👤 ${doc.authorName}` : null,
                    ].filter(Boolean);
                    return (
                      <div key={doc._id} className="px-5 py-4 flex items-center gap-4">
                        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: hexColor(doc.color), minHeight: 40 }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-sm font-bold truncate">{doc.title || "(sans titre)"}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>#{sid}</span>
                            {badges.map(b => (
                              <span key={b} className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(88,101,242,0.1)", color: "#818cf8", border: "1px solid rgba(88,101,242,0.2)" }}>{b}</span>
                            ))}
                          </div>
                          <p className="text-xs truncate mb-1" style={{ color: "var(--muted-foreground)" }}>{doc.description}</p>
                          <div className="flex flex-wrap gap-x-4 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                            <span>🕐 {fmtDate(doc.scheduledAt)}</span>
                            <span className="font-semibold" style={{ color: "#d4963a" }}>{timeRelative(doc.scheduledAt)}</span>
                            <span>✍️ {doc.createdBy}</span>
                          </div>
                        </div>
                        <button onClick={() => cancel(doc._id, sid)} disabled={canceling === doc._id}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                          style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                          {canceling === doc._id ? "…" : "✕ Annuler"}
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
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-sm font-semibold truncate">{doc.title || "(sans titre)"}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>#{shortId(doc._id)}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(87,242,135,0.1)", color: "#57F287", border: "1px solid rgba(87,242,135,0.25)" }}>✓ Publié</span>
                        </div>
                        <p className="text-xs truncate mb-1" style={{ color: "var(--muted-foreground)" }}>{doc.description}</p>
                        <div className="flex flex-wrap gap-x-4 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                          <span>📤 {fmtDate(doc.scheduledAt)}</span>
                          <span>✍️ {doc.createdBy}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Footer commandes */}
          <div className="mt-6 rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--muted-foreground)" }}>📖 Commandes Discord équivalentes</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { cmd: "!embed riche #salon | Titre | Desc | couleur | image | thumbnail | auteur | auteur_icon | footer", desc: "Embed complet (thumbnail, auteur, liens)" },
                { cmd: "!embed riche aperçu | #salon | …",              desc: "Prévisualiser avant de publier" },
                { cmd: "!embed programmer #salon | Titre | Desc | couleur | YYYY-MM-DD HH:MM", desc: "Programmer un embed simple" },
                { cmd: "!embed déprogrammer <id>",                       desc: "Annuler un embed planifié" },
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
