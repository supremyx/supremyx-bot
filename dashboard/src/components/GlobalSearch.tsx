import { useEffect, useRef, useState } from "react";

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

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setActive(0);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const q = encodeURIComponent(query.trim());

    Promise.all([
      fetch(`/api/ranking`).then(r => r.json()),
      fetch(`/api/players?limit=100`).then(r => r.json()),
    ]).then(([teams, players]) => {
      const lq = query.toLowerCase();

      const teamResults: SearchResult[] = (teams.ranking ?? [])
        .filter((t: { team: string; points: number; kills: number }) =>
          t.team.toLowerCase().includes(lq)
        )
        .slice(0, 5)
        .map((t: { team: string; points: number; rank: number }) => ({
          type: "equipe" as const,
          name: t.team,
          sub: `Rang #${t.rank} · ${t.points} pts`,
        }));

      const playerResults: SearchResult[] = (players.players ?? [])
        .filter((p: { displayName: string; teamName: string }) =>
          p.displayName.toLowerCase().includes(lq) ||
          p.teamName.toLowerCase().includes(lq)
        )
        .slice(0, 5)
        .map((p: { displayName: string; teamName: string; totalKills: number; rank: number }) => ({
          type: "joueur" as const,
          name: p.displayName,
          sub: `${p.teamName} · ${p.totalKills} kills`,
        }));

      setResults([...teamResults, ...playerResults]);
      setActive(0);
      setLoading(false);
    }).catch(() => setLoading(false));

    // suppress unused warning
    void q;
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
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="hidden sm:inline text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono opacity-60">⌘K</kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm">
          <div
            ref={containerRef}
            className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Rechercher une équipe ou un joueur…"
                className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
              />
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-indigo-400/40 border-t-indigo-400 rounded-full animate-spin shrink-0" />
              )}
              <kbd
                onClick={() => setOpen(false)}
                className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono text-gray-400 cursor-pointer hover:bg-white/20"
              >
                Esc
              </kbd>
            </div>

            {/* Results */}
            {query && (
              <div className="py-1 max-h-80 overflow-y-auto">
                {results.length === 0 && !loading && (
                  <p className="text-center text-gray-500 text-sm py-8">
                    Aucun résultat pour « {query} »
                  </p>
                )}
                {results.map((r, i) => (
                  <button
                    key={r.type + r.name}
                    onClick={() => select(r)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                      i === active ? "bg-indigo-600/20" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="text-lg">
                      {r.type === "equipe" ? "🏆" : "💀"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                      <p className="text-xs text-gray-400 truncate">{r.sub}</p>
                    </div>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                      r.type === "equipe"
                        ? "text-indigo-300 bg-indigo-400/10 border-indigo-400/20"
                        : "text-red-300 bg-red-400/10 border-red-400/20"
                    }`}>
                      {r.type === "equipe" ? "Équipe" : "Joueur"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!query && (
              <p className="text-center text-gray-600 text-xs py-6">
                Tape le nom d'une équipe ou d'un joueur
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
