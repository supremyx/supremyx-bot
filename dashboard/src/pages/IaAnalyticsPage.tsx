import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface DayActivity { date: string; count: number; }
interface TopUser     { username: string; count: number; }
interface ModelStat   { alias: string; count: number; pct: number; }

interface IaUsageData {
  total: number;
  dailyActivity: DayActivity[];
  topUsers: TopUser[];
  byModel: ModelStat[];
  quota: number;
  days: number;
}

const MODEL_COLORS: Record<string, string> = {
  'gpt-4o-mini':   '#22c55e',
  'gpt-4o':        '#3b82f6',
  'claude-haiku':  '#a855f7',
  'claude-sonnet': '#8b5cf6',
  'gemini-flash':  '#ef4444',
  'mistral':       '#94a3b8',
  'llama':         '#eab308',
};

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 truncate text-right" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <div className="flex-1 rounded-full h-2" style={{ background: "var(--muted)" }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 text-right font-bold text-xs">{value}</span>
    </div>
  );
}

export default function IaAnalyticsPage() {
  const [data, setData]       = useState<IaUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [days, setDays]       = useState(7);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl(`/api/ia/usage?days=${days}`))
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Erreur de chargement"); setLoading(false); });
  }, [days]);

  if (loading) return <div className="py-24 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement des analytics IA…</div>;
  if (error || !data) return <div className="py-24 text-center text-red-400">{error ?? "Données indisponibles"}</div>;

  const maxDay    = Math.max(...data.dailyActivity.map(d => d.count), 1);
  const maxUser   = Math.max(...data.topUsers.map(u => u.count), 1);
  const quotaPct  = data.quota > 0 ? Math.min(100, Math.round((data.total / data.quota) * 100)) : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">🤖 Analytics IA</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>Utilisation de l'IA SUPREMYX sur les {days} derniers jours</p>

      {/* Période */}
      <div className="flex gap-2 mb-8">
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
            {d} jours
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Utilisations totales", value: data.total,           color: "var(--primary)" },
          { label: "Modèles différents",   value: data.byModel.length,   color: "#6366f1" },
          { label: "Utilisateurs uniques", value: data.topUsers.length,  color: "#14b8a6" },
          { label: "Quota journalier",     value: data.quota || "∞",     color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="text-2xl font-bold" style={{ color }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Quota bar */}
      {data.quota > 0 && (
        <div className="rounded-xl p-5 mb-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold">📊 Quota journalier</span>
            <span style={{ color: "var(--muted-foreground)" }}>{data.total % data.quota}/{data.quota}</span>
          </div>
          <div className="h-3 rounded-full" style={{ background: "var(--muted)" }}>
            <div
              className="h-3 rounded-full transition-all"
              style={{ width: `${quotaPct}%`, background: quotaPct >= 100 ? "#ef4444" : quotaPct >= 80 ? "#f97316" : "#22c55e" }}
            />
          </div>
          <div className="text-xs mt-1 text-right" style={{ color: "var(--muted-foreground)" }}>{quotaPct}%</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Activité journalière */}
        <div className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <h2 className="font-bold mb-4">📅 Activité journalière</h2>
          <div className="flex items-end gap-1 h-32">
            {data.dailyActivity.map(d => {
              const pct = maxDay > 0 ? (d.count / maxDay) * 100 : 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full rounded-t transition-all"
                    title={`${d.date}: ${d.count} utilisation(s)`}
                    style={{ height: `${Math.max(pct, 2)}%`, background: "var(--primary)", opacity: 0.85 }}
                  />
                  <span className="text-xs hidden group-hover:block" style={{ color: "var(--muted-foreground)", fontSize: 9 }}>
                    {new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
            <span>{data.dailyActivity[0]?.date ? new Date(data.dailyActivity[0].date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : ""}</span>
            <span>{data.dailyActivity[data.dailyActivity.length - 1]?.date ? new Date(data.dailyActivity[data.dailyActivity.length - 1].date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : ""}</span>
          </div>
        </div>

        {/* Répartition par modèle */}
        <div className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <h2 className="font-bold mb-4">🧠 Répartition par modèle</h2>
          {data.byModel.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Aucune donnée disponible.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.byModel.map(m => (
                <div key={m.alias}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{m.alias}</span>
                    <span style={{ color: "var(--muted-foreground)" }}>{m.count} ({m.pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--muted)" }}>
                    <div className="h-2 rounded-full" style={{ width: `${m.pct}%`, background: MODEL_COLORS[m.alias] ?? "#d4963a" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top utilisateurs */}
      <div className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
        <h2 className="font-bold mb-4">👤 Top utilisateurs</h2>
        {data.topUsers.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Aucune donnée disponible.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.topUsers.map((u, i) => (
              <Bar key={u.username} label={`${i + 1}. ${u.username}`} value={u.count} max={maxUser} color="var(--primary)" />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
