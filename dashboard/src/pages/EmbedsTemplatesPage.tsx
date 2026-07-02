import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}
interface EmbedButton {
  label: string;
  url: string;
}
interface EmbedTemplateDoc {
  _id: string;
  guildId: string;
  name: string;
  title: string;
  description: string;
  color: number;
  imageUrl: string;
  thumbnailUrl: string;
  authorName: string;
  authorIconUrl: string;
  footer: string;
  urlTitre: string;
  buttons: EmbedButton[];
  fields: EmbedField[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hexColor(n: number) {
  return `#${n.toString(16).padStart(6, "0")}`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

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

// ─── Discord-style embed preview ──────────────────────────────────────────────
function DiscordEmbedPreview({ t }: { t: EmbedTemplateDoc }) {
  const colorHex = hexColor(t.color ?? 0x5865f2);
  const hasContent =
    t.title || t.description || t.imageUrl || t.thumbnailUrl ||
    t.authorName || t.footer || (t.fields?.length > 0);

  return (
    <div
      className="rounded-lg overflow-hidden flex"
      style={{ background: "#2f3136", border: "1px solid #202225", maxWidth: 440 }}
    >
      <div className="w-1 flex-shrink-0 rounded-l" style={{ background: colorHex }} />
      <div className="flex-1 min-w-0 p-3 space-y-2">
        {!hasContent && (
          <p className="text-xs italic" style={{ color: "#72767d" }}>Embed vide</p>
        )}

        {/* Author */}
        {t.authorName && (
          <div className="flex items-center gap-2">
            {t.authorIconUrl && (
              <img src={t.authorIconUrl} alt="" className="w-5 h-5 rounded-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <span className="text-xs font-semibold" style={{ color: "#dcddde" }}>{t.authorName}</span>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            {/* Title */}
            {t.title && (
              <p className="text-sm font-bold leading-snug" style={{ color: "#ffffff" }}>{t.title}</p>
            )}
            {/* Description */}
            {t.description && (
              <p className="text-xs leading-relaxed whitespace-pre-wrap break-words" style={{ color: "#dcddde" }}>
                {t.description.split(/(\[[^\]]+\]\([^)]+\))/g).map((chunk, i) => {
                  const m = chunk.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                  if (m) return (
                    <span key={i} style={{ color: "#00b0f4", textDecoration: "underline" }}>{m[1]}</span>
                  );
                  return chunk;
                })}
              </p>
            )}
            {/* Fields */}
            {t.fields?.length > 0 && (
              <div className="grid grid-cols-2 gap-1 mt-1">
                {t.fields.slice(0, 6).map((f, i) => (
                  <div key={i} className={f.inline ? "" : "col-span-2"}>
                    <p className="text-[10px] font-bold" style={{ color: "#dcddde" }}>{f.name}</p>
                    <p className="text-[10px]" style={{ color: "#b9bbbe" }}>{f.value}</p>
                  </div>
                ))}
                {t.fields.length > 6 && (
                  <p className="col-span-2 text-[10px] italic" style={{ color: "#72767d" }}>
                    +{t.fields.length - 6} champ(s)…
                  </p>
                )}
              </div>
            )}
            {/* Image */}
            {t.imageUrl && (
              <img src={t.imageUrl} alt="" className="mt-2 rounded max-w-full"
                style={{ maxHeight: 120, objectFit: "cover" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>
          {/* Thumbnail */}
          {t.thumbnailUrl && (
            <img src={t.thumbnailUrl} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>

        {/* Buttons */}
        {t.buttons?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {t.buttons.map((b, i) => (
              <span key={i} className="px-2 py-0.5 rounded text-[10px] font-semibold"
                style={{ background: "#5865F2", color: "#fff" }}>
                {b.label}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        {t.footer && (
          <p className="text-[10px] pt-1" style={{ color: "#72767d", borderTop: "1px solid #40444b" }}>
            {t.footer}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function TemplateDetail({
  t, onClose, onDelete, deleting,
}: {
  t: EmbedTemplateDoc;
  onClose: () => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  const colorHex = hexColor(t.color ?? 0x5865f2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colorHex }} />
            <h2 className="font-bold text-base truncate">{t.name}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onDelete(t._id)}
              disabled={deleting === t._id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
              style={{ background: "rgba(237,66,69,0.15)", color: "#f87171", border: "1px solid rgba(237,66,69,0.3)" }}
            >
              {deleting === t._id ? "⏳ Suppression…" : "🗑️ Supprimer"}
            </button>
            <button
              onClick={onClose}
              className="size-8 rounded-lg flex items-center justify-center text-lg cursor-pointer"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >×</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Preview */}
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold mb-3"
              style={{ color: "var(--muted-foreground)" }}>Aperçu Discord</p>
            <DiscordEmbedPreview t={t} />
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Créé par",   value: t.createdBy || "—" },
              { label: "Mis à jour", value: t.updatedBy || "—" },
              { label: "Date",       value: fmtDate(t.createdAt) },
              { label: "Couleur",    value: colorHex.toUpperCase() },
              { label: "Champs",     value: String(t.fields?.length ?? 0) },
              { label: "Boutons",    value: String(t.buttons?.length ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5"
                  style={{ color: "var(--muted-foreground)" }}>{label}</p>
                <p className="text-sm font-bold truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Fields list */}
          {t.fields?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold mb-2"
                style={{ color: "var(--muted-foreground)" }}>Champs ({t.fields.length})</p>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                      <th className="py-1.5 px-3 text-left">Nom</th>
                      <th className="py-1.5 px-3 text-left">Valeur</th>
                      <th className="py-1.5 px-3 text-center">Inline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.fields.map((f, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                        <td className="py-1.5 px-3 font-semibold">{f.name}</td>
                        <td className="py-1.5 px-3 max-w-[180px] truncate" style={{ color: "var(--muted-foreground)" }}>{f.value}</td>
                        <td className="py-1.5 px-3 text-center">{f.inline ? "✅" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Buttons list */}
          {t.buttons?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold mb-2"
                style={{ color: "var(--muted-foreground)" }}>Boutons ({t.buttons.length})</p>
              <div className="flex flex-wrap gap-2">
                {t.buttons.map((b, i) => (
                  <a key={i} href={b.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "#5865F2", color: "#fff" }}>
                    🔗 {b.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmbedsTemplatesPage() {
  const [templates, setTemplates] = useState<EmbedTemplateDoc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<EmbedTemplateDoc | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(apiUrl("/api/embed-templates"))
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setTemplates(d.templates ?? []); setLoading(false); })
      .catch(e => { setError(e.message ?? "Impossible de charger les templates."); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteTemplate(id: string) {
    if (!confirm("Supprimer définitivement ce template d'embed ?")) return;
    setDeleting(id);
    const apiKey = localStorage.getItem("supremyx_api_key") ?? "";
    try {
      const r = await fetch(apiUrl(`/api/embed-templates/${id}`), {
        method: "DELETE",
        headers: apiKey ? { "x-api-key": apiKey } : {},
      });
      if (r.ok) {
        setTemplates(prev => prev.filter(t => t._id !== id));
        if (selected?._id === id) setSelected(null);
      } else {
        alert("Erreur lors de la suppression.");
      }
    } catch { alert("Erreur réseau."); }
    setDeleting(null);
  }

  // ── Filtrage ──
  const filtered = templates.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) ||
      t.authorName?.toLowerCase().includes(q) || t.createdBy?.toLowerCase().includes(q);
    const matchColor = !colorFilter || hexColor(t.color).toLowerCase() === colorFilter.toLowerCase();
    return matchSearch && matchColor;
  });

  // ── Couleurs uniques présentes ──
  const uniqueColors = [...new Set(templates.map(t => hexColor(t.color ?? 0x5865f2)))];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-bold text-lg">🗂️ Modèles d'Embeds</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Gérez vos templates d'embeds Discord — aperçu, détails et suppression
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
        >
          ↻ Actualiser
        </button>
      </div>

      {/* ── Stats cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { icon: "🗂️", label: "Total templates", value: templates.length, color: "var(--primary)" },
          { icon: "🎨", label: "Couleurs uniques", value: uniqueColors.length, color: "#9B59B6" },
          { icon: "🔎", label: "Résultats filtrés", value: filtered.length, color: "#57F287" },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{icon} {label}</div>
          </div>
        ))}
      </div>

      {/* ── Filtres ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Recherche texte */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] px-3 py-2 rounded-lg"
          style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, titre, description…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--foreground)" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs cursor-pointer"
              style={{ color: "var(--muted-foreground)" }}>✕</button>
          )}
        </div>

        {/* Filtre couleur */}
        {uniqueColors.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Couleur :</span>
            <button
              onClick={() => setColorFilter(null)}
              className="px-2 py-1 rounded-md text-xs font-semibold cursor-pointer"
              style={{
                background: !colorFilter ? "var(--primary)" : "var(--muted)",
                color: !colorFilter ? "var(--primary-foreground)" : "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
            >Toutes</button>
            {uniqueColors.slice(0, 8).map(hex => (
              <button
                key={hex}
                onClick={() => setColorFilter(colorFilter === hex ? null : hex)}
                title={hex.toUpperCase()}
                className="w-6 h-6 rounded-full cursor-pointer transition-transform"
                style={{
                  background: hex,
                  outline: colorFilter === hex ? `2px solid ${hex}` : "none",
                  outlineOffset: "2px",
                  transform: colorFilter === hex ? "scale(1.2)" : "scale(1)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── États ────────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="py-20 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>
          Chargement des templates…
        </div>
      )}
      {!loading && error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
          <button onClick={load} className="mt-4 px-4 py-2 rounded-lg text-sm cursor-pointer"
            style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            Réessayer
          </button>
        </div>
      )}
      {!loading && !error && templates.length === 0 && (
        <div className="py-20 text-center" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-5xl mb-4">🗂️</div>
          <p className="font-semibold">Aucun template d'embed enregistré</p>
          <p className="text-xs mt-1">Utilisez la commande <code className="px-1 py-0.5 rounded text-xs"
            style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>!embed créer</code> dans Discord pour en créer un.</p>
        </div>
      )}
      {!loading && !error && templates.length > 0 && filtered.length === 0 && (
        <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-4xl mb-3">🔍</div>
          <p>Aucun template ne correspond à votre recherche.</p>
          <button onClick={() => { setSearch(""); setColorFilter(null); }}
            className="mt-3 px-4 py-1.5 rounded-lg text-sm cursor-pointer"
            style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            Effacer les filtres
          </button>
        </div>
      )}

      {/* ── Grille de templates ───────────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(t => {
            const colorHex = hexColor(t.color ?? 0x5865f2);
            const presetName = COLOR_PRESETS.find(p => p.hex.toLowerCase() === colorHex.toLowerCase())?.label;
            return (
              <div
                key={t._id}
                className="rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
                style={{ border: "1px solid var(--border)", background: "var(--card)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = colorHex)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                onClick={() => setSelected(t)}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorHex }} />
                    <span className="font-bold text-sm truncate">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{ background: "rgba(0,0,0,0.2)", color: "var(--muted-foreground)" }}>
                      {presetName ?? colorHex.toUpperCase()}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteTemplate(t._id); }}
                      disabled={deleting === t._id}
                      className="size-6 rounded flex items-center justify-center text-xs cursor-pointer transition-colors disabled:opacity-50"
                      style={{ background: "rgba(237,66,69,0.12)", color: "#f87171" }}
                      title="Supprimer"
                    >
                      {deleting === t._id ? "⏳" : "🗑️"}
                    </button>
                  </div>
                </div>

                {/* Embed preview */}
                <div className="p-4">
                  <DiscordEmbedPreview t={t} />
                </div>

                {/* Card footer */}
                <div className="flex items-center justify-between px-4 py-2"
                  style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                    {t.fields?.length > 0 && <span>📋 {t.fields.length} champ{t.fields.length > 1 ? "s" : ""}</span>}
                    {t.buttons?.length > 0 && <span>🔗 {t.buttons.length} bouton{t.buttons.length > 1 ? "s" : ""}</span>}
                    {t.createdBy && <span>par {t.createdBy}</span>}
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                    {fmtDate(t.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detail panel ─────────────────────────────────────────────────────── */}
      {selected && (
        <TemplateDetail
          t={selected}
          onClose={() => setSelected(null)}
          onDelete={deleteTemplate}
          deleting={deleting}
        />
      )}
    </div>
  );
}
