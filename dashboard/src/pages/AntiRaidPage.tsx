import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "../lib/api";

interface AntiRaidCfg {
  enabled: boolean;
  joinThreshold: number;
  joinWindowSeconds: number;
  minAccountAgeDays: number;
  action: string;
  autoUnlockMinutes: number;
  lockdownActive: boolean;
  lockdownAt: string | null;
  lastRaidAt: string | null;
}

const API_KEY = import.meta.env.VITE_BOT_API_KEY || "";
const HEADERS = { "Content-Type": "application/json", "x-api-key": API_KEY };

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{ background: value ? "var(--primary)" : "var(--muted)" }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{ background: "white", left: value ? "calc(100% - 22px)" : "2px" }} />
      </div>
      <span className="text-sm">{label}</span>
    </label>
  );
}

export default function AntiRaidPage() {
  const [cfg, setCfg]     = useState<AntiRaidCfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(apiUrl("/api/antiraid-config")).then(r => r.json()).catch(() => null);
    if (r?.config) setCfg(r.config);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s to update lockdown status
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    await fetch(apiUrl("/api/antiraid-config"), { method: "POST", headers: HEADERS, body: JSON.stringify(cfg) }).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const unlock = async () => {
    setUnlocking(true);
    await fetch(apiUrl("/api/antiraid/unlock"), { method: "POST", headers: HEADERS }).catch(() => {});
    setTimeout(() => { setUnlocking(false); load(); }, 1500);
  };

  if (loading) return (
    <div className="p-8 text-center" style={{ color: "var(--muted-foreground)" }}>
      <div className="text-3xl mb-2">🔄</div>
      <p>Chargement...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">🛡️ Anti-Raid Avancé</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Détection automatique des raids, filtrage par âge de compte et actions graduelles.
        </p>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
          ✅ Configuration sauvegardée
        </div>
      )}

      {/* Lockdown status banner */}
      {cfg?.lockdownActive && (
        <div className="mb-5 px-4 py-3 rounded-xl flex items-center justify-between" style={{ background: "rgba(237,66,69,0.15)", border: "1px solid rgba(237,66,69,0.4)" }}>
          <div>
            <p className="font-bold text-red-400">🔒 Serveur en LOCKDOWN</p>
            <p className="text-xs text-red-300">Déclenché le {fmtDate(cfg.lockdownAt)}</p>
          </div>
          <button onClick={unlock} disabled={unlocking}
            className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer"
            style={{ background: "rgba(237,66,69,0.3)", color: "#fca5a5", border: "1px solid rgba(237,66,69,0.5)" }}>
            {unlocking ? "..." : "🔓 Déverrouiller"}
          </button>
        </div>
      )}

      {cfg && (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[
              { label: "Dernier raid", value: fmtDate(cfg.lastRaidAt), icon: "⚡" },
              { label: "Lockdown", value: cfg.lockdownActive ? "🔴 Actif" : "🟢 Inactif", icon: "🔒" },
              { label: "Statut système", value: cfg.enabled ? "✅ Actif" : "❌ Inactif", icon: "🛡️" },
            ].map(c => (
              <div key={c.label} className="rounded-xl p-3 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <div className="text-xl mb-1">{c.icon}</div>
                <div className="text-xs font-bold">{c.value}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Config form */}
          <div className="rounded-xl p-5 mb-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <h3 className="font-bold text-sm mb-4" style={{ color: "var(--primary)" }}>⚙️ Paramètres</h3>
            <div className="space-y-4">
              <Toggle value={cfg.enabled} onChange={v => setCfg(p => p && { ...p, enabled: v })} label="Activer l'anti-raid" />

              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { label: "Seuil d'arrivées", key: "joinThreshold" as const, min: 2, max: 100 },
                  { label: "Fenêtre (secondes)", key: "joinWindowSeconds" as const, min: 1, max: 60 },
                  { label: "Âge min. compte (jours)", key: "minAccountAgeDays" as const, min: 0, max: 365 },
                  { label: "Déverr. auto (minutes)", key: "autoUnlockMinutes" as const, min: 1, max: 1440 },
                ].map(({ label, key, min, max }) => (
                  <div key={key}>
                    <label className="text-xs block mb-1" style={{ color: "var(--muted-foreground)" }}>{label}</label>
                    <input type="number" min={min} max={max} value={cfg[key]}
                      onChange={e => setCfg(p => p && { ...p, [key]: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 rounded text-sm"
                      style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--muted-foreground)" }}>Action lors d'un raid</label>
                <select value={cfg.action} onChange={e => setCfg(p => p && { ...p, action: e.target.value })}
                  className="w-full px-3 py-1.5 rounded text-sm"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                  <option value="alert">📢 Alerte uniquement (log)</option>
                  <option value="kick">👢 Expulser les raiders</option>
                  <option value="ban">🔨 Bannir les raiders</option>
                  <option value="lockdown">🔒 Lockdown du serveur</option>
                </select>
              </div>

              <div className="pt-2 rounded-lg p-3 text-xs" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                <p className="font-semibold mb-1">ℹ️ Fonctionnement</p>
                <p>Si plus de <strong>{cfg.joinThreshold}</strong> personnes rejoignent en moins de <strong>{cfg.joinWindowSeconds}s</strong>, le raid est déclenché.</p>
                <p className="mt-1">Les comptes créés il y a moins de <strong>{cfg.minAccountAgeDays} jour(s)</strong> sont expulsés automatiquement à leur arrivée.</p>
              </div>
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="px-5 py-2 rounded-lg font-semibold text-sm cursor-pointer"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Sauvegarde..." : "💾 Sauvegarder"}
          </button>
        </>
      )}
    </div>
  );
}
