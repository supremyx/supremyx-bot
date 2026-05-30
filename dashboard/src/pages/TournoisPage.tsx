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
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
      {children}
    </div>
  );
}

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
    ]).then(([t, r]) => {
      setTournaments(t.tournaments ?? []);
      setCompleted(r.completedMatches ?? []);
      setRecent(r.recentMatchEntries ?? []);
      setLoading(false);
    }).catch(() => { setError("Impossible de charger les données."); setLoading(false); });
  }, []);

  const active = tournaments.filter(t => t.active);
  const ended = tournaments.filter(t => !t.active);

  if (selectedId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <TournamentDetailView tournamentId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {(["tournois", "resultats"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            style={{
              background: activeTab === tab ? "var(--primary)" : "transparent",
              color: activeTab === tab ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
          >
            {tab === "tournois" ? "🏆 Tournois" : "📊 Résultats"}
          </button>
        ))}
      </div>

      {loading && <div className="py-20 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>}
      {error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      )}

      {!loading && !error && activeTab === "tournois" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-bold text-sm">Tournois actifs</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Cliquer pour voir le classement et les rounds</p>
            </CardHeader>
            {active.length === 0 ? (
              <div className="py-12 text-center" style={{ color: "var(--muted-foreground)" }}>
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">Aucun tournoi en cours.</p>
              </div>
            ) : (
              <ul>
                {active.map(t => (
                  <li key={t.id} onClick={() => setSelectedId(t.id)}
                    className="px-5 py-4 flex items-center justify-between transition-colors cursor-pointer"
                    style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,150,58,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Créé le {fmtDate(t.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 px-2.5 py-1 rounded-full" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        En cours
                      </span>
                      <span style={{ color: "var(--muted-foreground)" }}>›</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {ended.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-bold text-sm" style={{ color: "var(--muted-foreground)" }}>Tournois terminés</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Cliquer pour consulter les résultats</p>
              </CardHeader>
              <ul>
                {ended.map(t => (
                  <li key={t.id} onClick={() => setSelectedId(t.id)}
                    className="px-5 py-4 flex items-center justify-between transition-all cursor-pointer opacity-70 hover:opacity-100"
                    style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        Créé le {fmtDate(t.createdAt)}{t.endedAt && ` · Terminé le ${fmtDate(t.endedAt)}`}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                      Terminé
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {tournaments.length === 0 && (
            <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
              <div className="text-4xl mb-3">🏆</div>
              <p className="text-sm">Aucun tournoi enregistré pour le moment.</p>
              <p className="text-xs mt-1">Utilise <code className="px-1 rounded text-xs" style={{ background: "var(--muted)" }}>!starttournoi</code> dans Discord</p>
            </div>
          )}
        </div>
      )}

      {!loading && !error && activeTab === "resultats" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-bold text-sm">Derniers matchs enregistrés</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>20 entrées les plus récentes</p>
            </CardHeader>
            {recent.length === 0 ? (
              <div className="py-12 text-center" style={{ color: "var(--muted-foreground)" }}>
                <div className="text-3xl mb-2">📋</div>
                <p className="text-sm">Aucun match enregistré pour le moment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
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
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                        <td className="py-2.5 px-4 text-xs" style={{ color: "var(--muted-foreground)" }}>{fmtDateShort(m.date)}</td>
                        <td className="py-2.5 px-4 font-semibold text-sm">{m.team}</td>
                        <td className="py-2.5 px-4 text-center font-bold">
                          {m.placement > 0 ? (MEDAL[m.placement] ?? `#${m.placement}`) : <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold" style={{ color: "var(--primary)" }}>+{m.points}</td>
                        <td className="py-2.5 px-4 text-center text-red-400">{m.kills}</td>
                        <td className="py-2.5 px-4 text-xs hidden sm:table-cell truncate max-w-[140px]" style={{ color: "var(--muted-foreground)" }}>{m.tournamentName || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {completed.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="font-bold text-sm">Matchs planifiés terminés</h2>
              </CardHeader>
              <ul>
                {completed.map(m => (
                  <li key={m.id} className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <p className="text-sm font-semibold">{m.teams?.join(" vs ") || "—"}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        {m.tournamentName && `${m.tournamentName} · `}{fmtDate(m.resultPostedAt)}
                      </p>
                    </div>
                    <span className="text-xs text-emerald-400 px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
                      Terminé
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
