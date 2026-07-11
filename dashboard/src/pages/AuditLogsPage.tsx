import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "../lib/api";

interface AuditEntry {
  _id: string;
  type: string;
  category: string;
  actorTag: string | null;
  targetTag: string | null;
  channelId: string | null;
  details: Record<string, unknown>;
  severity: "info" | "warn" | "critical";
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  message:    "#5865F2",
  member:     "#34D399",
  voice:      "#A78BFA",
  channel:    "#F59E0B",
  role:       "#EC4899",
  moderation: "#EF4444",
  general:    "#6B7280",
};

const SEVERITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  info:     { bg: "rgba(88,101,242,0.15)",  text: "#93c5fd", label: "Info" },
  warn:     { bg: "rgba(245,158,11,0.15)",  text: "#fbbf24", label: "Avert." },
  critical: { bg: "rgba(239,68,68,0.15)",   text: "#f87171", label: "Critique" },
};

const TYPE_EMOJI: Record<string, string> = {
  MESSAGE_DELETE: "🗑️", MESSAGE_EDIT: "✏️",
  MEMBER_JOIN: "🟢", MEMBER_LEAVE: "🔴", MEMBER_UPDATE: "👤",
  VOICE_JOIN: "🔊", VOICE_LEAVE: "🔇", VOICE_MOVE: "🔀",
  CHANNEL_CREATE: "📢", CHANNEL_DELETE: "💥", CHANNEL_UPDATE: "📝",
  ROLE_CREATE: "🏷️", ROLE_DELETE: "🗑️",
  BAN_ADD: "🔨", BAN_REMOVE: "✅",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function DetailSnippet({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length));
  if (!entries.length) return null;
  return (
    <div className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
      {entries.slice(0, 3).map(([k, v]) => (
        <span key={k} className="mr-2">
          <span className="opacity-60">{k}:</span> {String(Array.isArray(v) ? v.join(", ") : v).slice(0, 60)}
        </span>
      ))}
    </div>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs]         = useState<AuditEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [search, setSearch]     = useState("");
  const [limit, setLimit]       = useState(100);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit) });
    if (category !== "all") params.set("category", category);
    if (severity !== "all")  params.set("severity",  severity);
    if (search.trim())        params.set("search",    search.trim());
    const r = await fetch(apiUrl(`/api/audit-logs?${params}`)).then(r => r.json()).catch(() => ({ logs: [] }));
    setLogs(r.logs || []);
    setLoading(false);
  }, [category, severity, search, limit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const categories = ["all", "member", "message", "voice", "channel", "role", "moderation"];
  const severities  = ["all", "info", "warn", "critical"];

  const filtered = logs.filter(l => {
    if (search && !`${l.type} ${l.actorTag} ${l.targetTag}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">📋 Journaux d'Audit</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Traçabilité complète des événements du serveur — membres, messages, salons, rôles, modération.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="px-3 py-1.5 rounded text-sm flex-1 min-w-32"
          style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-3 py-1.5 rounded text-sm"
          style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          {categories.map(c => <option key={c} value={c}>{c === "all" ? "Toutes catégories" : c}</option>)}
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)}
          className="px-3 py-1.5 rounded text-sm"
          style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          {severities.map(s => <option key={s} value={s}>{s === "all" ? "Toutes sévérités" : s}</option>)}
        </select>
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

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {["member", "message", "moderation", "voice"].map(cat => {
          const count = logs.filter(l => l.category === cat).length;
          return (
            <div key={cat} className="rounded-xl p-3 text-center" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
              <div className="text-xl font-bold" style={{ color: CATEGORY_COLORS[cat] }}>{count}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{cat}</div>
            </div>
          );
        })}
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">🔄</div><p>Chargement...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">📋</div><p>Aucun événement trouvé.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(entry => {
            const sev = SEVERITY_STYLE[entry.severity] || SEVERITY_STYLE.info;
            const catColor = CATEGORY_COLORS[entry.category] || "#6B7280";
            return (
              <div key={entry._id}
                className="rounded-lg px-4 py-3 flex items-start gap-3"
                style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <div className="text-lg flex-shrink-0 mt-0.5">
                  {TYPE_EMOJI[entry.type] || "📌"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{entry.type.replace(/_/g, " ")}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${catColor}22`, color: catColor }}>{entry.category}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: sev.bg, color: sev.text }}>{sev.label}</span>
                    {entry.actorTag && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>par {entry.actorTag}</span>}
                    {entry.targetTag && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>→ {entry.targetTag}</span>}
                  </div>
                  <DetailSnippet details={entry.details} />
                </div>
                <div className="text-xs flex-shrink-0 mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {fmtDate(entry.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
        {filtered.length} événement{filtered.length !== 1 ? "s" : ""} · Auto-actualisation 15s · Conservation 30 jours
      </p>
    </div>
  );
}
