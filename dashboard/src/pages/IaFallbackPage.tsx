import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, CartesianGrid,
} from "recharts";
import { apiUrl } from "../lib/api";

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface ModelStat {
  model: string;
  total: number;
  successes: number;
  failures: number;
  avgLatency: number | null;
  minLatency: number | null;
  maxLatency: number | null;
  successRate: number | null;
  lastSeen: string | null;
  lastStatus: "ok" | "error";
}

interface FallbackEvent {
  _id: string;
  message: string;
  createdAt: string;
}

interface HourBucket {
  hour: string;
  calls: number;
  fallbacks: number;
}

interface LatencyPoint {
  t: string;
  ms: number | null;
  model: string;
  ok: boolean;
}

interface FallbackData {
  models: ModelStat[];
  fallbackEvents: FallbackEvent[];
  hourlyActivity: HourBucket[];
  latencyHistory: LatencyPoint[];
  totalCalls: number;
  totalFallbacks: number;
  since: string;
}

/* ── Constantes ─────────────────────────────────────────────────────────────── */
const MODEL_COLORS: Record<string, string> = {
  "openai/gpt-4o-mini":                     "#22c55e",
  "openai/gpt-4o":                          "#3b82f6",
  "anthropic/claude-3-5-haiku":             "#a855f7",
  "anthropic/claude-3-5-sonnet":            "#8b5cf6",
  "google/gemini-2.0-flash-exp:free":       "#ef4444",
  "meta-llama/llama-3.1-8b-instruct:free":  "#eab308",
  "mistralai/mistral-7b-instruct:free":     "#94a3b8",
};

function modelColor(model: string) {
  return MODEL_COLORS[model] ?? "#f97316";
}

function shortModel(model: string) {
  const map: Record<string, string> = {
    "openai/gpt-4o-mini":                    "GPT-4o mini",
    "openai/gpt-4o":                         "GPT-4o",
    "anthropic/claude-3-5-haiku":            "Claude Haiku",
    "anthropic/claude-3-5-sonnet":           "Claude Sonnet",
    "google/gemini-2.0-flash-exp:free":      "Gemini Flash",
    "meta-llama/llama-3.1-8b-instruct:free": "LLaMA 3.1",
    "mistralai/mistral-7b-instruct:free":    "Mistral 7B",
  };
  if (map[model]) return map[model];
  const parts = model.split("/");
  return parts[parts.length - 1].replace(":free", "").slice(0, 18);
}

function fmtMs(ms: number | null) {
  if (ms === null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

/* ── Composant principal ───────────────────────────────────────────────────── */
const LS_KEY = "supremyx_api_key";

export default function IaFallbackPage() {
  const [data, setData] = useState<FallbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // ── Fallback config state ──
  const [fbGuildId, setFbGuildId]         = useState("");
  const [fbModels, setFbModels]           = useState<string[]>([]);
  const [fbIsDefault, setFbIsDefault]     = useState(true);
  const [fbLoading, setFbLoading]         = useState(false);
  const [fbNewModel, setFbNewModel]       = useState("");
  const [fbSaving, setFbSaving]           = useState(false);
  const [fbMsg, setFbMsg]                 = useState<{ ok: boolean; text: string } | null>(null);
  const [apiKey]                          = useState<string>(() => localStorage.getItem(LS_KEY) ?? "");

  const loadFallbackConfig = useCallback(async (gId: string) => {
    if (!gId.trim()) return;
    setFbLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/ia/fallback-models?guildId=${encodeURIComponent(gId.trim())}`));
      const json = await res.json();
      setFbModels(json.fallbackModels ?? []);
      setFbIsDefault(json.isDefault ?? true);
    } catch { /* silencieux */ } finally { setFbLoading(false); }
  }, []);

  const saveFallbackModels = useCallback(async (models: string[]) => {
    if (!fbGuildId.trim() || !apiKey) {
      setFbMsg({ ok: false, text: "Renseigne l'ID du serveur et la BOT_API_KEY (page Paramètres)." });
      return;
    }
    setFbSaving(true);
    setFbMsg(null);
    try {
      const res = await fetch(apiUrl("/api/ia/fallback-models"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ guildId: fbGuildId.trim(), fallbackModels: models }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFbModels(models);
      setFbIsDefault(models.length === 0);
      setFbMsg({ ok: true, text: "✅ Modèles de secours sauvegardés." });
    } catch (e) {
      setFbMsg({ ok: false, text: `❌ Erreur : ${e instanceof Error ? e.message : "inconnue"}` });
    } finally { setFbSaving(false); }
  }, [fbGuildId, apiKey]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/ia-fallback?hours=${hours}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  /* ── latency history filtered by selected model ── */
  const latencyPoints = data
    ? (selectedModel
        ? data.latencyHistory.filter(p => p.model === selectedModel)
        : data.latencyHistory)
    : [];

  const fallbackRate = data && data.totalCalls > 0
    ? ((data.totalFallbacks / data.totalCalls) * 100).toFixed(1)
    : "0.0";

  const avgGlobalLatency = data?.models.length
    ? Math.round(
        data.models
          .filter(m => m.avgLatency !== null)
          .reduce((s, m) => s + (m.avgLatency ?? 0), 0) /
        Math.max(1, data.models.filter(m => m.avgLatency !== null).length)
      )
    : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <span>⚡</span> Disponibilité IA &amp; Basculement
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Monitoring en temps réel des modèles OpenRouter et historique des latences
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Fenêtre de temps */}
          {([6, 24, 48, 168] as const).map(h => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              style={{
                background: hours === h ? "var(--primary)" : "var(--muted)",
                color: hours === h ? "#000" : "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
            >
              {h < 24 ? `${h}h` : h < 168 ? `${h / 24}j` : "7j"}
            </button>
          ))}
          {/* Auto-refresh */}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            style={{
              background: autoRefresh ? "rgba(34,197,94,0.15)" : "var(--muted)",
              color: autoRefresh ? "#22c55e" : "var(--muted-foreground)",
              border: `1px solid ${autoRefresh ? "#22c55e55" : "var(--border)"}`,
            }}
          >
            <span className={autoRefresh ? "animate-pulse" : ""}>●</span>
            {autoRefresh ? "Live" : "Pausé"}
          </button>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            ↻ Rafraîchir
          </button>
        </div>
      </div>

      {lastRefresh && (
        <p className="text-xs -mt-4" style={{ color: "var(--muted-foreground)" }}>
          Mis à jour {timeAgo(lastRefresh.toISOString())} · fenêtre : {hours < 24 ? `${hours}h` : `${hours / 24}j`}
        </p>
      )}

      {loading && (
        <div className="py-20 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>
          Chargement des données…
        </div>
      )}
      {error && (
        <div className="py-10 text-center rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
          ❌ {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Appels totaux",    value: data.totalCalls.toLocaleString("fr-FR"), color: "var(--primary)", icon: "🔗" },
              { label: "Basculements",        value: data.totalFallbacks.toLocaleString("fr-FR"), color: "#f97316", icon: "⚡" },
              { label: "Taux basculement",    value: `${fallbackRate}%`, color: data.totalFallbacks > 0 ? "#f97316" : "#22c55e", icon: "📉" },
              { label: "Latence moy.",     value: fmtMs(avgGlobalLatency), color: "#3b82f6", icon: "⏱️" },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="text-lg mb-1">{icon}</div>
                <div className="text-2xl font-black" style={{ color }}>{value}</div>
                <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* ── Tableau des modèles ── */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-bold text-sm">État des modèles</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Cliquez sur un modèle pour filtrer le graphique de latence
              </p>
            </div>
            {data.models.length === 0 ? (
              <div className="py-12 text-center" style={{ color: "var(--muted-foreground)" }}>
                <p className="text-3xl mb-2">🤖</p>
                <p className="text-sm font-semibold">Aucun appel enregistré</p>
                <p className="text-xs mt-1">Les données apparaîtront après les premiers appels <code>!ia</code></p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                      <th className="py-2 px-4 text-left">Modèle</th>
                      <th className="py-2 px-3 text-center">Statut</th>
                      <th className="py-2 px-3 text-center">Appels</th>
                      <th className="py-2 px-3 text-center">Succès</th>
                      <th className="py-2 px-3 text-center">Taux</th>
                      <th className="py-2 px-3 text-center">Moy.</th>
                      <th className="py-2 px-3 text-center">Min</th>
                      <th className="py-2 px-3 text-center">Max</th>
                      <th className="py-2 px-3 text-left">Dernière activité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.models.map(m => {
                      const isSelected = selectedModel === m.model;
                      const color = modelColor(m.model);
                      return (
                        <tr
                          key={m.model}
                          onClick={() => setSelectedModel(isSelected ? null : m.model)}
                          className="cursor-pointer transition-all"
                          style={{
                            borderBottom: "1px solid var(--border)",
                            background: isSelected ? `${color}18` : "transparent",
                          }}
                        >
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
                              <span className="font-semibold text-xs">{shortModel(m.model)}</span>
                            </div>
                            <p className="text-[10px] mt-0.5 ml-4" style={{ color: "var(--muted-foreground)" }}>{m.model}</p>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                background: m.lastStatus === "ok" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                                color: m.lastStatus === "ok" ? "#22c55e" : "#f87171",
                              }}
                            >
                              {m.lastStatus === "ok" ? "✓ OK" : "✗ ERREUR"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold">{m.total}</td>
                          <td className="py-2.5 px-3 text-center" style={{ color: "#22c55e" }}>{m.successes}</td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${m.successRate ?? 0}%`,
                                    background: (m.successRate ?? 0) >= 90 ? "#22c55e" : (m.successRate ?? 0) >= 70 ? "#f97316" : "#ef4444",
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold">{m.successRate ?? "—"}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-xs" style={{ color: "#3b82f6" }}>{fmtMs(m.avgLatency)}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-xs" style={{ color: "#22c55e" }}>{fmtMs(m.minLatency)}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-xs" style={{ color: "#f97316" }}>{fmtMs(m.maxLatency)}</td>
                          <td className="py-2.5 px-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
                            {m.lastSeen ? timeAgo(m.lastSeen) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Graphique latence ── */}
          <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-sm">Historique des latences</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {selectedModel ? `Filtré : ${shortModel(selectedModel)}` : "Tous les modèles — cliquez sur un modèle pour filtrer"}
                </p>
              </div>
              {selectedModel && (
                <button
                  onClick={() => setSelectedModel(null)}
                  className="text-xs px-2.5 py-1 rounded-lg cursor-pointer"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                >
                  ✕ Réinitialiser
                </button>
              )}
            </div>
            {latencyPoints.length === 0 ? (
              <div className="h-40 flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
                <p className="text-sm">Pas encore de données de latence</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={latencyPoints} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) => `${v}ms`}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(val: number, _name: string, props: { payload?: LatencyPoint }) => [
                      `${val}ms`,
                      props.payload ? shortModel(props.payload.model) : "",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="ms"
                    stroke={selectedModel ? modelColor(selectedModel) : "var(--primary)"}
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                    name="Latence"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Activité horaire ── */}
          <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <h2 className="font-bold text-sm mb-1">Activité horaire</h2>
            <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
              Appels normaux vs basculements par heure
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.hourlyActivity} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} interval={Math.floor(data.hourlyActivity.length / 8)} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={30} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="calls" name="Appels" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="fallbacks" name="Basculements" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Événements fallback ── */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <span className="text-base">⚡</span> Historique des bascules
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {data.fallbackEvents.length} événement{data.fallbackEvents.length !== 1 ? "s" : ""} sur la période
                </p>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: data.fallbackEvents.length === 0 ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                  color: data.fallbackEvents.length === 0 ? "#22c55e" : "#f97316",
                }}
              >
                {data.fallbackEvents.length === 0 ? "✓ Aucun" : `${data.fallbackEvents.length} bascule${data.fallbackEvents.length > 1 ? "s" : ""}`}
              </span>
            </div>
            {data.fallbackEvents.length === 0 ? (
              <div className="py-10 text-center" style={{ color: "var(--muted-foreground)" }}>
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm font-semibold">Aucun fallback sur la période</p>
                <p className="text-xs mt-1">Tous les modèles ont répondu normalement</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {data.fallbackEvents.map(ev => (
                  <div key={ev._id} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-base shrink-0 mt-0.5">⚡</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed" style={{ color: "var(--foreground)" }}>{ev.message}</p>
                      <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                        {fmtDate(ev.createdAt)} · {timeAgo(ev.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Configuration des modèles de secours ── */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-bold text-sm flex items-center gap-2">
                <span>🔄</span> Modèles de secours
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Modèles utilisés automatiquement si le modèle principal est indisponible · configurable par serveur
              </p>
            </div>
            <div className="p-4 space-y-3">
              {/* Guild ID input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ID du serveur Discord (ex : 123456789012345678)"
                  value={fbGuildId}
                  onChange={e => setFbGuildId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
                <button
                  onClick={() => loadFallbackConfig(fbGuildId)}
                  disabled={fbLoading || !fbGuildId.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
                  style={{ background: "var(--primary)", color: "#000", opacity: fbLoading || !fbGuildId.trim() ? 0.5 : 1 }}
                >
                  {fbLoading ? "…" : "Charger"}
                </button>
              </div>

              {fbModels.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                      Liste actuelle {fbIsDefault ? "(défaut global)" : "(personnalisée)"}
                    </span>
                    {!fbIsDefault && (
                      <button
                        onClick={() => saveFallbackModels([])}
                        disabled={fbSaving}
                        className="text-[10px] px-2 py-0.5 rounded-full cursor-pointer"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                      >
                        Réinitialiser aux défauts
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {fbModels.map((m, i) => (
                      <div key={m} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold" style={{ color: "var(--muted-foreground)" }}>#{i + 1}</span>
                          <span className="text-xs font-mono">{m}</span>
                        </div>
                        <button
                          onClick={() => saveFallbackModels(fbModels.filter(x => x !== m))}
                          disabled={fbSaving}
                          className="text-[10px] px-2 py-0.5 rounded cursor-pointer"
                          style={{ color: "#f87171", background: "rgba(239,68,68,0.1)" }}
                        >
                          ✕ Retirer
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Ajouter un modèle */}
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="ID modèle OpenRouter (ex : openai/gpt-4o-mini)"
                      value={fbNewModel}
                      onChange={e => setFbNewModel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && fbNewModel.trim() && !fbModels.includes(fbNewModel.trim())) {
                          saveFallbackModels([...fbModels, fbNewModel.trim()]);
                          setFbNewModel("");
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-mono"
                      style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    />
                    <button
                      onClick={() => {
                        if (!fbNewModel.trim() || fbModels.includes(fbNewModel.trim())) return;
                        saveFallbackModels([...fbModels, fbNewModel.trim()]);
                        setFbNewModel("");
                      }}
                      disabled={fbSaving || !fbNewModel.trim() || fbModels.includes(fbNewModel.trim())}
                      className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
                      style={{ background: "rgba(34,197,94,0.2)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", opacity: fbSaving || !fbNewModel.trim() || fbModels.includes(fbNewModel.trim()) ? 0.5 : 1 }}
                    >
                      + Ajouter
                    </button>
                  </div>
                </>
              )}

              {fbMsg && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: fbMsg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: fbMsg.ok ? "#22c55e" : "#f87171" }}>
                  {fbMsg.text}
                </p>
              )}
              {!apiKey && (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  ⚠️ Entre ta BOT_API_KEY sur la page <strong>Paramètres</strong> pour modifier les modèles de secours.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
