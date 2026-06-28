import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "../lib/api";

const LS_KEY = "supremyx_api_key";

type SaveState = "idle" | "saving" | "ok" | "error";

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "saving") return <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Enregistrement…</span>;
  if (state === "ok") return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>✓ Sauvegardé</span>;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>✗ Erreur</span>;
}

interface BotConfig {
  pointSystem: Record<string, number>;
  killBonus: number;
  motd: string;
  announceChannelId: string;
  logChannelId: string;
  logoSubmitChannelId: string;
  logoListChannelId: string;
  rankFrozen: boolean;
  rankFrozenBy: string;
}

interface IaConfig {
  guildId: string;
  model: string;
  dailyQuota: number;
  debriefChannelId: string;
  bilanChannelId: string;
  quotaAlertChannelId: string;
}

const IA_MODELS = [
  { alias: "gpt-4o-mini",   label: "GPT-4o Mini",      emoji: "🟢", provider: "OpenAI" },
  { alias: "gpt-4o",        label: "GPT-4o",            emoji: "🔵", provider: "OpenAI" },
  { alias: "claude-haiku",  label: "Claude 3.5 Haiku",  emoji: "🟣", provider: "Anthropic" },
  { alias: "claude-sonnet", label: "Claude 3.5 Sonnet", emoji: "🟤", provider: "Anthropic" },
  { alias: "gemini-flash",  label: "Gemini 2.0 Flash",  emoji: "🔴", provider: "Google" },
  { alias: "mistral",       label: "Mistral 7B",        emoji: "⚪", provider: "Mistral" },
  { alias: "llama",         label: "LLaMA 3.1 8B",      emoji: "🟡", provider: "Meta" },
];

const POSITIONS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export default function ParametresPage() {
  const [storedKey, setStoredKey] = useState<string>(() => localStorage.getItem(LS_KEY) ?? "");
  const [inputKey, setInputKey]   = useState<string>(() => localStorage.getItem(LS_KEY) ?? "");
  const [showKey, setShowKey]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const [botConfig, setBotConfig]     = useState<BotConfig | null>(null);
  const [botDraft, setBotDraft]       = useState<BotConfig | null>(null);
  const [botSave, setBotSave]         = useState<SaveState>("idle");

  const [iaConfigs, setIaConfigs]     = useState<IaConfig[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [iaDraft, setIaDraft]         = useState<Partial<IaConfig>>({});
  const [iaSave, setIaSave]           = useState<SaveState>("idle");
  const [newGuildId, setNewGuildId]   = useState("");

  const apiKey = storedKey;

  const fetchBotConfig = useCallback(async (key: string) => {
    try {
      const res = await fetch(apiUrl("/api/bot/config"), { headers: { "x-api-key": key } });
      if (!res.ok) return;
      const data = await res.json();
      setBotConfig(data);
      setBotDraft(data);
    } catch { /* silent */ }
  }, []);

  const fetchIaConfig = useCallback(async (key: string) => {
    try {
      const res = await fetch(apiUrl("/api/ia/config"), { headers: { "x-api-key": key } });
      if (!res.ok) return;
      const data = await res.json();
      const configs: IaConfig[] = (data.configs ?? []).map((c: IaConfig) => ({
        guildId: c.guildId,
        model: c.model ?? "gpt-4o-mini",
        dailyQuota: c.dailyQuota ?? 0,
        debriefChannelId: c.debriefChannelId ?? "",
        bilanChannelId: c.bilanChannelId ?? "",
        quotaAlertChannelId: c.quotaAlertChannelId ?? "",
      }));
      setIaConfigs(configs);
      if (configs.length > 0 && !selectedGuild) {
        setSelectedGuild(configs[0].guildId);
        setIaDraft(configs[0]);
      }
    } catch { /* silent */ }
  }, [selectedGuild]);

  async function verifyKey(key: string) {
    setKeyStatus("loading");
    try {
      const res = await fetch(apiUrl("/api/admin/config"), { headers: { "x-api-key": key } });
      if (!res.ok) throw new Error("invalid");
      setKeyStatus("ok");
      fetchBotConfig(key);
      fetchIaConfig(key);
    } catch {
      setKeyStatus("error");
    }
  }

  useEffect(() => {
    if (storedKey) verifyKey(storedKey);
  }, []);

  function saveKey() {
    const trimmed = inputKey.trim();
    localStorage.setItem(LS_KEY, trimmed);
    setStoredKey(trimmed);
    verifyKey(trimmed);
  }

  function clearKey() {
    localStorage.removeItem(LS_KEY);
    setStoredKey(""); setInputKey("");
    setBotConfig(null); setBotDraft(null);
    setIaConfigs([]); setIaDraft({});
    setKeyStatus("idle");
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function saveBotConfig() {
    if (!botDraft || !apiKey) return;
    setBotSave("saving");
    try {
      const res = await fetch(apiUrl("/api/bot/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(botDraft),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBotConfig(data.config);
      setBotDraft(data.config);
      setBotSave("ok");
    } catch {
      setBotSave("error");
    } finally {
      setTimeout(() => setBotSave("idle"), 3000);
    }
  }

  async function saveIaConfig() {
    if (!iaDraft.guildId || !apiKey) return;
    setIaSave("saving");
    try {
      const res = await fetch(apiUrl("/api/ia/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(iaDraft),
      });
      if (!res.ok) throw new Error();
      await res.json();
      await fetchIaConfig(apiKey);
      setIaSave("ok");
    } catch {
      setIaSave("error");
    } finally {
      setTimeout(() => setIaSave("idle"), 3000);
    }
  }

  function selectGuild(guildId: string) {
    setSelectedGuild(guildId);
    const found = iaConfigs.find(c => c.guildId === guildId);
    setIaDraft(found ?? { guildId, model: "gpt-4o-mini", dailyQuota: 0, debriefChannelId: "", bilanChannelId: "", quotaAlertChannelId: "" });
  }

  function addGuild() {
    const id = newGuildId.trim();
    if (!id) return;
    const draft: IaConfig = { guildId: id, model: "gpt-4o-mini", dailyQuota: 0, debriefChannelId: "", bilanChannelId: "", quotaAlertChannelId: "" };
    setIaConfigs(prev => [...prev.filter(c => c.guildId !== id), draft]);
    setSelectedGuild(id);
    setIaDraft(draft);
    setNewGuildId("");
  }

  const isAuthenticated = keyStatus === "ok";
  const displayKey = showKey ? storedKey : (
    storedKey.length > 8
      ? storedKey.slice(0, 4) + "••••••••••••••••••••••••" + storedKey.slice(-4)
      : "••••••••"
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>⚙️ Paramètres</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Configuration du dashboard, du bot et de l'IA SUPREMYX.
        </p>
      </div>

      {/* ── Section 1 : Clé API ─────────────────────────────────────────────── */}
      <section className="rounded-xl p-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🔑</span>
          <h2 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>BOT_API_KEY</h2>
          {keyStatus === "ok" && <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399" }}>✓ Vérifié</span>}
          {keyStatus === "error" && <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>✗ Clé invalide</span>}
          {keyStatus === "loading" && <span className="ml-auto text-xs" style={{ color: "var(--muted-foreground)" }}>Vérification…</span>}
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          Clé secrète pour les appels protégés entre le dashboard et l'API du bot. Stockée localement.
        </p>

        {storedKey && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg font-mono text-sm break-all" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}>
            <span className="flex-1" style={{ color: keyStatus === "ok" ? "#34d399" : keyStatus === "error" ? "#f87171" : "var(--foreground)" }}>
              {displayKey}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button data-testid="button-toggle-show" onClick={() => setShowKey(s => !s)}
                className="px-2 py-1 rounded text-xs cursor-pointer" style={{ background: "rgba(212,150,58,0.1)", color: "var(--primary)" }}>
                {showKey ? "🙈" : "👁️"}
              </button>
              <button data-testid="button-copy-key" onClick={() => copy(storedKey)}
                className="px-2 py-1 rounded text-xs cursor-pointer" style={{ background: copied ? "rgba(52,211,153,0.15)" : "rgba(212,150,58,0.1)", color: copied ? "#34d399" : "var(--primary)" }}>
                {copied ? "✓ Copié" : "📋 Copier"}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input data-testid="input-api-key" type="password" value={inputKey}
            onChange={e => setInputKey(e.target.value)} onKeyDown={e => e.key === "Enter" && saveKey()}
            placeholder="Colle ta BOT_API_KEY ici…"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
          <button data-testid="button-save-key" onClick={saveKey} disabled={!inputKey.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-40"
            style={{ background: "rgba(212,150,58,0.2)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}>
            Enregistrer
          </button>
          {storedKey && (
            <button data-testid="button-clear-key" onClick={clearKey}
              className="px-3 py-2 rounded-lg text-sm cursor-pointer"
              style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
              🗑️
            </button>
          )}
        </div>
      </section>

      {/* ── Sections protégées (visibles si clé valide) ─────────────────────── */}
      {!isAuthenticated && (
        <div className="rounded-xl p-6 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            🔒 Entre ta <strong>BOT_API_KEY</strong> ci-dessus pour accéder aux paramètres avancés.
          </p>
        </div>
      )}

      {isAuthenticated && botDraft && (
        <>
          {/* ── Section 2 : Système de points ─────────────────────────────── */}
          <section className="rounded-xl p-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <h2 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Système de points</h2>
              </div>
              <SaveBadge state={botSave} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {POSITIONS.map(pos => (
                <div key={pos} className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)" }}>
                  <label className="block text-xs mb-1.5 font-semibold" style={{ color: "var(--muted-foreground)" }}>
                    🥇 Place {pos}
                  </label>
                  <input
                    data-testid={`input-points-pos-${pos}`}
                    type="number" min={0} max={100}
                    value={botDraft.pointSystem?.[pos] ?? ""}
                    onChange={e => setBotDraft(d => d ? {
                      ...d,
                      pointSystem: { ...d.pointSystem, [pos]: Number(e.target.value) }
                    } : d)}
                    className="w-full px-2 py-1.5 rounded text-sm font-bold outline-none text-center"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--primary)" }}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 rounded-lg p-3" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)" }}>
                <label className="block text-xs mb-1.5 font-semibold" style={{ color: "var(--muted-foreground)" }}>💀 Bonus par kill</label>
                <input
                  data-testid="input-kill-bonus"
                  type="number" min={0} max={10} step={0.5}
                  value={botDraft.killBonus ?? 1}
                  onChange={e => setBotDraft(d => d ? { ...d, killBonus: Number(e.target.value) } : d)}
                  className="w-full px-2 py-1.5 rounded text-sm font-bold outline-none text-center"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "#f87171" }}
                />
              </div>
              <div className="flex-1 rounded-lg p-3" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)" }}>
                <label className="block text-xs mb-1.5 font-semibold" style={{ color: "var(--muted-foreground)" }}>❄️ Classement gelé</label>
                <button
                  data-testid="button-toggle-frozen"
                  onClick={() => setBotDraft(d => d ? { ...d, rankFrozen: !d.rankFrozen } : d)}
                  className="w-full py-1.5 rounded text-sm font-bold cursor-pointer transition-colors"
                  style={{
                    background: botDraft.rankFrozen ? "rgba(147,197,253,0.15)" : "rgba(0,0,0,0.3)",
                    border: `1px solid ${botDraft.rankFrozen ? "rgba(147,197,253,0.4)" : "var(--border)"}`,
                    color: botDraft.rankFrozen ? "#93c5fd" : "var(--muted-foreground)",
                  }}>
                  {botDraft.rankFrozen ? "❄️ Gelé" : "▶️ Actif"}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs mb-1.5 font-semibold" style={{ color: "var(--muted-foreground)" }}>📢 Message du jour (MOTD)</label>
              <input
                data-testid="input-motd"
                type="text"
                value={botDraft.motd ?? ""}
                onChange={e => setBotDraft(d => d ? { ...d, motd: e.target.value } : d)}
                placeholder="Message affiché dans le classement…"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>

            <button data-testid="button-save-points" onClick={saveBotConfig}
              className="w-full py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
              style={{ background: "rgba(212,150,58,0.2)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}>
              💾 Sauvegarder les points
            </button>
          </section>

          {/* ── Section 3 : Canaux Discord ─────────────────────────────────── */}
          <section className="rounded-xl p-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📡</span>
                <h2 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Canaux Discord</h2>
              </div>
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>IDs des canaux</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {[
                { key: "announceChannelId",   label: "📢 Canal d'annonces",       placeholder: "123456789012345678" },
                { key: "logChannelId",         label: "📋 Canal de logs",           placeholder: "123456789012345678" },
                { key: "logoSubmitChannelId",  label: "🖼️ Canal soumission logos",  placeholder: "123456789012345678" },
                { key: "logoListChannelId",    label: "📌 Canal liste logos",        placeholder: "123456789012345678" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs mb-1.5 font-semibold" style={{ color: "var(--muted-foreground)" }}>{label}</label>
                  <input
                    data-testid={`input-channel-${key}`}
                    type="text"
                    value={(botDraft as Record<string, string | number | boolean | Record<string, number>>)[key] as string ?? ""}
                    onChange={e => setBotDraft(d => d ? { ...d, [key]: e.target.value } : d)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </div>
              ))}
            </div>

            <button data-testid="button-save-channels" onClick={saveBotConfig}
              className="w-full py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
              style={{ background: "rgba(212,150,58,0.2)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}>
              💾 Sauvegarder les canaux
            </button>
          </section>

          {/* ── Section 4 : Configuration IA ───────────────────────────────── */}
          <section className="rounded-xl p-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧠</span>
                <h2 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>Configuration IA</h2>
              </div>
              <SaveBadge state={iaSave} />
            </div>

            {/* Guild selector */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex flex-wrap gap-2 flex-1">
                {iaConfigs.map(c => (
                  <button key={c.guildId}
                    data-testid={`button-guild-${c.guildId}`}
                    onClick={() => selectGuild(c.guildId)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    style={{
                      background: selectedGuild === c.guildId ? "rgba(212,150,58,0.2)" : "rgba(0,0,0,0.2)",
                      border: `1px solid ${selectedGuild === c.guildId ? "rgba(212,150,58,0.4)" : "var(--border)"}`,
                      color: selectedGuild === c.guildId ? "var(--primary)" : "var(--muted-foreground)",
                    }}>
                    {c.guildId}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <input
                  data-testid="input-new-guild-id"
                  type="text" value={newGuildId}
                  onChange={e => setNewGuildId(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addGuild()}
                  placeholder="Nouveau Guild ID…"
                  className="px-2 py-1.5 rounded text-xs font-mono outline-none w-40"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
                <button data-testid="button-add-guild" onClick={addGuild}
                  className="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
                  style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                  + Ajouter
                </button>
              </div>
            </div>

            {iaDraft.guildId ? (
              <>
                {/* Model selection */}
                <div className="mb-4">
                  <label className="block text-xs mb-2 font-semibold" style={{ color: "var(--muted-foreground)" }}>🤖 Modèle IA</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {IA_MODELS.map(m => (
                      <button key={m.alias}
                        data-testid={`button-model-${m.alias}`}
                        onClick={() => setIaDraft(d => ({ ...d, model: m.alias }))}
                        className="p-2.5 rounded-lg text-left cursor-pointer transition-colors"
                        style={{
                          background: iaDraft.model === m.alias ? "rgba(212,150,58,0.15)" : "rgba(0,0,0,0.2)",
                          border: `1px solid ${iaDraft.model === m.alias ? "rgba(212,150,58,0.4)" : "var(--border)"}`,
                        }}>
                        <div className="text-sm">{m.emoji} <span className="font-semibold" style={{ color: iaDraft.model === m.alias ? "var(--primary)" : "var(--foreground)" }}>{m.label}</span></div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{m.provider}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quota + channels */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <div>
                    <label className="block text-xs mb-1.5 font-semibold" style={{ color: "var(--muted-foreground)" }}>📈 Quota journalier (0 = illimité)</label>
                    <input
                      data-testid="input-daily-quota"
                      type="number" min={0}
                      value={iaDraft.dailyQuota ?? 0}
                      onChange={e => setIaDraft(d => ({ ...d, dailyQuota: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5 font-semibold" style={{ color: "var(--muted-foreground)" }}>🔔 Canal alerte quota</label>
                    <input
                      data-testid="input-quota-alert-channel"
                      type="text" placeholder="ID du canal…"
                      value={iaDraft.quotaAlertChannelId ?? ""}
                      onChange={e => setIaDraft(d => ({ ...d, quotaAlertChannelId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5 font-semibold" style={{ color: "var(--muted-foreground)" }}>📊 Canal debriefs IA</label>
                    <input
                      data-testid="input-debrief-channel"
                      type="text" placeholder="ID du canal…"
                      value={iaDraft.debriefChannelId ?? ""}
                      onChange={e => setIaDraft(d => ({ ...d, debriefChannelId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5 font-semibold" style={{ color: "var(--muted-foreground)" }}>📋 Canal bilans hebdo</label>
                    <input
                      data-testid="input-bilan-channel"
                      type="text" placeholder="ID du canal…"
                      value={iaDraft.bilanChannelId ?? ""}
                      onChange={e => setIaDraft(d => ({ ...d, bilanChannelId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    />
                  </div>
                </div>

                <button data-testid="button-save-ia" onClick={saveIaConfig}
                  className="w-full py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
                  style={{ background: "rgba(212,150,58,0.2)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}>
                  💾 Sauvegarder la config IA
                </button>
              </>
            ) : (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                Ajoute un Guild ID ci-dessus pour configurer l'IA.
              </div>
            )}
          </section>

          {/* ── Info card ───────────────────────────────────────────────────── */}
          <section className="rounded-xl p-5 text-sm" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <h3 className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>📌 Comment trouver les IDs Discord ?</h3>
            <ol className="space-y-1.5 list-decimal list-inside" style={{ color: "var(--muted-foreground)" }}>
              <li>Active le <strong>mode développeur</strong> dans Discord (Paramètres → Avancé → Mode développeur).</li>
              <li>Fais un <strong>clic droit</strong> sur un canal ou un serveur.</li>
              <li>Clique sur <strong>Copier l'identifiant</strong>.</li>
              <li>Colle l'ID dans le champ correspondant ci-dessus.</li>
            </ol>
          </section>
        </>
      )}
    </main>
  );
}
