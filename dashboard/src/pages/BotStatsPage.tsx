import { useEffect, useState, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Legend, Sector,
} from "recharts";
import { apiUrl } from "../lib/api";

interface CommandStat {
  command: string;
  count: number;
  lastUsed: string;
  topUsers: { username: string; count: number }[];
}

interface IaModel {
  guildId: string;
  alias: string;
  label: string;
  emoji: string;
}

interface IaStats {
  total: number;
  recent: number;
  topUsers: { username: string; count: number }[];
  byModel: { alias: string; label: string; emoji: string; count: number; pct: number }[];
  dailyActivity: { date: string; count: number }[];
}

interface BotStatsData {
  totalUsage: number;
  uniqueCommands: number;
  commands: CommandStat[];
  topUsers: { username: string; count: number }[];
  dailyActivity: { date: string; count: number }[];
  iaModels: IaModel[];
  iaStats: IaStats;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

const CMD_COLORS = [
  "#d4963a", "#6366f1", "#ec4899", "#14b8a6", "#f59e0b",
  "#8b5cf6", "#10b981", "#f87171", "#60a5fa", "#a78bfa",
];

const REFRESH_INTERVAL = 30;

/* ── Custom tooltip barchart ─────────────────────────────────────────────── */
interface BarTooltipProps {
  active?: boolean;
  payload?: { value: number; payload: { command: string; color: string } }[];
}
function BarTooltip({ active, payload }: BarTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg px-3 py-2 text-sm font-semibold shadow-xl"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
      <span className="font-mono" style={{ color: d.payload.color }}>{d.payload.command}</span>
      <span className="ml-2" style={{ color: "var(--muted-foreground)" }}>—</span>
      <span className="ml-2">{d.value.toLocaleString("fr-FR")} utilisations</span>
    </div>
  );
}

/* ── Custom tooltip piechart ─────────────────────────────────────────────── */
interface PieTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; payload: { pct: number; color: string } }[];
}
function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg px-3 py-2 text-sm font-semibold shadow-xl"
      style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
      <span className="font-mono" style={{ color: d.payload.color }}>{d.name}</span>
      <span className="ml-2 font-normal" style={{ color: "var(--muted-foreground)" }}>
        {d.value.toLocaleString("fr-FR")} · <strong>{d.payload.pct}%</strong>
      </span>
    </div>
  );
}

/* ── Active pie slice (hover) ────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="var(--foreground)" fontSize={13} fontWeight={700}>
        {payload.command}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--muted-foreground)" fontSize={11}>
        {payload.count.toLocaleString("fr-FR")} utilisations
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill={fill} fontSize={12} fontWeight={600}>
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 16}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

/* ── Pulsing live dot ────────────────────────────────────────────────────── */
function LiveDot({ active }: { active: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex size-2">
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${active ? "animate-ping bg-red-400" : "bg-gray-500"}`} />
        <span className={`relative inline-flex size-2 rounded-full ${active ? "bg-red-500" : "bg-gray-500"}`} />
      </span>
      <span className="text-xs font-bold" style={{ color: active ? "#f87171" : "var(--muted-foreground)" }}>
        {active ? "EN DIRECT" : "HORS LIGNE"}
      </span>
    </span>
  );
}

export default function BotStatsPage() {
  const [data, setData]         = useState<BotStatsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);
  const [refreshing, setRefreshing]     = useState(false);
  const [countdown, setCountdown]       = useState(REFRESH_INTERVAL);
  const [chartType, setChartType]       = useState<"bar" | "pie">("bar");
  const [activeSlice, setActiveSlice]   = useState(0);
  const [topN, setTopN]                 = useState<5 | 10 | 15>(10);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setCountdown(REFRESH_INTERVAL);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const res = await fetch(apiUrl("/api/botstats"));
      const d   = await res.json();
      setData(d);
      setLastRefresh(new Date());
      setError(null);
      startCountdown();
    } catch {
      setError("Impossible de charger les stats du bot.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startCountdown]);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), REFRESH_INTERVAL * 1000);
    return () => {
      clearInterval(id);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [load]);

  const filtered = data?.commands.filter(c =>
    !search.trim() || c.command.toLowerCase().includes(search.trim().toLowerCase())
  ) ?? [];

  const maxCount = filtered.length > 0 ? Math.max(...filtered.map(c => c.count)) : 1;
  const topCmds  = (data?.commands ?? []).slice(0, topN).map((c, i) => ({
    ...c,
    color: CMD_COLORS[i % CMD_COLORS.length],
    pct: data ? Math.round((c.count / Math.max(data.totalUsage, 1)) * 100) : 0,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-lg">🤖 Stats du Bot</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Utilisation des commandes Discord · Rafraîchissement auto toutes les {REFRESH_INTERVAL}s
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <LiveDot active={!error && !loading} />
          {lastRefresh && (
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          {!loading && !error && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{ background: "rgba(212,150,58,0.1)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.2)" }}>
              ⏱ {countdown}s
            </span>
          )}
          <button
            data-testid="button-refresh-stats"
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            style={{ background: "rgba(212,150,58,0.15)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}
          >
            {refreshing ? "⏳" : "🔄"} Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : error ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : data && (
        <>
          {/* ── Hero cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Utilisations totales", value: data.totalUsage.toLocaleString("fr-FR"), color: "#d4963a", icon: "📊" },
              { label: "Commandes uniques",     value: data.uniqueCommands,                    color: "#6366f1", icon: "🎮" },
              { label: "Top commande",          value: data.commands[0]?.command ?? "—",       color: "#14b8a6", icon: "🏆" },
              { label: "Utilisateurs actifs",   value: data.topUsers.length,                   color: "#ec4899", icon: "👥" },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="flex flex-col items-center gap-2 rounded-xl p-4 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <span className="text-xl">{icon}</span>
                <span className="text-xl font-bold" style={{ color }}>{value}</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── Live chart ─────────────────────────────────────────────────── */}
          {topCmds.length > 0 && (
            <div className="rounded-xl overflow-hidden mb-8" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>

              {/* Chart header */}
              <div className="px-5 py-3 flex flex-wrap items-center gap-3 justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-sm">📊 Commandes les plus utilisées</h3>
                  <LiveDot active={!refreshing} />
                  {refreshing && <span className="text-xs animate-pulse" style={{ color: "var(--muted-foreground)" }}>Mise à jour…</span>}
                </div>

                <div className="flex items-center gap-2">
                  {/* Top N selector */}
                  <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    {([5, 10, 15] as const).map(n => (
                      <button key={n}
                        data-testid={`button-topn-${n}`}
                        onClick={() => setTopN(n)}
                        className="px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors"
                        style={{
                          background: topN === n ? "rgba(212,150,58,0.2)" : "transparent",
                          color: topN === n ? "var(--primary)" : "var(--muted-foreground)",
                          borderRight: n !== 15 ? "1px solid var(--border)" : "none",
                        }}>
                        Top {n}
                      </button>
                    ))}
                  </div>

                  {/* Chart type toggle */}
                  <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <button
                      data-testid="button-chart-bar"
                      onClick={() => setChartType("bar")}
                      className="px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors"
                      style={{
                        background: chartType === "bar" ? "rgba(212,150,58,0.2)" : "transparent",
                        color: chartType === "bar" ? "var(--primary)" : "var(--muted-foreground)",
                        borderRight: "1px solid var(--border)",
                      }}>
                      ▬ Barres
                    </button>
                    <button
                      data-testid="button-chart-pie"
                      onClick={() => { setChartType("pie"); setActiveSlice(0); }}
                      className="px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors"
                      style={{
                        background: chartType === "pie" ? "rgba(212,150,58,0.2)" : "transparent",
                        color: chartType === "pie" ? "var(--primary)" : "var(--muted-foreground)",
                      }}>
                      ◉ Camembert
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Bar Chart ────────────────────────────────────────────── */}
              {chartType === "bar" && (
                <div className="px-2 py-6" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCmds} margin={{ top: 4, right: 16, left: -8, bottom: 8 }} barCategoryGap="28%">
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="command"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "monospace" }}
                        axisLine={false} tickLine={false}
                        interval={0} angle={-22} textAnchor="end" height={48}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        axisLine={false} tickLine={false} allowDecimals={false}
                      />
                      <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={52} isAnimationActive={true} animationDuration={500}>
                        {topCmds.map((entry, i) => (
                          <Cell key={entry.command} fill={CMD_COLORS[i % CMD_COLORS.length]} fillOpacity={0.88} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Pie Chart ────────────────────────────────────────────── */}
              {chartType === "pie" && (
                <div className="flex flex-col sm:flex-row items-center gap-2 px-4 py-6" style={{ minHeight: 320 }}>
                  <div style={{ width: "100%", maxWidth: 340, height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={topCmds}
                          dataKey="count"
                          nameKey="command"
                          cx="50%" cy="50%"
                          innerRadius={68} outerRadius={108}
                          activeIndex={activeSlice}
                          activeShape={renderActiveShape}
                          onMouseEnter={(_, index) => setActiveSlice(index)}
                          isAnimationActive={true}
                          animationDuration={600}
                        >
                          {topCmds.map((entry, i) => (
                            <Cell key={entry.command} fill={CMD_COLORS[i % CMD_COLORS.length]} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend list */}
                  <div className="flex-1 flex flex-col gap-1.5 w-full sm:max-w-xs">
                    {topCmds.map((c, i) => (
                      <button key={c.command}
                        data-testid={`button-pie-legend-${c.command}`}
                        onClick={() => setActiveSlice(i)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left w-full cursor-pointer transition-colors"
                        style={{
                          background: activeSlice === i ? "rgba(255,255,255,0.06)" : "transparent",
                          border: `1px solid ${activeSlice === i ? "rgba(255,255,255,0.1)" : "transparent"}`,
                        }}>
                        <span className="size-3 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="font-mono text-xs font-semibold flex-1 truncate" style={{ color: c.color }}>{c.command}</span>
                        <span className="text-xs font-bold shrink-0" style={{ color: "var(--muted-foreground)" }}>
                          {c.count.toLocaleString("fr-FR")}
                        </span>
                        <span className="text-xs font-bold shrink-0 w-10 text-right" style={{ color: c.color }}>
                          {c.pct}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer bar */}
              <div className="px-5 py-2 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.15)" }}>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Total : <strong style={{ color: "var(--foreground)" }}>{data.totalUsage.toLocaleString("fr-FR")}</strong> utilisations · {data.uniqueCommands} commandes distinctes
                </span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Prochain refresh dans <strong style={{ color: "var(--primary)" }}>{countdown}s</strong>
                </span>
              </div>
            </div>
          )}

          {/* ── IA Stats ───────────────────────────────────────────────────── */}
          {data.iaStats && (data.iaStats.total > 0 || data.iaModels?.length > 0) && (
            <div className="mb-6">
              <h3 className="font-bold text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>🤖 INTELLIGENCE ARTIFICIELLE</h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Questions posées",  value: data.iaStats.total.toLocaleString("fr-FR"),   color: "#FF8C00", icon: "💬" },
                  { label: "7 derniers jours",  value: data.iaStats.recent.toLocaleString("fr-FR"),  color: "#6366f1", icon: "📅" },
                  { label: "Utilisateurs IA",   value: data.iaStats.topUsers.length,                 color: "#14b8a6", icon: "👥" },
                  { label: "Modèles utilisés",  value: data.iaStats.byModel.length,                  color: "#ec4899", icon: "🧠" },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl p-3 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                    <span className="text-lg">{icon}</span>
                    <span className="text-lg font-bold" style={{ color }}>{value}</span>
                    <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{label}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {/* Top IA users */}
                <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <h4 className="font-bold text-sm">👑 Top utilisateurs IA</h4>
                  </div>
                  {data.iaStats.topUsers.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: "var(--muted-foreground)" }}>Aucune donnée.</p>
                  ) : data.iaStats.topUsers.slice(0, 8).map((u, i) => (
                    <div key={u.username} className="px-5 py-2 flex items-center justify-between"
                      style={{ borderBottom: i < Math.min(data.iaStats.topUsers.length, 8) - 1 ? "1px solid var(--border)" : "none" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold w-5 text-center" style={{ color: i < 3 ? "#facc15" : "var(--muted-foreground)" }}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </span>
                        <span className="text-sm font-medium">{u.username}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: "#FF8C00" }}>{u.count}</span>
                    </div>
                  ))}
                </div>

                {/* Model breakdown */}
                <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <h4 className="font-bold text-sm">🧠 Répartition par modèle</h4>
                  </div>
                  {data.iaStats.byModel.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: "var(--muted-foreground)" }}>Aucune donnée.</p>
                  ) : (
                    <div className="px-5 py-3 flex flex-col gap-3">
                      {data.iaStats.byModel.map((m) => (
                        <div key={m.alias}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">{m.emoji} {m.label}</span>
                            <span className="text-xs font-bold" style={{ color: "#FF8C00" }}>{m.count} ({m.pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(m.pct, 2)}%`, background: "rgba(255,140,0,0.7)" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* IA daily activity */}
                <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <h4 className="font-bold text-sm">📈 Questions IA (7 jours)</h4>
                  </div>
                  <div className="px-5 py-4">
                    <div className="flex items-end gap-1.5 h-24">
                      {data.iaStats.dailyActivity.map(d => {
                        const maxDay = Math.max(...data.iaStats.dailyActivity.map(x => x.count), 1);
                        const pct = Math.max((d.count / maxDay) * 100, 4);
                        return (
                          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{d.count || ""}</span>
                            <div className="w-full rounded-t-sm transition-all duration-500" style={{ height: `${pct}%`, background: "rgba(255,140,0,0.55)", minHeight: 4 }} title={`${d.count} questions`} />
                            <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{fmtDate(d.date)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── IA Model banner ────────────────────────────────────────────── */}
          {data.iaModels && data.iaModels.length > 0 && (
            <div className="rounded-xl overflow-hidden mb-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="font-bold text-sm">🤖 Modèle IA actif (par serveur)</h3>
              </div>
              <div className="flex flex-wrap gap-3 px-5 py-4">
                {data.iaModels.map((m) => (
                  <div key={m.guildId} className="flex items-center gap-2 rounded-lg px-4 py-2" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                    <span className="text-base">{m.emoji}</span>
                    <div>
                      <p className="text-xs font-bold leading-tight">{m.label}</p>
                      <p className="text-[10px] leading-tight" style={{ color: "var(--muted-foreground)" }}>!ia modele {m.alias}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Top users + Activity ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="font-bold text-sm">👑 Top Utilisateurs</h3>
              </div>
              {data.topUsers.slice(0, 10).map((u, i) => (
                <div key={u.username} className="px-5 py-2.5 flex items-center justify-between"
                  style={{ borderBottom: i < 9 ? "1px solid var(--border)" : "none" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold w-5 text-center" style={{ color: i < 3 ? "#facc15" : "var(--muted-foreground)" }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <span className="text-sm font-medium">{u.username}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: "#d4963a" }}>{u.count.toLocaleString("fr-FR")}</span>
                </div>
              ))}
            </div>

            <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="font-bold text-sm">📈 Activité récente (7 jours)</h3>
              </div>
              <div className="px-5 py-4">
                {data.dailyActivity.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>Aucune donnée récente.</p>
                ) : (
                  <div className="flex items-end gap-2 h-28">
                    {data.dailyActivity.map(d => {
                      const maxDay = Math.max(...data.dailyActivity.map(x => x.count), 1);
                      const pct = Math.max((d.count / maxDay) * 100, 4);
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{d.count}</span>
                          <div className="w-full rounded-t-sm transition-all duration-500"
                            style={{ height: `${pct}%`, background: "rgba(212,150,58,0.6)", minHeight: 4 }} title={`${d.count} utilisations`} />
                          <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{fmtDate(d.date)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Command table ──────────────────────────────────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="font-bold text-sm">📋 Toutes les commandes</h3>
              <input
                data-testid="input-search-commands"
                type="text" placeholder="Filtrer…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", width: 140 }}
              />
            </div>
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Aucune commande trouvée.</div>
            ) : (
              <div>
                {filtered.map((c, i) => {
                  const barPct = Math.max((c.count / maxCount) * 100, 2);
                  const color = CMD_COLORS[i % CMD_COLORS.length];
                  return (
                    <div key={c.command} className="px-5 py-3"
                      style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-bold text-sm" style={{ color }}>{c.command}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            {c.lastUsed ? `Dernière utilisation : ${fmtDate(c.lastUsed)}` : ""}
                          </span>
                          <span className="font-bold text-sm" style={{ color }}>{c.count.toLocaleString("fr-FR")} fois</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%`, background: color, opacity: 0.7 }} />
                      </div>
                      {c.topUsers.length > 0 && (
                        <p className="text-[11px] mt-1" style={{ color: "oklch(0.45 0 0)" }}>
                          Top : {c.topUsers.slice(0, 3).map(u => `${u.username} (${u.count})`).join(" · ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
