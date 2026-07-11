import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "../lib/api";

interface TopCommand  { command: string; count: number; lastUsed: string; }
interface TopUser     { userId: string; username: string; count: number; }
interface TopChannel  { channelId: string; channelName: string; count: number; }
interface DayBucket   { date: string; count: number; }
interface StatsData {
  total: number;
  total24h: number;
  total7d: number;
  topCommands: TopCommand[];
  topUsers: TopUser[];
  topChannels: TopChannel[];
  daily: DayBucket[];
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function Bar({ label, value, max, color = "var(--primary)" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm truncate w-36 flex-shrink-0" title={label}>{label}</span>
      <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: "var(--muted)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-bold w-10 text-right flex-shrink-0" style={{ color }}>{value.toLocaleString("fr-FR")}</span>
    </div>
  );
}

function DayChart({ daily }: { daily: DayBucket[] }) {
  if (!daily.length) return null;
  const max = Math.max(...daily.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {daily.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t transition-all"
            style={{ height: `${Math.max(4, (d.count / max) * 80)}px`, background: i === daily.length - 1 ? "var(--primary)" : "rgba(212,150,58,0.4)" }} />
          <span className="text-xs" style={{ color: "var(--muted-foreground)", fontSize: "9px" }}>{fmtDate(d.date)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CommandStatsPage() {
  const [data, setData]   = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState<"24h"|"7d"|"30d">("7d");
  const [tab, setTab]         = useState<"commands"|"users"|"channels">("commands");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(apiUrl(`/api/command-stats?period=${period}`))
      .then(r => r.json()).catch(() => null);
    if (r) setData(r);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const kpis = data ? [
    { icon: "⌨️", label: "Total commandes",  value: data.total.toLocaleString("fr-FR"),    color: "var(--primary)" },
    { icon: "📅", label: "Aujourd'hui (24h)", value: data.total24h.toLocaleString("fr-FR"), color: "#34d399" },
    { icon: "📆", label: "Cette semaine",     value: data.total7d.toLocaleString("fr-FR"),  color: "#a78bfa" },
    { icon: "🏆", label: "Top commande",      value: data.topCommands[0]?.command || "—",   color: "var(--primary)" },
  ] : [];

  const tabs = [
    { key: "commands", label: "⌨️ Commandes" },
    { key: "users",    label: "👤 Utilisateurs" },
    { key: "channels", label: "📍 Salons" },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">📊 Statistiques des Commandes</h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Utilisation détaillée par commande, par utilisateur et par salon.
          </p>
        </div>
        <div className="flex gap-2">
          {(["24h", "7d", "30d"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
              style={{ background: period === p ? "var(--primary)" : "var(--muted)", color: period === p ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">🔄</div><p>Chargement...</p>
        </div>
      ) : !data ? (
        <div className="text-center py-16" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">⚠️</div><p>Aucune donnée disponible.</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {kpis.map(k => (
              <div key={k.label} className="rounded-xl p-4 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <div className="text-2xl mb-1">{k.icon}</div>
                <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Daily chart */}
          {data.daily.length > 1 && (
            <div className="rounded-xl p-4 mb-6" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <h3 className="font-semibold text-sm mb-3">📈 Utilisation quotidienne</h3>
              <DayChart daily={data.daily} />
            </div>
          )}

          {/* Tab selector */}
          <div className="flex gap-2 mb-4">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{ background: tab === t.key ? "var(--primary)" : "var(--muted)", color: tab === t.key ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            {tab === "commands" && (
              <>
                <h3 className="font-semibold text-sm mb-4">🏆 Top commandes ({data.topCommands.length})</h3>
                {data.topCommands.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>Aucune donnée.</p>
                ) : (
                  <div className="space-y-1">
                    {data.topCommands.map((c, i) => (
                      <div key={c.command}>
                        <Bar
                          label={`${i + 1}. ${c.command}`}
                          value={c.count}
                          max={data.topCommands[0].count}
                          color={i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#f97316" : "var(--primary)"}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "users" && (
              <>
                <h3 className="font-semibold text-sm mb-4">👤 Top utilisateurs</h3>
                {data.topUsers.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>Aucune donnée.</p>
                ) : (
                  <div className="space-y-1">
                    {data.topUsers.map((u, i) => (
                      <Bar key={u.userId}
                        label={`${i + 1}. ${u.username}`}
                        value={u.count}
                        max={data.topUsers[0].count}
                        color="#a78bfa"
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "channels" && (
              <>
                <h3 className="font-semibold text-sm mb-4">📍 Top salons</h3>
                {data.topChannels.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>Aucune donnée.</p>
                ) : (
                  <div className="space-y-1">
                    {data.topChannels.map((c, i) => (
                      <Bar key={c.channelId}
                        label={`${i + 1}. #${c.channelName}`}
                        value={c.count}
                        max={data.topChannels[0].count}
                        color="#34d399"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <p className="mt-4 text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            Période : {period} · {data.total.toLocaleString("fr-FR")} commandes au total
          </p>
        </>
      )}
    </div>
  );
}
