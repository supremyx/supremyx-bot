import { useEffect, useState, useRef } from "react";
import { apiUrl } from "../lib/api";

interface LogEntry {
  _id: string;
  message: string;
  category: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  match:      "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  modération: "bg-red-500/20 text-red-300 border-red-500/30",
  tournoi:    "bg-amber-500/20 text-amber-300 border-amber-500/30",
  données:    "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  config:     "bg-purple-500/20 text-purple-300 border-purple-500/30",
  ticket:     "bg-pink-500/20 text-pink-300 border-pink-500/30",
  rang:       "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  trophée:    "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  événement:  "bg-orange-500/20 text-orange-300 border-orange-500/30",
  équipe:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  addmatch:   "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  unregister: "bg-red-500/20 text-red-300 border-red-500/30",
  resetmatch: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  général:    "bg-white/5 text-gray-400 border-white/10",
};

function badge(category: string) {
  return CATEGORY_COLORS[category] ?? "bg-white/5 text-gray-400 border-white/10";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day:    "2-digit", month: "2-digit", year: "numeric",
    hour:   "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function renderMessage(msg: string) {
  const parts = msg.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

const ALL = "tous";
const PAGE_SIZE = 30;

export default function LogsPage() {
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [filter, setFilter]         = useState<string>(ALL);
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchLogs() {
    try {
      const res = await fetch(apiUrl("/api/logs?limit=200"));
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setLogs(data.logs ?? []);
      setError(null);
    } catch {
      setError("Impossible de charger les logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 15_000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh]);

  const categories = [ALL, ...Array.from(new Set(logs.map(l => l.category))).sort()];

  const filtered = logs.filter(l => {
    const catOk = filter === ALL || l.category === filter;
    const q = search.trim().toLowerCase();
    const searchOk = !q || l.message.toLowerCase().includes(q) || l.category.toLowerCase().includes(q);
    return catOk && searchOk;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilter(cat: string) { setFilter(cat); setPage(1); }
  function handleSearch(v: string)   { setSearch(v); setPage(1); }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-bold text-lg">📋 Logs d'activité du bot</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {logs.length} entrée{logs.length !== 1 ? "s" : ""} · Actualisation {autoRefresh ? "auto (15s)" : "pausée"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            ↺ Actualiser
          </button>
          <button
            onClick={() => setAutoRefresh(p => !p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              autoRefresh
                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30"
                : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            {autoRefresh ? "⏸ Pause" : "▶ Auto"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher dans les logs…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500/60 transition-colors"
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => handleFilter(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer capitalize ${
              filter === cat
                ? cat === ALL
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : `${badge(cat)} ring-1 ring-white/20`
                : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            {cat === ALL ? "Tous" : cat}
            {cat !== ALL && (
              <span className="ml-1 opacity-60">
                {logs.filter(l => l.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Log list */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 animate-pulse">Chargement…</div>
      ) : error ? (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 py-16 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 py-16 text-center text-gray-500">
          <div className="text-3xl mb-2">🔍</div>
          <p className="text-sm">Aucun log correspondant.</p>
        </div>
      ) : (
        <>
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5">
            {paginated.map(log => (
              <div key={log._id} className="px-5 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                <span className={`mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${badge(log.category)}`}>
                  {log.category}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 leading-snug break-words">
                    {renderMessage(log.message)}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-1">{fmtDate(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                ← Préc.
              </button>
              <span className="text-xs text-gray-500">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Suiv. →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
