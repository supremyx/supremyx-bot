import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface AutomodCfg {
  enabled: boolean;
  autoDelete: boolean;
  autoTimeout: boolean;
  timeoutMinutes: number;
  violationThreshold: number;
  exemptRoles: string[];
  exemptChannels: string[];
}

interface AntiLinkCfg {
  enabled: boolean;
  blockDiscordInvites: boolean;
  blockExternalLinks: boolean;
  allowedDomains: string[];
  action: string;
  timeoutSeconds: number;
  violationThreshold: number;
}

interface AntispamCfg {
  enabled: boolean;
  maxMessages: number;
  windowSeconds: number;
  autoDelete: boolean;
  autoTimeout: boolean;
  timeoutMinutes: number;
  violationThreshold: number;
}

interface BadWord { _id: string; word: string; guildId?: string; }

const API_KEY = import.meta.env.VITE_BOT_API_KEY || "";
const HEADERS = { "Content-Type": "application/json", "x-api-key": API_KEY };

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{ background: value ? "var(--primary)" : "var(--muted)" }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{ background: "white", left: value ? "calc(100% - 22px)" : "2px" }}
        />
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
      <input
        type="number" value={value} min={min} max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="w-24 px-2 py-1 rounded text-sm text-right"
        style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      />
    </div>
  );
}

export default function AutoModPage() {
  const [tab, setTab]             = useState<"automod"|"antispam"|"antilink"|"badwords">("automod");
  const [automod, setAutomod]     = useState<AutomodCfg | null>(null);
  const [antispam, setAntispam]   = useState<AntispamCfg | null>(null);
  const [antilink, setAntilink]   = useState<AntiLinkCfg | null>(null);
  const [badwords, setBadwords]   = useState<BadWord[]>([]);
  const [newWord, setNewWord]     = useState("");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(apiUrl("/api/automod-config")).then(r => r.json()).catch(() => null),
      fetch(apiUrl("/api/antispam-config")).then(r => r.json()).catch(() => null),
      fetch(apiUrl("/api/antilink-config")).then(r => r.json()).catch(() => null),
      fetch(apiUrl("/api/badwords")).then(r => r.json()).catch(() => ({ words: [] })),
    ]).then(([am, as_, al, bw]) => {
      if (am?.config) setAutomod(am.config);
      if (as_?.config) setAntispam(as_.config);
      if (al?.config) setAntilink(al.config);
      setBadwords(bw?.words || []);
    }).finally(() => setLoading(false));
  }, []);

  const save = async (endpoint: string, data: object) => {
    setSaving(true);
    await fetch(apiUrl(endpoint), { method: "POST", headers: HEADERS, body: JSON.stringify(data) }).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addWord = async () => {
    if (!newWord.trim()) return;
    await fetch(apiUrl("/api/badwords"), { method: "POST", headers: HEADERS, body: JSON.stringify({ word: newWord.trim() }) });
    const r = await fetch(apiUrl("/api/badwords")).then(r => r.json());
    setBadwords(r.words || []);
    setNewWord("");
  };

  const removeWord = async (id: string) => {
    await fetch(apiUrl(`/api/badwords/${id}`), { method: "DELETE", headers: HEADERS });
    setBadwords(prev => prev.filter(w => w._id !== id));
  };

  const tabs = [
    { key: "automod",   label: "🚨 Mots Interdits" },
    { key: "antispam",  label: "⏱️ Anti-Spam" },
    { key: "antilink",  label: "🔗 Anti-Liens" },
    { key: "badwords",  label: "📝 Liste des mots" },
  ] as const;

  if (loading) return (
    <div className="p-8 text-center" style={{ color: "var(--muted-foreground)" }}>
      <div className="text-3xl mb-2">🔄</div>
      <p>Chargement de la configuration...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">🛡️ AutoMod Avancé</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Filtres anti-insultes, anti-spam et anti-liens avec détection automatique et sanctions graduelles.
        </p>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
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

      {/* Automod Tab */}
      {tab === "automod" && automod && (
        <>
          <Card title="🚨 Détection de mots interdits">
            <div className="space-y-3">
              <Toggle value={automod.enabled} onChange={v => setAutomod(p => p && { ...p, enabled: v })} label="Activer l'automod" />
              <Toggle value={automod.autoDelete} onChange={v => setAutomod(p => p && { ...p, autoDelete: v })} label="Supprimer automatiquement le message" />
              <Toggle value={automod.autoTimeout} onChange={v => setAutomod(p => p && { ...p, autoTimeout: v })} label="Timeout automatique (après seuil violations)" />
            </div>
            <div className="mt-4 space-y-2">
              <NumInput label="Timeout (minutes)" value={automod.timeoutMinutes} onChange={v => setAutomod(p => p && { ...p, timeoutMinutes: v })} min={1} max={1440} />
              <NumInput label="Seuil violations pour timeout" value={automod.violationThreshold} onChange={v => setAutomod(p => p && { ...p, violationThreshold: v })} min={1} max={20} />
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
              Les violations sont comptées sur 24h par utilisateur. Au-delà du seuil, le timeout s'applique si activé.
            </p>
          </Card>
          <button
            onClick={() => save("/api/automod-config", automod)}
            disabled={saving}
            className="px-5 py-2 rounded-lg font-semibold text-sm cursor-pointer"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Sauvegarde..." : "💾 Sauvegarder"}
          </button>
        </>
      )}

      {/* Antispam Tab */}
      {tab === "antispam" && antispam && (
        <>
          <Card title="⏱️ Détection de spam">
            <div className="space-y-3">
              <Toggle value={antispam.enabled} onChange={v => setAntispam(p => p && { ...p, enabled: v })} label="Activer l'anti-spam" />
              <Toggle value={antispam.autoDelete} onChange={v => setAntispam(p => p && { ...p, autoDelete: v })} label="Supprimer les messages spam" />
              <Toggle value={antispam.autoTimeout} onChange={v => setAntispam(p => p && { ...p, autoTimeout: v })} label="Timeout automatique (après seuil violations)" />
            </div>
            <div className="mt-4 space-y-2">
              <NumInput label="Messages max par fenêtre" value={antispam.maxMessages} onChange={v => setAntispam(p => p && { ...p, maxMessages: v })} min={2} max={50} />
              <NumInput label="Fenêtre (secondes)" value={antispam.windowSeconds} onChange={v => setAntispam(p => p && { ...p, windowSeconds: v })} min={1} max={60} />
              <NumInput label="Timeout (minutes)" value={antispam.timeoutMinutes} onChange={v => setAntispam(p => p && { ...p, timeoutMinutes: v })} min={1} max={1440} />
              <NumInput label="Seuil violations pour timeout" value={antispam.violationThreshold} onChange={v => setAntispam(p => p && { ...p, violationThreshold: v })} min={1} max={20} />
            </div>
          </Card>
          <button
            onClick={() => save("/api/antispam-config", antispam)}
            disabled={saving}
            className="px-5 py-2 rounded-lg font-semibold text-sm cursor-pointer"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Sauvegarde..." : "💾 Sauvegarder"}
          </button>
        </>
      )}

      {/* Anti-link Tab */}
      {tab === "antilink" && antilink && (
        <>
          <Card title="🔗 Filtres de liens">
            <div className="space-y-3">
              <Toggle value={antilink.enabled} onChange={v => setAntilink(p => p && { ...p, enabled: v })} label="Activer l'anti-liens" />
              <Toggle value={antilink.blockDiscordInvites} onChange={v => setAntilink(p => p && { ...p, blockDiscordInvites: v })} label="Bloquer les invitations Discord" />
              <Toggle value={antilink.blockExternalLinks} onChange={v => setAntilink(p => p && { ...p, blockExternalLinks: v })} label="Bloquer tous les liens externes" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="py-1">
                <label className="text-sm block mb-1">Action</label>
                <select
                  value={antilink.action}
                  onChange={e => setAntilink(p => p && { ...p, action: e.target.value })}
                  className="w-full px-3 py-1.5 rounded text-sm"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                  <option value="delete">🗑️ Supprimer uniquement</option>
                  <option value="delete_warn">🗑️ Supprimer + avertir</option>
                  <option value="delete_timeout">🗑️ Supprimer + timeout (si seuil atteint)</option>
                </select>
              </div>
              <NumInput label="Timeout (secondes)" value={antilink.timeoutSeconds} onChange={v => setAntilink(p => p && { ...p, timeoutSeconds: v })} min={10} max={86400} />
              <NumInput label="Seuil violations pour timeout" value={antilink.violationThreshold} onChange={v => setAntilink(p => p && { ...p, violationThreshold: v })} min={1} max={20} />
            </div>
            <div className="mt-4">
              <p className="text-xs mb-1 font-medium">Domaines autorisés (whitelist)</p>
              <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
                {antilink.allowedDomains.length ? antilink.allowedDomains.join(", ") : "Aucun"}
              </p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Gérez les domaines autorisés avec <code>!antilink domaine ajouter/retirer</code></p>
            </div>
          </Card>
          <button
            onClick={() => save("/api/antilink-config", antilink)}
            disabled={saving}
            className="px-5 py-2 rounded-lg font-semibold text-sm cursor-pointer"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Sauvegarde..." : "💾 Sauvegarder"}
          </button>
        </>
      )}

      {/* Bad words Tab */}
      {tab === "badwords" && (
        <>
          <Card title="📝 Mots interdits">
            <div className="flex gap-2 mb-4">
              <input
                value={newWord}
                onChange={e => setNewWord(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addWord()}
                placeholder="Ajouter un mot..."
                className="flex-1 px-3 py-1.5 rounded text-sm"
                style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
              <button onClick={addWord}
                className="px-4 py-1.5 rounded text-sm font-semibold cursor-pointer"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                Ajouter
              </button>
            </div>
            {badwords.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>Aucun mot interdit configuré.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {badwords.map(w => (
                  <span key={w._id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: "rgba(237,66,69,0.15)", color: "#f87171", border: "1px solid rgba(237,66,69,0.3)" }}>
                    {w.word}
                    <button onClick={() => removeWord(w._id)} className="ml-1 opacity-70 hover:opacity-100 cursor-pointer">✕</button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {badwords.length} mot{badwords.length !== 1 ? "s" : ""} · Mots par défaut inclus si aucun configuré
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
