import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Standing {
  rank: number;
  team: string;
  points: number;
  kills: number;
  wins: number;
  matches: number;
}

interface RoundEntry {
  team: string;
  placement: number;
  kills: number;
  points: number;
}

interface Round {
  roundNumber: number;
  date: string;
  entries: RoundEntry[];
}

interface TournamentDetail {
  tournament: {
    id: string;
    name: string;
    active: boolean;
    createdAt: string;
    endedAt: string | null;
  };
  standings: Standing[];
  rounds: Round[];
  matchCount: number;
  teamCount: number;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const placementColor = (p: number) => {
  if (p === 1) return "text-yellow-400 font-black";
  if (p === 2) return "text-gray-300 font-bold";
  if (p === 3) return "text-amber-600 font-bold";
  return "text-gray-500";
};

const rankRowStyle = (rank: number) => {
  if (rank === 1) return "bg-yellow-500/10 border-l-2 border-l-yellow-500";
  if (rank === 2) return "bg-gray-400/10 border-l-2 border-l-gray-400";
  if (rank === 3) return "bg-amber-700/10 border-l-2 border-l-amber-700";
  return "";
};

function Podium({ standings }: { standings: Standing[] }) {
  const top3 = standings.slice(0, 3);
  if (top3.length === 0) return null;

  const order = [1, 0, 2].filter(i => top3[i]); // silver, gold, bronze layout
  const heights = ["h-20", "h-28", "h-14"];
  const bgColors = ["bg-gray-400/20", "bg-yellow-500/20", "bg-amber-700/20"];
  const textColors = ["text-gray-300", "text-yellow-400", "text-amber-600"];
  const labels = ["🥈 2ème", "🥇 1er", "🥉 3ème"];

  return (
    <div className="flex items-end justify-center gap-3 py-6">
      {order.map((idx) => {
        const s = top3[idx];
        if (!s) return null;
        return (
          <div key={s.team} className="flex flex-col items-center gap-2 w-28">
            <p className={`text-xs font-black text-center truncate w-full text-center ${textColors[idx]}`}>
              {s.team}
            </p>
            <p className="text-xs text-gray-400">{s.points} pts</p>
            <div className={`w-full ${heights[idx]} ${bgColors[idx]} rounded-t-xl flex items-center justify-center`}>
              <span className="text-2xl">{["🥈", "🥇", "🥉"][idx]}</span>
            </div>
            <p className="text-[10px] text-gray-500">{labels[idx]}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function TournamentDetailView({
  tournamentId,
  onBack,
}: {
  tournamentId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [tab, setTab] = useState<"standings" | "rounds">("standings");

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl(`/api/tournaments/${tournamentId}`))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-400 animate-pulse text-sm">
        Chargement du tournoi…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-400 text-sm">{error ?? "Données introuvables"}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-400 cursor-pointer transition-colors"
        >
          ← Retour
        </button>
      </div>
    );
  }

  const { tournament, standings, rounds, matchCount, teamCount } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            ← Retour
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-lg truncate">{tournament.name}</h2>
              {tournament.active ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-0.5 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  En cours
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-500 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full shrink-0">
                  Terminé
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Créé le {fmtDate(tournament.createdAt)}
              {tournament.endedAt && ` · Terminé le ${fmtDate(tournament.endedAt)}`}
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 divide-x divide-white/10">
          {[
            { label: "Équipes", value: teamCount },
            { label: "Matchs enregistrés", value: matchCount },
            { label: "Rounds", value: rounds.length },
          ].map(({ label, value }) => (
            <div key={label} className="py-4 text-center">
              <div className="text-2xl font-black text-indigo-300">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Podium */}
      {standings.length >= 2 && !tournament.active && (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10">
            <h3 className="font-bold text-sm">🏆 Podium final</h3>
          </div>
          <Podium standings={standings} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(["standings", "rounds"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              tab === t ? "bg-indigo-600 text-white" : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {t === "standings" ? "📊 Classement" : `🎮 Rounds (${rounds.length})`}
          </button>
        ))}
      </div>

      {/* Standings table */}
      {tab === "standings" && (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
          {standings.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm">Aucun match enregistré dans ce tournoi.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                    <th className="py-2 px-4 text-center w-10">#</th>
                    <th className="py-2 px-4 text-left">Équipe</th>
                    <th className="py-2 px-4 text-center">Points</th>
                    <th className="py-2 px-4 text-center">Kills</th>
                    <th className="py-2 px-4 text-center hidden sm:table-cell">Victoires</th>
                    <th className="py-2 px-4 text-center hidden sm:table-cell">Matchs</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => (
                    <tr
                      key={s.team}
                      className={`border-b border-white/5 transition-colors hover:bg-white/5 ${rankRowStyle(s.rank)}`}
                    >
                      <td className="py-3 px-4 text-center font-black">
                        {MEDAL[s.rank] ?? <span className="text-gray-400">{s.rank}</span>}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">{s.team}</td>
                      <td className="py-3 px-4 text-center text-indigo-300 font-black text-base">{s.points}</td>
                      <td className="py-3 px-4 text-center text-red-400 font-semibold">{s.kills}</td>
                      <td className="py-3 px-4 text-center text-emerald-400 hidden sm:table-cell">{s.wins}</td>
                      <td className="py-3 px-4 text-center text-gray-500 hidden sm:table-cell">{s.matches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rounds */}
      {tab === "rounds" && (
        <div className="space-y-3">
          {rounds.length === 0 ? (
            <div className="py-16 text-center text-gray-500 bg-[#1a1a2e] rounded-2xl border border-white/10">
              <div className="text-4xl mb-3">🎮</div>
              <p className="text-sm">Aucun round enregistré pour le moment.</p>
            </div>
          ) : (
            rounds.map((round) => {
              const isOpen = expandedRound === round.roundNumber;
              const winner = round.entries.find(e => e.placement === 1);
              return (
                <div
                  key={round.roundNumber}
                  className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedRound(isOpen ? null : round.roundNumber)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-sm shrink-0">
                        {round.roundNumber}
                      </span>
                      <div className="text-left">
                        <p className="font-semibold text-sm">Round {round.roundNumber}</p>
                        <p className="text-xs text-gray-500">
                          {fmtDate(round.date)} à {fmtTime(round.date)}
                          {winner && <span className="ml-2 text-yellow-400">· 🥇 {winner.team}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{round.entries.length} équipe{round.entries.length !== 1 ? "s" : ""}</span>
                      <span className={`text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                        ▼
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/10 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                            <th className="py-2 px-4 text-center">Place</th>
                            <th className="py-2 px-4 text-left">Équipe</th>
                            <th className="py-2 px-4 text-center">Points</th>
                            <th className="py-2 px-4 text-center">Kills</th>
                          </tr>
                        </thead>
                        <tbody>
                          {round.entries.map((e, i) => (
                            <tr
                              key={e.team}
                              className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                            >
                              <td className={`py-2.5 px-4 text-center ${placementColor(e.placement)}`}>
                                {e.placement > 0 ? (MEDAL[e.placement] ?? `#${e.placement}`) : "—"}
                              </td>
                              <td className="py-2.5 px-4 font-semibold text-white">{e.team}</td>
                              <td className="py-2.5 px-4 text-center text-indigo-300 font-bold">+{e.points}</td>
                              <td className="py-2.5 px-4 text-center text-red-400">{e.kills}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
