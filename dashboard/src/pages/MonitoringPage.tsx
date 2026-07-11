import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "../lib/api";

interface Metric {
  timestamp: string;
  memoryMB: number;
  heapUsedMB: number;
  uptimeSeconds: number;
  guildCount: number;
  commandCount24h: number;
  wsLatency: number;
  mongoStatus: string;
  errorCount24h: number;
}

interface CurrentStatus {
  status: string;
  uptime: number;
  memoryMB: number;
  heapUsedMB: number;
  guildCount: number;
  wsLatency: number;
  mongoStatus: string;
  commandCount24h: number;
  errorCount24h: number;
  nodeVersion: string;
  pid: number;
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}min`);
  return parts.join(" ");
}

function MetricCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold" style={{ color: color || "var(--foreground)" }}>{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ values, color = "var(--primary)" }: { values: number[]; color?: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all"
          style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: color, opacity: i === values.length - 1 ? 1 : 0.5 }} />
      ))}
    </div>
  );
}

export default function MonitoringPage() {
  const [status, setStatus]   = useState<CurrentStatus | null>(null);
  const [history, setHistory] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const [s, h] = await Promise.all([
      fetch(apiUrl("/api/monitoring")).then(r => r.json()).catch(() => null),
      fetch(apiUrl("/api/monitoring/history")).then(r => r.json()).catch(() => ({ metrics: [] })),
    ]);
    if (s?.status) setStatus(s);
    setHistory(h?.metrics || []);
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const memHistory    = history.map(m => m.memoryMB).slice(-30);
  const latencyHistory = history.map(m => m.wsLatency).slice(-30);
  const cmdHistory    = history.map(m => m.commandCount24h).slice(-30);

  const isOnline = status?.status === "ok";

  if (loading) return (
    <div className="p-8 text-center" style={{ color: "var(--muted-foreground)" }}>
      <div className="text-3xl mb-2">🔄</div><p>Chargement des métriques...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">📡 Surveillance du Bot</h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Métriques en temps réel — mémoire, latence, base de données, commandes utilisées.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`size-2.5 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          <span style={{ color: isOnline ? "#34d399" : "#f87171" }}>{isOnline ? "En ligne" : "Hors ligne"}</span>
          {lastUpdate && <span className="text-xs ml-2" style={{ color: "var(--muted-foreground)" }}>({lastUpdate.toLocaleTimeString("fr-FR")})</span>}
        </div>
      </div>

      {status ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <MetricCard icon="⏱️" label="Uptime" value={fmtUptime(status.uptime)} color="#34d399" />
            <MetricCard icon="🧠" label="Mémoire" value={`${status.memoryMB} MB`} sub={`Heap: ${status.heapUsedMB} MB`} color={status.memoryMB > 400 ? "#f87171" : "#93c5fd"} />
            <MetricCard icon="📡" label="Latence WS" value={status.wsLatency > 0 ? `${status.wsLatency}ms` : "—"} color={status.wsLatency > 300 ? "#f87171" : status.wsLatency > 150 ? "#fbbf24" : "#34d399"} />
            <MetricCard icon="🏠" label="Serveurs" value={status.guildCount} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <MetricCard icon="📊" label="Cmds (24h)" value={status.commandCount24h} color="var(--primary)" />
            <MetricCard icon="🗄️" label="Base de données" value={status.mongoStatus === "connected" ? "✅ OK" : "❌ KO"} color={status.mongoStatus === "connected" ? "#34d399" : "#f87171"} />
            <MetricCard icon="⚠️" label="Erreurs (24h)" value={status.errorCount24h} color={status.errorCount24h > 10 ? "#f87171" : "var(--muted-foreground)"} />
            <MetricCard icon="⚙️" label="Node.js" value={status.nodeVersion || "—"} sub={`PID ${status.pid}`} />
          </div>

          {/* Charts */}
          {history.length > 1 && (
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: "💾 Mémoire (MB)", values: memHistory, color: "#93c5fd" },
                { label: "📡 Latence WS (ms)", values: latencyHistory, color: "#fbbf24" },
                { label: "⌨️ Commandes (24h)", values: cmdHistory, color: "var(--primary)" },
              ].map(({ label, values, color }) => (
                <div key={label} className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                  <p className="text-xs font-medium mb-3">{label}</p>
                  <MiniBar values={values} color={color} />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      min: {Math.min(...values.filter(v => v > 0))}
                    </span>
                    <span className="text-xs font-bold" style={{ color }}>
                      {values[values.length - 1]}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      max: {Math.max(...values)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* History table */}
          {history.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="font-semibold text-sm">📈 Historique des métriques (30 dernières)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                      {["Heure", "RAM (MB)", "Heap (MB)", "Latence", "Serveurs", "Cmds/24h", "DB"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().slice(0, 30).map((m, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-3 py-2" style={{ color: "var(--muted-foreground)" }}>
                          {new Date(m.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2" style={{ color: m.memoryMB > 400 ? "#f87171" : undefined }}>{m.memoryMB}</td>
                        <td className="px-3 py-2">{m.heapUsedMB}</td>
                        <td className="px-3 py-2" style={{ color: m.wsLatency > 300 ? "#f87171" : m.wsLatency > 150 ? "#fbbf24" : "#34d399" }}>
                          {m.wsLatency > 0 ? `${m.wsLatency}ms` : "—"}
                        </td>
                        <td className="px-3 py-2">{m.guildCount}</td>
                        <td className="px-3 py-2">{m.commandCount24h}</td>
                        <td className="px-3 py-2" style={{ color: m.mongoStatus === "connected" ? "#34d399" : "#f87171" }}>
                          {m.mongoStatus === "connected" ? "✅" : "❌"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 rounded-xl" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          <div className="text-4xl mb-3">❌</div>
          <p className="font-semibold">Bot hors ligne ou API inaccessible</p>
        </div>
      )}
    </div>
  );
}
