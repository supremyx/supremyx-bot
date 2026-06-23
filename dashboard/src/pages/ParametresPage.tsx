import { useState, useEffect } from "react";
import { apiUrl } from "../lib/api";

const LS_KEY = "supremyx_api_key";

export default function ParametresPage() {
  const [storedKey, setStoredKey] = useState<string>(() => localStorage.getItem(LS_KEY) ?? "");
  const [inputKey, setInputKey]   = useState<string>(() => localStorage.getItem(LS_KEY) ?? "");
  const [show, setShow]           = useState(false);
  const [copied, setCopied]       = useState(false);
  const [status, setStatus]       = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [serverKey, setServerKey] = useState<string | null>(null);
  const [keyLength, setKeyLength] = useState<number | null>(null);

  useEffect(() => {
    if (storedKey) verify(storedKey);
  }, []);

  async function verify(key: string) {
    setStatus("loading");
    setServerKey(null);
    try {
      const res = await fetch(apiUrl("/api/admin/config"), {
        headers: { "x-api-key": key },
      });
      if (!res.ok) throw new Error("invalid");
      const data = await res.json();
      setServerKey(data.botApiKey);
      setKeyLength(data.keyLength);
      setStatus("ok");
    } catch {
      setStatus("error");
      setServerKey(null);
    }
  }

  function save() {
    const trimmed = inputKey.trim();
    localStorage.setItem(LS_KEY, trimmed);
    setStoredKey(trimmed);
    verify(trimmed);
  }

  function clear() {
    localStorage.removeItem(LS_KEY);
    setStoredKey("");
    setInputKey("");
    setServerKey(null);
    setStatus("idle");
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const displayKey = show ? (serverKey ?? storedKey) : (
    storedKey.length > 8
      ? storedKey.slice(0, 4) + "••••••••••••••••••••••••" + storedKey.slice(-4)
      : "••••••••"
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
          ⚙️ Paramètres
        </h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Configuration du dashboard et clé d'accès à l'API SUPREMYX.
        </p>
      </div>

      {/* BOT_API_KEY card */}
      <div className="rounded-xl p-6 mb-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🔑</span>
          <h2 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>BOT_API_KEY</h2>
          {status === "ok" && (
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>
              ✓ Vérifié
            </span>
          )}
          {status === "error" && (
            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>
              ✗ Clé invalide
            </span>
          )}
          {status === "loading" && (
            <span className="ml-auto text-xs" style={{ color: "var(--muted-foreground)" }}>Vérification…</span>
          )}
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          Clé secrète utilisée pour les appels protégés entre le dashboard et l'API du bot.
          Elle est stockée localement dans votre navigateur.
        </p>

        {/* Key display (when saved) */}
        {storedKey && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg font-mono text-sm break-all" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}>
            <span className="flex-1" style={{ color: status === "ok" ? "#34d399" : status === "error" ? "#f87171" : "var(--foreground)" }}>
              {displayKey}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                data-testid="button-toggle-show"
                onClick={() => setShow(s => !s)}
                className="px-2 py-1 rounded text-xs transition-colors cursor-pointer"
                style={{ background: "rgba(212,150,58,0.1)", color: "var(--primary)" }}
                title={show ? "Masquer" : "Afficher"}
              >
                {show ? "🙈" : "👁️"}
              </button>
              <button
                data-testid="button-copy-key"
                onClick={() => copy(serverKey ?? storedKey)}
                className="px-2 py-1 rounded text-xs transition-colors cursor-pointer"
                style={{ background: copied ? "rgba(52,211,153,0.15)" : "rgba(212,150,58,0.1)", color: copied ? "#34d399" : "var(--primary)" }}
              >
                {copied ? "✓ Copié" : "📋 Copier"}
              </button>
            </div>
          </div>
        )}

        {keyLength !== null && status === "ok" && (
          <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
            Longueur : <strong>{keyLength}</strong> caractères
          </p>
        )}

        {/* Input to enter / change key */}
        <div className="flex gap-2">
          <input
            data-testid="input-api-key"
            type="password"
            value={inputKey}
            onChange={e => setInputKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && save()}
            placeholder="Colle ta BOT_API_KEY ici…"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <button
            data-testid="button-save-key"
            onClick={save}
            disabled={!inputKey.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40"
            style={{ background: "rgba(212,150,58,0.2)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}
          >
            Enregistrer
          </button>
          {storedKey && (
            <button
              data-testid="button-clear-key"
              onClick={clear}
              className="px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer"
              style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
              title="Supprimer la clé"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl p-5 text-sm" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
        <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>📌 Comment obtenir la clé ?</h3>
        <ol className="space-y-1.5 list-decimal list-inside" style={{ color: "var(--muted-foreground)" }}>
          <li>Va dans les <strong>Secrets Replit</strong> de ton projet (icône 🔒).</li>
          <li>Copie la valeur de <code className="px-1 py-0.5 rounded text-xs" style={{ background: "rgba(0,0,0,0.3)" }}>BOT_API_KEY</code>.</li>
          <li>Colle-la dans le champ ci-dessus et clique <strong>Enregistrer</strong>.</li>
        </ol>
      </div>
    </main>
  );
}
