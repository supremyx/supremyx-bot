import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "../lib/api";

interface Backup {
  _id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  restoredAt: string | null;
}

const API_KEY = import.meta.env.VITE_BOT_API_KEY || "";
const HEADERS = { "Content-Type": "application/json", "x-api-key": API_KEY };

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function BackupPage() {
  const [backups, setBackups]     = useState<Backup[]>([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [newName, setNewName]     = useState("");
  const [confirm, setConfirm]     = useState<string | null>(null);
  const [message, setMessage]     = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(apiUrl("/api/backup"), { headers: HEADERS }).then(r => r.json()).catch(() => ({ backups: [] }));
    setBackups(r.backups || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const create = async () => {
    setCreating(true);
    const name = newName.trim() || `Sauvegarde ${new Date().toLocaleString("fr-FR")}`;
    const r = await fetch(apiUrl("/api/backup"), {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ name, createdBy: "Dashboard" }),
    }).then(r => r.json()).catch(() => ({ error: "Erreur réseau" }));
    if (r.error) flash("err", r.error);
    else { flash("ok", `✅ Sauvegarde "${name}" créée`); setNewName(""); load(); }
    setCreating(false);
  };

  const restore = async (id: string) => {
    if (confirm !== id) { setConfirm(id); return; }
    setConfirm(null);
    setRestoring(id);
    const r = await fetch(apiUrl(`/api/backup/${id}/restore`), {
      method: "POST", headers: HEADERS,
      body: JSON.stringify({ restoredBy: "Dashboard" }),
    }).then(r => r.json()).catch(() => ({ error: "Erreur réseau" }));
    if (r.error) flash("err", r.error);
    else flash("ok", "✅ Restauration effectuée avec succès");
    setRestoring(null);
    load();
  };

  const remove = async (id: string) => {
    await fetch(apiUrl(`/api/backup/${id}`), { method: "DELETE", headers: HEADERS });
    setBackups(prev => prev.filter(b => b._id !== id));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">💾 Sauvegarde & Restauration</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Snapshots complets de la configuration du serveur — automod, anti-spam, anti-raid, rôles automatiques, niveaux, etc.
        </p>
      </div>

      {message && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: message.type === "ok" ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)",
            color: message.type === "ok" ? "#34d399" : "#f87171",
            border: `1px solid ${message.type === "ok" ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}>
          {message.text}
        </div>
      )}

      {/* Create backup */}
      <div className="rounded-xl p-5 mb-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
        <h3 className="font-bold text-sm mb-3" style={{ color: "var(--primary)" }}>📦 Nouvelle sauvegarde</h3>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && create()}
            placeholder={`Sauvegarde ${new Date().toLocaleDateString("fr-FR")}`}
            className="flex-1 px-3 py-2 rounded text-sm"
            style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
          <button onClick={create} disabled={creating}
            className="px-5 py-2 rounded-lg font-semibold text-sm cursor-pointer"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: creating ? 0.6 : 1 }}>
            {creating ? "⏳ Création..." : "💾 Créer"}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
          Inclut : AutoMod, Anti-Spam, Anti-Liens, Anti-Raid, Bienvenue, Autorôle, Niveaux, Dashboard, et autres configurations.
        </p>
      </div>

      {/* Backup list */}
      <h3 className="font-bold text-sm mb-3">🗂️ Sauvegardes ({backups.length})</h3>
      {loading ? (
        <div className="text-center py-10" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">🔄</div><p>Chargement...</p>
        </div>
      ) : backups.length === 0 ? (
        <div className="text-center py-10 rounded-xl" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">📂</div>
          <p>Aucune sauvegarde. Créez-en une ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {backups.map(b => (
            <div key={b._id} className="rounded-xl p-4 flex items-center gap-4"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <div className="text-2xl">💾</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{b.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  Créée le {fmtDate(b.createdAt)} par {b.createdBy}
                  {b.restoredAt && <span className="ml-2 text-amber-400">· Restaurée le {fmtDate(b.restoredAt)}</span>}
                </p>
                <p className="text-xs font-mono opacity-40">ID: {b._id.slice(-8)}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => restore(b._id)}
                  disabled={restoring === b._id}
                  className="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors"
                  style={{
                    background: confirm === b._id ? "rgba(239,68,68,0.2)" : "rgba(88,101,242,0.15)",
                    color: confirm === b._id ? "#f87171" : "#93c5fd",
                    border: `1px solid ${confirm === b._id ? "rgba(239,68,68,0.4)" : "rgba(88,101,242,0.4)"}`,
                  }}>
                  {restoring === b._id ? "⏳..." : confirm === b._id ? "⚠️ Confirmer" : "🔄 Restaurer"}
                </button>
                {confirm === b._id && (
                  <button onClick={() => setConfirm(null)}
                    className="px-2 py-1.5 rounded text-xs cursor-pointer"
                    style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
                    Annuler
                  </button>
                )}
                <button onClick={() => remove(b._id)}
                  className="px-2.5 py-1.5 rounded text-xs cursor-pointer"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
