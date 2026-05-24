import { useEffect, useState } from "react";

interface Player {
  rank: number;
  displayName: string;
  teamName: string;
  totalKills: number;
  totalMatches: number;
  bestKills: number;
  avgKills: number;
  recentHistory: { kills: number; date: string }[];
}

interface PlayerDetail {
  displayName: string;
  teams: string[];
  totalKills: number;
  totalMatches: number;
  bestKills: number;
  avgKills: number;
  history: { kills: number; date: string; teamName?: string }[];
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function PlayerModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/players/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger les données."); setLoading(false); });
  }, [name]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#1a1a2e] z-10">
          <div>
            <h2 className="font-bold text-lg">{name}</h2>
            {detail && (
              <p className="text-xs text-gray-400 mt-0.5">
                {detail.teams.join(", ")} · {detail.totalMatches} match{detail.totalMatches !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer text-lg"
          >
            ×
          </button>
        </div>

        {loading && <div className="py-20 text-center text-gray-400 animate-pulse">Chargement…</div>}
        {error && <div className="py-20 text-center text-red-400">{error}</div>}

        {detail && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total kills",  value: detail.totalKills.toLocaleString("fr-FR"), color: "text-red-400" },
                { label: "Moy. kills",   value: detail.avgKills,                           color: "text-orange-400" },
                { label: "Best kills",   value: detail.bestKills,                          color: "text-yellow-400" },
                { label: "Matchs",       value: detail.totalMatches,                       color: "text-indigo-300" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                  <div className={`text-xl font-black ${color}`}>{value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {detail.history.length > 0 && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">
                  Historique des 20 derniers matchs
                </h3>
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-white/10">
                        <th className="py-2 px-3 text-left">Date</th>
                        <th className="py-2 px-3 text-center">Kills</th>
                        {detail.teams.length > 1 && (
                          <th className="py-2 px-3 text-left hidden sm:table-cell">Équipe</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.history.map((h, i) => (
                        <tr key={i} className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                          <td className="py-2 px-3 text-gray-400 text-xs">{fmtDate(h.date)}</td>
                          <td className="py-2 px-3 text-center text-red-400 font-bold">{h.kills}</td>
                          {detail.teams.length > 1 && (
                            <td className="py-2 px-3 text-gray-500 text-xs hidden sm:table-cell">
                              {h.teamName || "—"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoueursPage({ initialSelected }: { initialSelected?: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null);

  useEffect(() => {
    fetch("/api/players?limit=100")
      .then(r => r.json())
      .then(d => { setPlayers(d.players ?? []); setLoading(false); })
      .catch(() => { setError("Impossible de charger les données."); setLoading(false); });
  }, []);

  const filtered = players.filter(p =>
    p.displayName.toLowerCase().includes(search.toLowerCase()) ||
    p.teamName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {selected && <PlayerModal name={selected} onClose={() => setSelected(null)} />}

      {/* Summary cards */}
      {players.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Joueurs",        value: players.length,                                            color: "text-indigo-400" },
            { label: "Total kills",    value: players.reduce((s, p) => s + p.totalKills, 0).toLocaleString("fr-FR"), color: "text-red-400" },
            { label: "Meilleur kill",  value: Math.max(...players.map(p => p.bestKills), 0),             color: "text-yellow-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10 text-center">
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold">💀 Classement Joueurs</h2>
            <p className="text-xs text-gray-500 mt-0.5">Cliquer sur un joueur pour voir le détail</p>
          </div>
          {players.length > 0 && (
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-36"
            />
          )}
        </div>

        {loading && (
          <div className="py-16 text-center text-gray-400 animate-pulse">Chargement…</div>
        )}
        {error && (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-400 font-semibold">{error}</p>
          </div>
        )}
        {!loading && !error && players.length === 0 && (
          <div className="py-16 text-center text-gray-500">
            <div className="text-3xl mb-2">👤</div>
            <p className="text-sm">Aucun joueur enregistré pour le moment.</p>
          </div>
        )}
        {!loading && !error && players.length > 0 && filtered.length === 0 && (
          <div className="py-10 text-center text-gray-500 text-sm">Aucun résultat pour « {search} »</div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                  <th className="py-2 px-4 text-center">#</th>
                  <th className="py-2 px-4 text-left">Joueur</th>
                  <th className="py-2 px-4 text-left hidden sm:table-cell">Équipe</th>
                  <th className="py-2 px-4 text-center">Kills</th>
                  <th className="py-2 px-4 text-center hidden sm:table-cell">Moy.</th>
                  <th className="py-2 px-4 text-center hidden sm:table-cell">Best</th>
                  <th className="py-2 px-4 text-center hidden sm:table-cell">Matchs</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.displayName + p.teamName}
                    onClick={() => setSelected(p.displayName)}
                    className={`border-b border-white/10 cursor-pointer transition-colors hover:bg-indigo-500/10 ${
                      p.rank <= 3 ? "bg-white/5" : ""
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-bold text-lg w-12">
                      {search ? (
                        <span className="text-gray-400 text-base">{p.rank}</span>
                      ) : (
                        MEDAL[p.rank] ?? <span className="text-gray-400 text-base">{p.rank}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">{p.displayName}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs hidden sm:table-cell">{p.teamName}</td>
                    <td className="py-3 px-4 text-center text-red-400 font-bold text-base">
                      {p.totalKills.toLocaleString("fr-FR")}
                    </td>
                    <td className="py-3 px-4 text-center text-orange-400 hidden sm:table-cell">{p.avgKills}</td>
                    <td className="py-3 px-4 text-center text-yellow-400 hidden sm:table-cell">{p.bestKills}</td>
                    <td className="py-3 px-4 text-center text-gray-400 hidden sm:table-cell">{p.totalMatches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
