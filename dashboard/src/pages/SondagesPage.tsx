import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface SondageResult {
  option: string;
  count: number;
}

interface SondageItem {
  _id: string;
  question: string;
  options: string[];
  results: SondageResult[];
  totalVotes: number;
  winner: string;
  createdBy: string;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SondageStats {
  total: number;
  closed: number;
  open: number;
  closeRate: number;
  avgVotes: number;
  mostPopular: { question: string; totalVotes: number } | null;
  topOption: { label: string; question: string; count: number } | null;
  topWinner: { label: string; wins: number } | null;
}

interface SondageData {
  stats: SondageStats;
  history: SondageItem[];
}

const BAR_COLORS = ["#d4963a", "#6366f1", "#14b8a6", "#ec4899", "#f59e0b", "#8b5cf6", "#10b981", "#f87171"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function VoteBar({ results, total }: { results: SondageResult[]; total: number }) {
  if (!results || results.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 mt-3">
      {results.map((r, i) => {
        const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
        return (
          <div key={r.option}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium flex items-center gap-1">
                {i === 0 && r.count > 0 && <span>🏆</span>}
                {r.option}
              </span>
              <span className="text-xs font-bold" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>
                {r.count} vote{r.count !== 1 ? "s" : ""} ({pct}%)
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, background: BAR_COLORS[i % BAR_COLORS.length], opacity: 0.75 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SondagesPage() {
  const [data, setData] = useState<SondageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const PAGE_SIZE = 6;

  useEffect(() => {
    fetch(apiUrl("/api/sondages"))
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger les sondages."); setLoading(false); });
  }, []);

  const history = data?.history ?? [];
  const totalPages = Math.ceil(history.length / PAGE_SIZE);
  const paginated = history.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h2 className="font-bold text-lg">📊 Sondages</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Historique et statistiques des sondages du serveur
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
          {/* ── Stats cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { icon: "📋", label: "Total créés",        value: data.stats.total,     color: "#d4963a" },
              { icon: "✅", label: "Clôturés",           value: data.stats.closed,    color: "#10b981" },
              { icon: "🟢", label: "En cours",           value: data.stats.open,      color: "#6366f1" },
              { icon: "🗳️", label: "Votes moy./sondage", value: data.stats.avgVotes === 0 ? "—" : data.stats.avgVotes, color: "#ec4899" },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="flex flex-col items-center gap-2 rounded-xl p-4 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <span className="text-xl">{icon}</span>
                <span className="text-xl font-bold" style={{ color }}>{value}</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── Highlights ───────────────────────────────────────────────── */}
          {(data.stats.mostPopular || data.stats.topOption || data.stats.topWinner) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {data.stats.mostPopular && (
                <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "#d4963a" }}>🏆 Sondage le plus populaire</p>
                  <p className="text-sm font-bold leading-snug">"{data.stats.mostPopular.question}"</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{data.stats.mostPopular.totalVotes} vote{data.stats.mostPopular.totalVotes !== 1 ? "s" : ""}</p>
                </div>
              )}
              {data.stats.topOption && (
                <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "#6366f1" }}>🔥 Option la plus votée</p>
                  <p className="text-sm font-bold leading-snug">"{data.stats.topOption.label}"</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{data.stats.topOption.count} vote{data.stats.topOption.count !== 1 ? "s" : ""} · sur "{data.stats.topOption.question}"</p>
                </div>
              )}
              {data.stats.topWinner && (
                <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "#10b981" }}>🥇 Réponse gagnante récurrente</p>
                  <p className="text-sm font-bold leading-snug">"{data.stats.topWinner.label}"</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>gagnante {data.stats.topWinner.wins} fois</p>
                </div>
              )}
            </div>
          )}

          {/* ── Taux de clôture bar ───────────────────────────────────────── */}
          {data.stats.total > 0 && (
            <div className="rounded-xl p-4 mb-8" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>📈 Taux de clôture</span>
                <span className="text-xs font-bold" style={{ color: "#d4963a" }}>{data.stats.closeRate}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                <div className="h-full rounded-full" style={{ width: `${data.stats.closeRate}%`, background: "linear-gradient(90deg, #d4963a, #ec4899)" }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                <span>{data.stats.closed} clôturé{data.stats.closed !== 1 ? "s" : ""}</span>
                <span>{data.stats.open} en cours</span>
              </div>
            </div>
          )}

          {/* ── Historique ────────────────────────────────────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="font-bold text-sm">📜 Historique des sondages clôturés</h3>
            </div>

            {history.filter(s => s.closed).length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: "var(--muted-foreground)" }}>Aucun sondage clôturé pour le moment.</p>
            ) : (
              <>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {paginated.filter(s => s.closed).map((s) => {
                    const isOpen = expanded === s._id;
                    return (
                      <div key={s._id}>
                        <button
                          onClick={() => setExpanded(isOpen ? null : s._id)}
                          className="w-full px-5 py-3.5 flex items-start justify-between gap-4 text-left transition-colors"
                          style={{ background: isOpen ? "rgba(212,150,58,0.06)" : "transparent" }}
                          onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
                          onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-snug truncate">{s.question}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                              <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                                📅 {fmtDate(s.updatedAt)}
                              </span>
                              <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                                🗳️ {s.totalVotes} vote{s.totalVotes !== 1 ? "s" : ""}
                              </span>
                              {s.winner && (
                                <span className="text-[11px] font-semibold" style={{ color: "#d4963a" }}>
                                  🏆 {s.winner}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs mt-0.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>
                            {isOpen ? "▲" : "▼"}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="px-5 pb-4">
                            <VoteBar results={s.results} total={s.totalVotes} />
                            <p className="text-[10px] mt-3" style={{ color: "var(--muted-foreground)" }}>
                              Créé par {s.createdBy} · {fmtDate(s.createdAt)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <button
                      onClick={() => { setPage(p => Math.max(0, p - 1)); setExpanded(null); }}
                      disabled={page === 0}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 cursor-pointer"
                      style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                    >
                      ◀ Préc.
                    </button>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      Page {page + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); setExpanded(null); }}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 cursor-pointer"
                      style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                    >
                      Suiv. ▶
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
