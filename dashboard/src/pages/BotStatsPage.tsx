import { useEffect, useState } from "react";
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

export default function BotStatsPage() {
  const [data, setData] = useState<BotStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/botstats"))
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger les stats du bot."); setLoading(false); });
  }, []);

  const filtered = data?.commands.filter(c =>
    !search.trim() || c.command.toLowerCase().includes(search.trim().toLowerCase())
  ) ?? [];

  const maxCount = filtered.length > 0 ? Math.max(...filtered.map(c => c.count)) : 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h2 className="font-bold text-lg">🤖 Stats du Bot</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Utilisation des commandes Discord
        </p>
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
          {/* Hero cards */}
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

          {/* IA Stats section */}
          {data.iaStats && (data.iaStats.total > 0 || data.iaModels?.length > 0) && (
            <div className="mb-6">
              <h3 className="font-bold text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>🤖 INTELLIGENCE ARTIFICIELLE</h3>

              {/* IA summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Questions posées",    value: data.iaStats.total.toLocaleString("fr-FR"), color: "#FF8C00", icon: "💬" },
                  { label: "7 derniers jours",    value: data.iaStats.recent.toLocaleString("fr-FR"), color: "#6366f1", icon: "📅" },
                  { label: "Utilisateurs IA",     value: data.iaStats.topUsers.length,               color: "#14b8a6", icon: "👥" },
                  { label: "Modèles utilisés",    value: data.iaStats.byModel.length,                color: "#ec4899", icon: "🧠" },
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
                    <div key={u.username} className="px-5 py-2 flex items-center justify-between" style={{ borderBottom: i < Math.min(data.iaStats.topUsers.length, 8) - 1 ? "1px solid var(--border)" : "none" }}>
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
                            <div className="h-full rounded-full" style={{ width: `${Math.max(m.pct, 2)}%`, background: "rgba(255,140,0,0.7)" }} />
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
                            <div className="w-full rounded-t-sm" style={{ height: `${pct}%`, background: "rgba(255,140,0,0.55)", minHeight: 4 }} title={`${d.count} questions`} />
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

          {/* IA Model banner */}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Top Users */}
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="font-bold text-sm">👑 Top Utilisateurs</h3>
              </div>
              {data.topUsers.slice(0, 10).map((u, i) => (
                <div key={u.username} className="px-5 py-2.5 flex items-center justify-between" style={{ borderBottom: i < 9 ? "1px solid var(--border)" : "none" }}>
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

            {/* Daily Activity (last 7 days) */}
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
                          <div className="w-full rounded-t-sm" style={{ height: `${pct}%`, background: "rgba(212,150,58,0.6)", minHeight: 4 }} title={`${d.count} utilisations`} />
                          <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{fmtDate(d.date)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Command breakdown */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="font-bold text-sm">📋 Toutes les commandes</h3>
              <input
                type="text"
                placeholder="Filtrer…"
                value={search}
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
                    <div key={c.command} className="px-5 py-3" style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
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
                        <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: color, opacity: 0.7 }} />
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
