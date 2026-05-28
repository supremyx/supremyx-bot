import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";
import TournamentDetailView from "./TournamentDetailView";

interface Tournament {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  endedAt: string | null;
}

interface CompletedMatch {
  id: string;
  date: string;
  teams: string[];
  tournamentName: string;
  resultPostedAt: string;
}

interface RecentMatchEntry {
  id: string;
  team: string;
  placement: number;
  kills: number;
  points: number;
  tournamentName: string;
  date: string;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function TournoisPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [completed, setCompleted] = useState<CompletedMatch[]>([]);
  const [recent, setRecent] = useState<RecentMatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tournois" | "resultats">("tournois");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/tournaments")).then(r => r.json()),
      fetch(apiUrl("/api/results")).then(r => r.json()),
    ])
      .then(([t, r]) => {
        setTournaments(t.tournaments ?? []);
        setCompleted(r.completedMatches ?? []);
        setRecent(r.recentMatchEntries ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Impossible de charger les données.");
        setLoading(false);
      });
  }, []);

  const active = tournaments.filter(t => t.active);
  const ended = tournaments.filter(t => !t.active);

  // If a tournament is selected, show its detail
  if (selectedId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <TournamentDetailView
          tournamentId={selectedId}
          onBack={() => setSelectedId(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Tabs */}
      <div className="flex gap-2 bg-[#1a1a2e] rounded-xl p-1 border border-white/10 w-fit">
        {(["tournois", "resultats"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === tab
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "tournois" ? "🏆 Tournois" : "📊 Résultats"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-20 text-center text-gray-400 animate-pulse">Chargement…</div>
      )}
      {error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      )}

      {!loading && !error && activeTab === "tournois" && (
        <div className="space-y-6">
          {/* Active tournaments */}
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="font-bold">🟢 Tournois actifs</h2>
              <p className="text-xs text-gray-500 mt-0.5">Cliquer pour voir le classement et les rounds</p>
            </div>
            {active.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">Aucun tournoi en cours.</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/10">
                {active.map(t => (
                  <li
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className="px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <div>
                      <p className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {t.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Créé le {fmtDate(t.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        En cours
                      </span>
                      <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-sm">›</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Ended tournaments */}
          {ended.length > 0 && (
            <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="font-bold text-gray-400">⚫ Tournois terminés</h2>
                <p className="text-xs text-gray-500 mt-0.5">Cliquer pour consulter les résultats</p>
              </div>
              <ul className="divide-y divide-white/10">
                {ended.map(t => (
                  <li
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className="px-5 py-4 flex items-center justify-between opacity-70 hover:opacity-100 hover:bg-white/5 transition-all cursor-pointer group"
                  >
                    <div>
                      <p className="font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Créé le {fmtDate(t.createdAt)}
                        {t.endedAt && ` · Terminé le ${fmtDate(t.endedAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-gray-500 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                        Terminé
                      </span>
                      <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-sm">›</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tournaments.length === 0 && (
            <div className="py-16 text-center text-gray-500">
              <div className="text-4xl mb-3">🏆</div>
              <p className="text-sm">Aucun tournoi enregistré pour le moment.</p>
              <p className="text-xs text-gray-600 mt-1">Utilise <code className="bg-white/5 px-1 rounded">!starttournoi</code> dans Discord</p>
            </div>
          )}
        </div>
      )}

      {!loading && !error && activeTab === "resultats" && (
        <div className="space-y-6">
          {/* Recent match entries */}
          <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="font-bold">🎮 Derniers matchs enregistrés</h2>
              <p className="text-xs text-gray-500 mt-0.5">20 entrées les plus récentes</p>
            </div>
            {recent.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-sm">Aucun match enregistré pour le moment.</p>
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
                      <th className="py-2 px-4 text-left hidden sm:table-cell">Tournoi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((m, i) => (
                      <tr
                        key={m.id}
                        className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                      >
                        <td className="py-2.5 px-4 text-gray-400 text-xs">{fmtDateShort(m.date)}</td>
                        <td className="py-2.5 px-4 font-semibold text-white">{m.team}</td>
                        <td className="py-2.5 px-4 text-center font-bold">
                          {m.placement > 0
                            ? (MEDAL[m.placement] ?? `#${m.placement}`)
                            : <span className="text-gray-500">—</span>}
                        </td>
                        <td className="py-2.5 px-4 text-center text-indigo-300 font-bold">+{m.points}</td>
                        <td className="py-2.5 px-4 text-center text-red-400">{m.kills}</td>
                        <td className="py-2.5 px-4 text-gray-500 text-xs hidden sm:table-cell truncate max-w-[140px]">
                          {m.tournamentName || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Completed scheduled matches */}
          {completed.length > 0 && (
            <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="font-bold">✅ Matchs planifiés terminés</h2>
              </div>
              <ul className="divide-y divide-white/10">
                {completed.map(m => (
                  <li key={m.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {m.teams?.join(" vs ") || "—"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {m.tournamentName && `${m.tournamentName} · `}
                        {fmtDate(m.resultPostedAt)}
                      </p>
                    </div>
                    <span className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                      Terminé
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
