import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "../lib/api";

interface SayLogEntry {
  _id: string;
  channelId: string;
  channelName: string | null;
  authorId: string;
  authorTag: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function SayLogsPage() {
  const [logs, setLogs]       = useState<SayLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [limit, setLimit]     = useState(100);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit) });
    if (search.trim()) params.set("search", search.trim());
    const r = await fetch(apiUrl(`/api/say-logs?${params}`)).then(r => r.json()).catch(() => ({ logs: [] }));
    setLogs(r.logs || []);
    setLoading(false);
  }, [search, limit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">📢 Historique !dire</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Retrouve tous les messages publiés via la commande <code>!dire</code> — salon, auteur et contenu.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par texte, auteur ou salon..."
          className="px-3 py-1.5 rounded text-sm flex-1 min-w-32"
          style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}
          className="px-3 py-1.5 rounded text-sm"
          style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          {[50, 100, 250, 500].map(n => <option key={n} value={n}>{n} entrées</option>)}
        </select>
        <button onClick={load}
          className="px-4 py-1.5 rounded text-sm font-medium cursor-pointer"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
          ↻ Actualiser
        </button>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">🔄</div><p>Chargement...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">📢</div><p>Aucun message publié via !dire pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(entry => (
            <div key={entry._id}
              className="rounded-lg px-4 py-3"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(88,101,242,0.15)", color: "#93c5fd" }}>
                  #{entry.channelName || entry.channelId}
                </span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  par <strong>{entry.authorTag}</strong>
                </span>
                <span className="text-xs ml-auto" style={{ color: "var(--muted-foreground)" }}>
                  {fmtDate(entry.createdAt)}
                </span>
              </div>
              {entry.content && (
                <p className="text-sm whitespace-pre-wrap break-words">{entry.content}</p>
              )}
              {entry.mediaUrls.length > 0 && (
                <div className="mt-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  📎 {entry.mediaUrls.length} média{entry.mediaUrls.length > 1 ? "s" : ""} joint{entry.mediaUrls.length > 1 ? "s" : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
        {logs.length} message{logs.length !== 1 ? "s" : ""} · Auto-actualisation 15s
      </p>
    </div>
  );
}
