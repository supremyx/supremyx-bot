import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../lib/api";

// ── Types ────────────────────────────────────────────────────────────────────
interface AutomodCfg  { enabled: boolean; autoDelete: boolean; autoTimeout: boolean; timeoutMinutes: number; violationThreshold: number; }
interface AntispamCfg { enabled: boolean; maxMessages: number; windowSeconds: number; autoDelete: boolean; autoTimeout: boolean; timeoutMinutes: number; violationThreshold: number; }
interface AntiLinkCfg { enabled: boolean; blockDiscordInvites: boolean; blockExternalLinks: boolean; allowedDomains: string[]; action: string; timeoutSeconds: number; violationThreshold: number; }
interface BadWord      { _id: string; word: string; addedBy?: string; createdAt?: string; }

const API_KEY = import.meta.env.VITE_BOT_API_KEY || "";
const HEADERS = { "Content-Type": "application/json", "x-api-key": API_KEY };
const PAGE_SIZE = 100;

// ── Petits composants réutilisables ───────────────────────────────────────────
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div onClick={() => onChange(!value)} className="relative w-11 h-6 rounded-full transition-colors"
        style={{ background: value ? "var(--primary)" : "var(--muted)" }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{ background: "white", left: value ? "calc(100% - 22px)" : "2px" }} />
      </div>
      <span className="text-sm">{label}</span>
    </label>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 mb-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
      <h3 className="font-bold text-sm mb-4" style={{ color: "var(--primary)" }}>{title}</h3>
      {children}
    </div>
  );
}
function NumInput({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm">{label}</span>
      <input type="number" value={value} min={min} max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="w-24 px-2 py-1 rounded text-sm text-right"
        style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
    </div>
  );
}
function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving} className="px-5 py-2 rounded-lg font-semibold text-sm cursor-pointer"
      style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: saving ? 0.6 : 1 }}>
      {saving ? "Sauvegarde…" : "💾 Sauvegarder"}
    </button>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AutoModPage() {
  const [tab, setTab]           = useState<"automod"|"antispam"|"antilink"|"badwords">("automod");
  const [automod, setAutomod]   = useState<AutomodCfg | null>(null);
  const [antispam, setAntispam] = useState<AntispamCfg | null>(null);
  const [antilink, setAntilink] = useState<AntiLinkCfg | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  // ── Bad-words state ──────────────────────────────────────────────────────
  const [words, setWords]           = useState<BadWord[]>([]);
  const [total, setTotal]           = useState(0);
  const [bwLoading, setBwLoading]   = useState(false);
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(0);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [newInput, setNewInput]     = useState("");
  const [addMode, setAddMode]       = useState<"single"|"bulk">("single");
  const [bulkText, setBulkText]     = useState("");
  const [bwMsg, setBwMsg]           = useState<{type:"ok"|"err"; text:string}|null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  // ── Chargement configs ────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(apiUrl("/api/automod-config")).then(r => r.json()).catch(() => null),
      fetch(apiUrl("/api/antispam-config")).then(r => r.json()).catch(() => null),
      fetch(apiUrl("/api/antilink-config")).then(r => r.json()).catch(() => null),
    ]).then(([am, as_, al]) => {
      if (am?.config)  setAutomod(am.config);
      if (as_?.config) setAntispam(as_.config);
      if (al?.config)  setAntilink(al.config);
    }).finally(() => setLoading(false));
  }, []);

  // ── Chargement mots (avec debounce sur search) ────────────────────────────
  const loadWords = (q: string, p: number) => {
    setBwLoading(true);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), skip: String(p * PAGE_SIZE) });
    fetch(apiUrl(`/api/badwords?${params}`)).then(r => r.json())
      .then(d => { setWords(d.words || []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setBwLoading(false));
  };

  useEffect(() => {
    if (tab !== "badwords") return;
    setPage(0);
    setSelected(new Set());
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadWords(search, 0), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, tab]);

  useEffect(() => {
    if (tab !== "badwords") return;
    loadWords(search, page);
  }, [page]);

  // ── Save config ───────────────────────────────────────────────────────────
  const save = async (endpoint: string, data: object) => {
    setSaving(true);
    await fetch(apiUrl(endpoint), { method: "POST", headers: HEADERS, body: JSON.stringify(data) }).catch(() => {});
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  // ── Helpers bad-words ─────────────────────────────────────────────────────
  const flash = (type: "ok"|"err", text: string) => {
    setBwMsg({ type, text }); setTimeout(() => setBwMsg(null), 3000);
  };

  const addSingle = async () => {
    const word = newInput.trim().toLowerCase();
    if (!word) return;
    const r = await fetch(apiUrl("/api/badwords"), { method: "POST", headers: HEADERS, body: JSON.stringify({ word }) }).then(r => r.json()).catch(() => null);
    if (r?.success) { flash("ok", r.skipped ? `"${word}" déjà présent` : `"${word}" ajouté`); setNewInput(""); loadWords(search, page); }
    else flash("err", r?.error || "Erreur");
  };

  const addBulk = async () => {
    const list = bulkText.split(/[\n,;]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
    if (!list.length) return;
    const r = await fetch(apiUrl("/api/badwords"), { method: "POST", headers: HEADERS, body: JSON.stringify({ words: list }) }).then(r => r.json()).catch(() => null);
    if (r?.success) { flash("ok", `✅ ${r.added} ajouté(s), ${r.skipped} déjà présent(s)`); setBulkText(""); loadWords(search, 0); setPage(0); }
    else flash("err", r?.error || "Erreur");
  };

  const deleteOne = async (id: string) => {
    await fetch(apiUrl(`/api/badwords/${id}`), { method: "DELETE", headers: HEADERS }).catch(() => {});
    setWords(prev => prev.filter(w => w._id !== id));
    setTotal(prev => prev - 1);
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const deleteSelected = async () => {
    if (!selected.size) return;
    const ids = [...selected];
    const r = await fetch(apiUrl("/api/badwords/bulk-delete"), { method: "POST", headers: HEADERS, body: JSON.stringify({ ids }) }).then(r => r.json()).catch(() => null);
    if (r?.success) { flash("ok", `${r.deleted} mot(s) supprimé(s)`); setSelected(new Set()); loadWords(search, page); }
    else flash("err", r?.error || "Erreur");
  };

  const clearAll = async () => {
    const r = await fetch(apiUrl("/api/badwords/clear-all"), { method: "POST", headers: HEADERS }).then(r => r.json()).catch(() => null);
    if (r?.success) { flash("ok", `Liste vidée (${r.deleted} mots supprimés)`); setWords([]); setTotal(0); setSelected(new Set()); setConfirmClear(false); }
    else flash("err", r?.error || "Erreur");
  };

  const toggleSelect = (id: string) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const toggleSelectAll = () => {
    if (selected.size === words.length) setSelected(new Set());
    else setSelected(new Set(words.map(w => w._id)));
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs = [
    { key: "automod",  label: "🚨 Mots Interdits" },
    { key: "antispam", label: "⏱️ Anti-Spam" },
    { key: "antilink", label: "🔗 Anti-Liens" },
    { key: "badwords", label: `📝 Liste des mots${total ? ` (${total})` : ""}` },
  ] as const;

  if (loading) return (
    <div className="p-8 text-center" style={{ color: "var(--muted-foreground)" }}>
      <div className="text-3xl mb-2">🔄</div>
      <p>Chargement de la configuration…</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">🛡️ AutoMod Avancé</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Filtres anti-insultes, anti-spam et anti-liens avec détection automatique et sanctions graduelles.
        </p>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
          ✅ Configuration sauvegardée
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            style={{ background: tab === t.key ? "var(--primary)" : "var(--muted)", color: tab === t.key ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Automod ── */}
      {tab === "automod" && automod && (
        <>
          <Card title="🚨 Détection de mots interdits">
            <div className="space-y-3">
              <Toggle value={automod.enabled}     onChange={v => setAutomod(p => p && { ...p, enabled: v })}     label="Activer l'automod" />
              <Toggle value={automod.autoDelete}   onChange={v => setAutomod(p => p && { ...p, autoDelete: v })}  label="Supprimer automatiquement le message" />
              <Toggle value={automod.autoTimeout}  onChange={v => setAutomod(p => p && { ...p, autoTimeout: v })} label="Timeout automatique après seuil" />
            </div>
            <div className="mt-4 space-y-2">
              <NumInput label="Timeout (minutes)"            value={automod.timeoutMinutes}    onChange={v => setAutomod(p => p && { ...p, timeoutMinutes: v })}    min={1} max={1440} />
              <NumInput label="Seuil violations pour timeout" value={automod.violationThreshold} onChange={v => setAutomod(p => p && { ...p, violationThreshold: v })} min={1} max={20} />
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
              Les violations sont comptées sur 24h par utilisateur.
            </p>
          </Card>
          <SaveBtn saving={saving} onClick={() => save("/api/automod-config", automod)} />
        </>
      )}

      {/* ── Antispam ── */}
      {tab === "antispam" && antispam && (
        <>
          <Card title="⏱️ Détection de spam">
            <div className="space-y-3">
              <Toggle value={antispam.enabled}    onChange={v => setAntispam(p => p && { ...p, enabled: v })}    label="Activer l'anti-spam" />
              <Toggle value={antispam.autoDelete}  onChange={v => setAntispam(p => p && { ...p, autoDelete: v })} label="Supprimer les messages spam" />
              <Toggle value={antispam.autoTimeout} onChange={v => setAntispam(p => p && { ...p, autoTimeout: v })} label="Timeout automatique après seuil" />
            </div>
            <div className="mt-4 space-y-2">
              <NumInput label="Messages max par fenêtre"     value={antispam.maxMessages}       onChange={v => setAntispam(p => p && { ...p, maxMessages: v })}       min={2}  max={50}   />
              <NumInput label="Fenêtre (secondes)"           value={antispam.windowSeconds}     onChange={v => setAntispam(p => p && { ...p, windowSeconds: v })}     min={1}  max={60}   />
              <NumInput label="Timeout (minutes)"            value={antispam.timeoutMinutes}    onChange={v => setAntispam(p => p && { ...p, timeoutMinutes: v })}    min={1}  max={1440} />
              <NumInput label="Seuil violations pour timeout" value={antispam.violationThreshold} onChange={v => setAntispam(p => p && { ...p, violationThreshold: v })} min={1}  max={20}   />
            </div>
          </Card>
          <SaveBtn saving={saving} onClick={() => save("/api/antispam-config", antispam)} />
        </>
      )}

      {/* ── Anti-liens ── */}
      {tab === "antilink" && antilink && (
        <>
          <Card title="🔗 Filtres de liens">
            <div className="space-y-3">
              <Toggle value={antilink.enabled}              onChange={v => setAntilink(p => p && { ...p, enabled: v })}              label="Activer l'anti-liens" />
              <Toggle value={antilink.blockDiscordInvites}  onChange={v => setAntilink(p => p && { ...p, blockDiscordInvites: v })}  label="Bloquer les invitations Discord" />
              <Toggle value={antilink.blockExternalLinks}   onChange={v => setAntilink(p => p && { ...p, blockExternalLinks: v })}   label="Bloquer tous les liens externes" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="py-1">
                <label className="text-sm block mb-1">Action</label>
                <select value={antilink.action} onChange={e => setAntilink(p => p && { ...p, action: e.target.value })}
                  className="w-full px-3 py-1.5 rounded text-sm"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                  <option value="delete">🗑️ Supprimer uniquement</option>
                  <option value="delete_warn">🗑️ Supprimer + avertir</option>
                  <option value="delete_timeout">🗑️ Supprimer + timeout si seuil atteint</option>
                </select>
              </div>
              <NumInput label="Timeout (secondes)"           value={antilink.timeoutSeconds}    onChange={v => setAntilink(p => p && { ...p, timeoutSeconds: v })}    min={10} max={86400} />
              <NumInput label="Seuil violations pour timeout" value={antilink.violationThreshold} onChange={v => setAntilink(p => p && { ...p, violationThreshold: v })} min={1}  max={20}    />
            </div>
            {antilink.allowedDomains.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium mb-1">Domaines autorisés</p>
                <div className="flex flex-wrap gap-1">
                  {antilink.allowedDomains.map(d => (
                    <span key={d} className="px-2 py-0.5 rounded text-xs" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>{d}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <SaveBtn saving={saving} onClick={() => save("/api/antilink-config", antilink)} />
        </>
      )}

      {/* ── Liste des mots interdits ── */}
      {tab === "badwords" && (
        <div className="space-y-4">

          {/* Notification flash */}
          {bwMsg && (
            <div className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: bwMsg.type === "ok" ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)",
                color:      bwMsg.type === "ok" ? "#34d399"                : "#f87171",
                border:     `1px solid ${bwMsg.type === "ok" ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}>
              {bwMsg.text}
            </div>
          )}

          {/* ── Ajouter ── */}
          <div className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: "var(--primary)" }}>➕ Ajouter des mots</h3>
              <div className="flex gap-1">
                {(["single", "bulk"] as const).map(m => (
                  <button key={m} onClick={() => setAddMode(m)}
                    className="px-3 py-1 rounded text-xs font-medium cursor-pointer"
                    style={{ background: addMode === m ? "var(--primary)" : "var(--muted)", color: addMode === m ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
                    {m === "single" ? "Un mot" : "Plusieurs"}
                  </button>
                ))}
              </div>
            </div>

            {addMode === "single" ? (
              <div className="flex gap-2">
                <input value={newInput} onChange={e => setNewInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addSingle()}
                  placeholder="Tapez un mot ou une expression…"
                  className="flex-1 px-3 py-2 rounded text-sm"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                <button onClick={addSingle} className="px-4 py-2 rounded font-semibold text-sm cursor-pointer"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  Ajouter
                </button>
              </div>
            ) : (
              <>
                <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                  rows={5} placeholder={"Un mot par ligne, ou séparés par virgule/point-virgule :\nconnard\nsalope\nmerde\nfuck, shit, bitch"}
                  className="w-full px-3 py-2 rounded text-sm resize-y font-mono"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {bulkText.split(/[\n,;]+/).map(w => w.trim()).filter(Boolean).length} mot(s) détecté(s)
                  </span>
                  <button onClick={addBulk} className="px-4 py-2 rounded font-semibold text-sm cursor-pointer"
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                    Ajouter tout
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Barre de recherche + actions ── */}
          <div className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Recherche */}
              <div className="relative flex-1 min-w-48">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted-foreground)" }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un mot…"
                  className="w-full pl-8 pr-3 py-2 rounded text-sm"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                {search && (
                  <button onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100 cursor-pointer"
                    style={{ color: "var(--muted-foreground)" }}>✕</button>
                )}
              </div>

              {/* Compteur */}
              <span className="text-xs px-3 py-1.5 rounded" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                {search ? `${total} résultat(s)` : `${total} mot(s) au total`}
              </span>

              {/* Actions sur sélection */}
              {selected.size > 0 && (
                <button onClick={deleteSelected}
                  className="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                  🗑️ Supprimer {selected.size} sélectionné(s)
                </button>
              )}

              {/* Tout supprimer */}
              {!confirmClear ? (
                <button onClick={() => setConfirmClear(true)}
                  className="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                  🧹 Vider la liste
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "#f87171" }}>Confirmer ?</span>
                  <button onClick={clearAll} className="px-3 py-1 rounded text-xs font-semibold cursor-pointer"
                    style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}>Oui, tout supprimer</button>
                  <button onClick={() => setConfirmClear(false)} className="px-3 py-1 rounded text-xs cursor-pointer"
                    style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>Annuler</button>
                </div>
              )}
            </div>

            {/* En-tête du tableau */}
            {words.length > 0 && (
              <div className="flex items-center gap-3 px-3 py-2 rounded mb-1 text-xs font-semibold"
                style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                <input type="checkbox"
                  checked={selected.size === words.length && words.length > 0}
                  onChange={toggleSelectAll}
                  className="cursor-pointer" />
                <span className="flex-1">MOT / EXPRESSION</span>
                <span className="w-28 text-right hidden sm:block">AJOUTÉ PAR</span>
                <span className="w-24 text-right hidden md:block">DATE</span>
                <span className="w-10" />
              </div>
            )}

            {/* Liste */}
            {bwLoading ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>🔄 Chargement…</div>
            ) : words.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-3xl mb-2">{search ? "🔍" : "📭"}</div>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {search ? `Aucun résultat pour "${search}"` : "Aucun mot interdit configuré."}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {words.map(w => (
                  <div key={w._id}
                    onClick={() => toggleSelect(w._id)}
                    className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors"
                    style={{
                      background: selected.has(w._id) ? "rgba(var(--primary-rgb, 99,102,241),0.12)" : "transparent",
                      border: "1px solid " + (selected.has(w._id) ? "rgba(var(--primary-rgb, 99,102,241),0.3)" : "transparent"),
                    }}
                    onMouseEnter={e => { if (!selected.has(w._id)) (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                    onMouseLeave={e => { if (!selected.has(w._id)) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <input type="checkbox" checked={selected.has(w._id)} onChange={() => toggleSelect(w._id)}
                      onClick={e => e.stopPropagation()} className="cursor-pointer" />
                    <span className="flex-1 text-sm font-mono font-medium"
                      style={{ color: "var(--foreground)" }}>{w.word}</span>
                    <span className="w-28 text-xs text-right hidden sm:block"
                      style={{ color: "var(--muted-foreground)" }}>{w.addedBy || "—"}</span>
                    <span className="w-24 text-xs text-right hidden md:block"
                      style={{ color: "var(--muted-foreground)" }}>
                      {w.createdAt ? new Date(w.createdAt).toLocaleDateString("fr-FR") : "—"}
                    </span>
                    <button onClick={e => { e.stopPropagation(); deleteOne(w._id); }}
                      className="w-10 text-center text-xs opacity-40 hover:opacity-100 cursor-pointer transition-opacity"
                      style={{ color: "#f87171" }} title="Supprimer">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-4"
                style={{ borderTop: "1px solid var(--border)" }}>
                <button onClick={() => setPage(0)} disabled={page === 0}
                  className="px-2 py-1 rounded text-xs cursor-pointer disabled:opacity-30"
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>⏮</button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded text-xs cursor-pointer disabled:opacity-30"
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>← Préc.</button>
                <span className="text-xs px-3" style={{ color: "var(--muted-foreground)" }}>
                  Page {page + 1} / {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded text-xs cursor-pointer disabled:opacity-30"
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>Suiv. →</button>
                <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                  className="px-2 py-1 rounded text-xs cursor-pointer disabled:opacity-30"
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>⏭</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
