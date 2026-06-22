import { useEffect, useState, useRef } from "react";
import { apiUrl } from "../lib/api";

interface LogEntry {
  _id: string;
  message: string;
  category: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  match:          { bg: "rgba(99,102,241,0.15)",  text: "#a5b4fc", border: "rgba(99,102,241,0.3)"  },
  modération:     { bg: "rgba(239,68,68,0.15)",   text: "#fca5a5", border: "rgba(239,68,68,0.3)"   },
  tournoi:        { bg: "rgba(212,150,58,0.15)",  text: "#fcd34d", border: "rgba(212,150,58,0.3)"  },
  données:        { bg: "rgba(6,182,212,0.15)",   text: "#67e8f9", border: "rgba(6,182,212,0.3)"   },
  config:         { bg: "rgba(168,85,247,0.15)",  text: "#d8b4fe", border: "rgba(168,85,247,0.3)"  },
  ticket:         { bg: "rgba(236,72,153,0.15)",  text: "#f9a8d4", border: "rgba(236,72,153,0.3)"  },
  rang:           { bg: "rgba(52,211,153,0.15)",  text: "#6ee7b7", border: "rgba(52,211,153,0.3)"  },
  trophée:        { bg: "rgba(234,179,8,0.15)",   text: "#fde047", border: "rgba(234,179,8,0.3)"   },
  événement:      { bg: "rgba(249,115,22,0.15)",  text: "#fdba74", border: "rgba(249,115,22,0.3)"  },
  équipe:         { bg: "rgba(59,130,246,0.15)",  text: "#93c5fd", border: "rgba(59,130,246,0.3)"  },
  ajoutermatch:   { bg: "rgba(99,102,241,0.15)",  text: "#a5b4fc", border: "rgba(99,102,241,0.3)"  },
  desenregistrer: { bg: "rgba(239,68,68,0.15)",   text: "#fca5a5", border: "rgba(239,68,68,0.3)"   },
  reinitialiser:  { bg: "rgba(212,150,58,0.15)",  text: "#fcd34d", border: "rgba(212,150,58,0.3)"  },
  général:        { bg: "rgba(255,255,255,0.05)", text: "#9ca3af", border: "rgba(255,255,255,0.1)"  },
};

const DEFAULT_COLOR = { bg: "rgba(255,255,255,0.05)", text: "#9ca3af", border: "rgba(255,255,255,0.1)" };

function badge(category: string) {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function renderMessage(msg: string) {
  const parts = msg.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="font-semibold" style={{ color: "var(--foreground)" }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

const ALL = "tous";
const PAGE_SIZE = 30;

export default function LogsPage() {
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [filter, setFilter]           = useState<string>(ALL);
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
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

  useEffect(() => { fetchLogs(); }, []);
  useEffect(() => {
    if (autoRefresh) intervalRef.current = setInterval(fetchLogs, 15_000);
    else if (intervalRef.current) clearInterval(intervalRef.current);
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
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-bold text-lg">Logs d'activité</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {logs.length} entrée{logs.length !== 1 ? "s" : ""} · {autoRefresh ? "Actualisation auto (15s)" : "Pausé"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            ↺ Actualiser
          </button>
          <button
            onClick={() => setAutoRefresh(p => !p)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            style={{
              background: autoRefresh ? "rgba(52,211,153,0.15)" : "var(--muted)",
              border: `1px solid ${autoRefresh ? "rgba(52,211,153,0.3)" : "var(--border)"}`,
              color: autoRefresh ? "#34d399" : "var(--muted-foreground)",
            }}
          >
            {autoRefresh ? "⏸ Pause" : "▶ Auto"}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher dans les logs…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => {
          const c = badge(cat);
          const isActive = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => handleFilter(cat)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-all cursor-pointer"
              style={{
                background: isActive ? (cat === ALL ? "var(--primary)" : c.bg) : "var(--muted)",
                border: `1px solid ${isActive ? (cat === ALL ? "var(--primary)" : c.border) : "var(--border)"}`,
                color: isActive ? (cat === ALL ? "var(--primary-foreground)" : c.text) : "var(--muted-foreground)",
              }}
            >
              {cat === ALL ? "Tous" : cat}
              {cat !== ALL && (
                <span className="ml-1 opacity-60">{logs.filter(l => l.category === cat).length}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16 animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : error ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">🔍</div>
          <p className="text-sm">Aucun log correspondant.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            {paginated.map(log => {
              const c = badge(log.category);
              return (
                <div key={log._id} className="px-5 py-3 flex items-start gap-3 transition-colors" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                    {log.category}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug break-words" style={{ color: "var(--muted-foreground)" }}>
                      {renderMessage(log.message)}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "oklch(0.45 0 0)" }}>{fmtDate(log.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
              >
                ← Préc.
              </button>
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Page {page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
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
