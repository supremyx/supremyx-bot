import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface MatchEntry {
  id: string;
  team: string;
  placement: number;
  kills: number;
  points: number;
  tournamentName: string | null;
  date: string;
}

interface CompletedMatch {
  id: string;
  date: string;
  teams: string[];
  tournamentName: string | null;
  resultPostedAt: string;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const placementColor = (p: number) => {
  if (p === 1) return "text-yellow-400";
  if (p === 2) return "text-gray-300";
  if (p === 3) return "text-amber-600";
  return "text-gray-400";
};

export default function ResultsPage() {
  const [entries, setEntries] = useState<MatchEntry[]>([]);
  const [completed, setCompleted] = useState<CompletedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"entries" | "completed">("entries");

  useEffect(() => {
    fetch(apiUrl("/api/results?limit=50"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setEntries(data.recentMatchEntries ?? []);
        setCompleted(data.completedMatches ?? []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("entries")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            tab === "entries"
              ? "bg-indigo-600 text-white"
              : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
          }`}
        >
          🎯 Résultats par équipe
        </button>
        <button
          onClick={() => setTab("completed")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            tab === "completed"
              ? "bg-indigo-600 text-white"
              : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
          }`}
        >
          ✅ Matchs terminés
        </button>
      </div>

      {loading && (
        <div className="py-20 text-center text-gray-400 animate-pulse text-sm">
          Chargement des résultats…
        </div>
      )}

      {error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
          <p className="text-gray-500 text-sm mt-1">
            Le bot Discord est peut-être hors ligne
          </p>
        </div>
      )}

      {!loading && !error && tab === "entries" && (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-bold">🎯 Derniers résultats de matchs</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {entries.length} entrée{entries.length !== 1 ? "s" : ""} récente
              {entries.length !== 1 ? "s" : ""}
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <p>Aucun résultat enregistré pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                    <th className="py-2 px-4 text-left">Date</th>
                    <th className="py-2 px-4 text-left">Équipe</th>
                    <th className="py-2 px-4 text-center">Place</th>
                    <th className="py-2 px-4 text-center">Points</th>
                    <th className="py-2 px-4 text-center">Kills</th>
                    <th className="py-2 px-4 text-left hidden sm:table-cell">
                      Tournoi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((m, i) => (
                    <tr
                      key={m.id}
                      className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                        i % 2 === 0 ? "" : "bg-white/[0.02]"
                      }`}
                    >
                      <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">
                        {fmtDate(m.date)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {m.team}
                      </td>
                      <td className={`py-3 px-4 text-center font-bold ${placementColor(m.placement)}`}>
                        {MEDAL[m.placement] ?? `#${m.placement}`}
                      </td>
                      <td className="py-3 px-4 text-center text-indigo-300 font-bold">
                        +{m.points}
                      </td>
                      <td className="py-3 px-4 text-center text-red-400 font-semibold">
                        {m.kills}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs hidden sm:table-cell">
                        {m.tournamentName ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && !error && tab === "completed" && (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-bold">✅ Matchs planifiés terminés</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {completed.length} match{completed.length !== 1 ? "s" : ""} terminé
              {completed.length !== 1 ? "s" : ""}
            </p>
          </div>

          {completed.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <div className="text-4xl mb-3">📅</div>
              <p>Aucun match planifié terminé pour le moment.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {completed.map((m) => (
                <div
                  key={m.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/5 transition-colors"
                >
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {(m.teams ?? []).map((team) => (
                        <span
                          key={team}
                          className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-xs font-semibold border border-indigo-500/30"
                        >
                          {team}
                        </span>
                      ))}
                    </div>
                    {m.tournamentName && (
                      <p className="text-xs text-gray-500">
                        🏆 {m.tournamentName}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500 shrink-0">
                    <div>Prévu : {fmtDate(m.date)}</div>
                    <div className="text-emerald-400">
                      Terminé : {fmtDate(m.resultPostedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
