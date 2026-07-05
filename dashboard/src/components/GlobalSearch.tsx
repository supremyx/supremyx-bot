import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { apiUrl } from "../lib/api";

interface SearchResult {
  type: "equipe" | "joueur";
  name: string;
  sub: string;
}

interface Props {
  onSelectTeam: (name: string) => void;
  onSelectPlayer: (name: string) => void;
}

export default function GlobalSearch({ onSelectTeam, onSelectPlayer }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setOpen(o => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(""); setResults([]); setActive(0); }
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const lq = query.toLowerCase();
    Promise.all([
      fetch(apiUrl(`/api/ranking`)).then(r => r.json()),
      fetch(apiUrl(`/api/players?limit=100`)).then(r => r.json()),
    ]).then(([teams, players]) => {
      const teamResults: SearchResult[] = (teams.ranking ?? [])
        .filter((t: { team: string }) => t.team.toLowerCase().includes(lq))
        .slice(0, 5)
        .map((t: { team: string; points: number; rank: number }) => ({ type: "equipe" as const, name: t.team, sub: `Rang #${t.rank} · ${t.points} pts` }));
      const playerResults: SearchResult[] = (players.players ?? [])
        .filter((p: { displayName: string; teamName: string }) => p.displayName.toLowerCase().includes(lq) || p.teamName.toLowerCase().includes(lq))
        .slice(0, 5)
        .map((p: { displayName: string; teamName: string; totalKills: number }) => ({ type: "joueur" as const, name: p.displayName, sub: `${p.teamName} · ${p.totalKills} kills` }));
      setResults([...teamResults, ...playerResults]);
      setActive(0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [query]);

  function select(r: SearchResult) {
    setOpen(false);
    if (r.type === "equipe") onSelectTeam(r.name);
    else onSelectPlayer(r.name);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === "Enter" && results[active]) select(results[active]);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors cursor-pointer"
        style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded font-mono opacity-60" style={{ background: "rgba(255,255,255,0.08)" }}>⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div ref={containerRef} className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <Search className="size-4 shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Rechercher une équipe ou un joueur…"
                className="flex-1 bg-transparent text-sm focus:outline-none"
                style={{ color: "var(--foreground)" }}
              />
              {loading && <div className="size-3.5 border-2 border-t-transparent rounded-full animate-spin shrink-0" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />}
              <kbd onClick={() => setOpen(false)} className="text-[10px] px-1.5 py-0.5 rounded font-mono cursor-pointer transition-colors" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>Esc</kbd>
            </div>

            {query ? (
              <div className="py-1 max-h-80 overflow-y-auto">
                {results.length === 0 && !loading && (
                  <p className="text-center text-sm py-8" style={{ color: "var(--muted-foreground)" }}>Aucun résultat pour « {query} »</p>
                )}
                {results.map((r, i) => (
                  <button
                    key={r.type + r.name}
                    onClick={() => select(r)}
                    onMouseEnter={() => setActive(i)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer"
                    style={{ background: i === active ? "rgba(212,150,58,0.1)" : "transparent" }}
                  >
                    <span className="text-lg">{r.type === "equipe" ? "🏆" : "💀"}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{r.name}</p>
                      <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{r.sub}</p>
                    </div>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full shrink-0" style={{
                      background: r.type === "equipe" ? "rgba(212,150,58,0.15)" : "rgba(248,113,113,0.15)",
                      color: r.type === "equipe" ? "var(--primary)" : "#f87171",
                      border: `1px solid ${r.type === "equipe" ? "rgba(212,150,58,0.3)" : "rgba(248,113,113,0.3)"}`,
                    }}>
                      {r.type === "equipe" ? "Équipe" : "Joueur"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-xs py-6" style={{ color: "var(--muted-foreground)" }}>Tape le nom d'une équipe ou d'un joueur</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
