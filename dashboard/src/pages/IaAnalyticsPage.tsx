import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { apiUrl } from "../lib/api";

interface DayActivity { date: string; count: number; }
interface TopUser     { username: string; count: number; }
interface ModelStat   { alias: string; count: number; pct: number; }
interface TypeStat    { type: string; count: number; pct: number; }
interface UsageRecord {
  _id: string;
  username: string;
  modelAlias: string;
  commandType: string;
  usedAt: string;
}

interface IaUsageData {
  total: number;
  dailyActivity: DayActivity[];
  topUsers: TopUser[];
  byModel: ModelStat[];
  quota: number;
  days: number;
}

interface IaHistoryData {
  records: UsageRecord[];
  byType: TypeStat[];
  total: number;
}

const MODEL_COLORS: Record<string, string> = {
  "gpt-4o-mini":   "#22c55e",
  "gpt-4o":        "#3b82f6",
  "claude-haiku":  "#a855f7",
  "claude-sonnet": "#8b5cf6",
  "gemini-flash":  "#ef4444",
  "mistral":       "#94a3b8",
  "llama":         "#eab308",
};

const CMD_META: Record<string, { label: string; emoji: string; color: string }> = {
  "analyser":    { label: "Analyse d'équipe",  emoji: "📊", color: "#3b82f6" },
  "predire":     { label: "Prédiction",         emoji: "🔮", color: "#a855f7" },
  "coach":       { label: "Coaching",           emoji: "🎯", color: "#22c55e" },
  "debrief-auto":{ label: "Débrief auto",       emoji: "🤖", color: "#f59e0b" },
  "chat":        { label: "Chat libre",         emoji: "💬", color: "#d4963a" },
};

function getCmdMeta(type: string) {
  return CMD_META[type] ?? { label: type, emoji: "🧠", color: "#94a3b8" };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
      <div className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{label}</div>
      {sub && <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <p style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <p className="font-bold" style={{ color: "var(--primary)" }}>{payload[0].value} utilisation(s)</p>
    </div>
  );
};

export default function IaAnalyticsPage() {
  const [usage, setUsage]         = useState<IaUsageData | null>(null);
  const [history, setHistory]     = useState<IaHistoryData | null>(null);
  const [loadingU, setLoadingU]   = useState(true);
  const [loadingH, setLoadingH]   = useState(true);
  const [days, setDays]           = useState(7);
  const [tab, setTab]             = useState<"overview" | "history">("overview");

  useEffect(() => {
    setLoadingU(true);
    fetch(apiUrl(`/api/ia/usage?days=${days}`))
      .then(r => r.json())
      .then(d => { setUsage(d); setLoadingU(false); })
      .catch(() => setLoadingU(false));
  }, [days]);

  useEffect(() => {
    setLoadingH(true);
    fetch(apiUrl(`/api/ia/history?days=${days}&limit=50`))
      .then(r => r.json())
      .then(d => { setHistory(d); setLoadingH(false); })
      .catch(() => setLoadingH(false));
  }, [days]);

  const loading = loadingU && loadingH;

  const quotaPct = usage && usage.quota > 0
    ? Math.min(100, Math.round((usage.total / usage.quota) * 100))
    : 0;

  const topModel = usage?.byModel[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black">🧠 Analytiques IA</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Utilisation de l'IA SUPREMYX via OpenRouter
          </p>
        </div>

        {/* Période */}
        <div className="flex gap-2 shrink-0">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              style={{
                background: days === d ? "var(--primary)" : "var(--muted)",
                color:      days === d ? "var(--primary-foreground)" : "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
            >
              {d}j
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
        {(["overview", "history"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer"
            style={{
              background: tab === t ? "var(--card)" : "transparent",
              color:      tab === t ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow:  tab === t ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
            }}
          >
            {t === "overview" ? "📊 Vue d'ensemble" : "📋 Historique"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-24 text-center text-sm animate-pulse" style={{ color: "var(--muted-foreground)" }}>
          Chargement des analytics IA…
        </div>
      )}

      {!loading && tab === "overview" && usage && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Utilisations totales" value={usage.total} color="var(--primary)" sub={`sur ${days} jours`} />
            <StatCard label="Modèle principal"     value={topModel ? `${topModel.alias}` : "—"} color="#22c55e" sub={topModel ? `${topModel.pct}% des appels` : undefined} />
            <StatCard label="Utilisateurs uniques" value={usage.topUsers.length} color="#14b8a6" />
            <StatCard label="Quota journalier"     value={usage.quota > 0 ? usage.quota : "∞"} color="#f59e0b" sub={usage.quota > 0 ? `${quotaPct}% utilisé` : "Illimité"} />
          </div>

          {/* Quota bar */}
          {usage.quota > 0 && (
            <div className="rounded-xl p-5 mb-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <div className="flex justify-between text-sm mb-2 font-semibold">
                <span>📊 Quota journalier</span>
                <span style={{ color: "var(--muted-foreground)" }}>
                  {usage.total % usage.quota}/{usage.quota}
                </span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${quotaPct}%`,
                    background: quotaPct >= 100 ? "#ef4444" : quotaPct >= 80 ? "#f97316" : "#22c55e",
                  }}
                />
              </div>
              <div className="text-xs mt-1 text-right" style={{ color: "var(--muted-foreground)" }}>
                {quotaPct}%
              </div>
            </div>
          )}

          {/* Activité journalière (recharts area chart) */}
          <div className="rounded-xl p-5 mb-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <h2 className="font-bold mb-4">📅 Activité journalière</h2>
            {usage.dailyActivity.every(d => d.count === 0) ? (
              <p className="text-sm py-8 text-center" style={{ color: "var(--muted-foreground)" }}>Aucune activité sur cette période.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={usage.dailyActivity} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="iaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false} tickLine={false}
                    interval={days <= 7 ? 0 : Math.floor(days / 7)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#iaGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--primary)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Répartition par modèle */}
            <div className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <h2 className="font-bold mb-4">🤖 Répartition par modèle</h2>
              {usage.byModel.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: "var(--muted-foreground)" }}>Aucune donnée.</p>
              ) : (
                <div className="flex gap-4">
                  {/* Donut */}
                  <div className="shrink-0">
                    <PieChart width={100} height={100}>
                      <Pie
                        data={usage.byModel}
                        dataKey="count"
                        nameKey="alias"
                        cx={50} cy={50}
                        innerRadius={28}
                        outerRadius={44}
                        strokeWidth={0}
                      >
                        {usage.byModel.map((m, i) => (
                          <Cell key={i} fill={MODEL_COLORS[m.alias] ?? "#d4963a"} />
                        ))}
                      </Pie>
                    </PieChart>
                  </div>
                  {/* Legend + bars */}
                  <div className="flex-1 flex flex-col gap-2">
                    {usage.byModel.map(m => (
                      <div key={m.alias}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full inline-block shrink-0" style={{ background: MODEL_COLORS[m.alias] ?? "#d4963a" }} />
                            {m.alias}
                          </span>
                          <span style={{ color: "var(--muted-foreground)" }}>{m.count} ({m.pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${m.pct}%`, background: MODEL_COLORS[m.alias] ?? "#d4963a" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Répartition par type de commande */}
            <div className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <h2 className="font-bold mb-4">⚡ Types de commandes</h2>
              {!history || history.byType.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: "var(--muted-foreground)" }}>Aucune donnée.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {history.byType.map(t => {
                    const meta = getCmdMeta(t.type);
                    return (
                      <div key={t.type}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <span>{meta.emoji}</span>
                            {meta.label}
                          </span>
                          <span style={{ color: "var(--muted-foreground)" }}>{t.count} ({t.pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                          <div className="h-2 rounded-full transition-all" style={{ width: `${t.pct}%`, background: meta.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top utilisateurs */}
          <div className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <h2 className="font-bold mb-4">👤 Top utilisateurs</h2>
            {usage.topUsers.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: "var(--muted-foreground)" }}>Aucune donnée.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {usage.topUsers.map((u, i) => {
                  const maxU = usage.topUsers[0].count;
                  const pct  = maxU > 0 ? (u.count / maxU) * 100 : 0;
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={u.username} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-center shrink-0">{medals[i] ?? `${i + 1}.`}</span>
                      <span className="w-28 truncate shrink-0" style={{ color: "var(--muted-foreground)" }}>{u.username}</span>
                      <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: "var(--muted)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "var(--primary)" }} />
                      </div>
                      <span className="w-6 text-right font-bold text-xs shrink-0">{u.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {!loading && tab === "history" && history && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="font-bold">📋 Historique des appels IA</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {history.records.length} entrée(s) sur les {days} derniers jours
            </p>
          </div>

          {history.records.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
              Aucune utilisation enregistrée sur cette période.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                    <th className="px-4 py-3 text-left">Date & heure</th>
                    <th className="px-4 py-3 text-left">Utilisateur</th>
                    <th className="px-4 py-3 text-left">Commande</th>
                    <th className="px-4 py-3 text-left">Modèle</th>
                  </tr>
                </thead>
                <tbody>
                  {history.records.map((r, i) => {
                    const meta  = getCmdMeta(r.commandType);
                    const color = MODEL_COLORS[r.modelAlias] ?? "#d4963a";
                    return (
                      <tr
                        key={r._id ?? i}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent",
                        }}
                      >
                        <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                          {fmtDateTime(r.usedAt)}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{r.username}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44` }}
                          >
                            {meta.emoji} {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                          >
                            <span className="size-1.5 rounded-full inline-block" style={{ background: color }} />
                            {r.modelAlias}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
