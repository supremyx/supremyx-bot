import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface ScheduledMatch {
  id: string;
  date: string;
  teams: string[];
  note: string;
  tournamentName: string;
  completed: boolean;
  resultPostedAt: string | null;
}

const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function groupByDay(matches: ScheduledMatch[]) {
  const groups: Record<string, ScheduledMatch[]> = {};
  for (const m of matches) {
    const day = new Date(m.date).toDateString();
    if (!groups[day]) groups[day] = [];
    groups[day].push(m);
  }
  return groups;
}

function isToday(d: string) {
  return new Date(d).toDateString() === new Date().toDateString();
}

function isTomorrow(d: string) {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return new Date(d).toDateString() === t.toDateString();
}

function dayLabel(day: string) {
  const date = new Date(day);
  if (isToday(day)) return "Aujourd'hui";
  if (isTomorrow(day)) return "Demain";
  return fmtDay(day);
}

export default function CalendrierPage() {
  const [upcoming, setUpcoming] = useState<ScheduledMatch[]>([]);
  const [past, setPast] = useState<ScheduledMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/schedule")).then(r => r.json()),
      fetch(apiUrl("/api/schedule?past=true")).then(r => r.json()),
    ]).then(([upcoming, all]) => {
      const upcomingIds = new Set((upcoming.schedule ?? []).map((m: ScheduledMatch) => m.id));
      const pastMatches = (all.schedule ?? []).filter(
        (m: ScheduledMatch) => !upcomingIds.has(m.id) || m.completed
      );
      setUpcoming(upcoming.schedule ?? []);
      setPast(pastMatches.reverse());
      setLoading(false);
    }).catch(() => {
      setError("Impossible de charger les données.");
      setLoading(false);
    });
  }, []);

  const groups = groupByDay(upcoming);
  const days = Object.keys(groups);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Summary cards */}
      {!loading && !error && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Matchs à venir",  value: upcoming.length, color: "text-indigo-400" },
            { label: "Matchs passés",   value: past.length,     color: "text-gray-400"   },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10 text-center">
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="py-20 text-center text-gray-400 animate-pulse">Chargement…</div>
      )}
      {error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Upcoming matches */}
          <div className="space-y-4">
            <h2 className="font-bold text-white">📅 Matchs à venir</h2>

            {days.length === 0 ? (
              <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 py-14 text-center text-gray-500">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">Aucun match planifié pour le moment.</p>
              </div>
            ) : (
              days.map(day => (
                <div key={day}>
                  {/* Day label */}
                  <div className="flex items-center gap-3 mb-2 px-1">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isToday(day) ? "text-indigo-400" : isTomorrow(day) ? "text-emerald-400" : "text-gray-500"
                    }`}>
                      {dayLabel(day)}
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <div className="space-y-2">
                    {groups[day].map(m => (
                      <div
                        key={m.id}
                        className={`bg-[#1a1a2e] rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${
                          isToday(day) ? "border-indigo-500/30" : "border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Time */}
                          <div className="text-center min-w-[46px]">
                            <p className={`text-lg font-black leading-none ${isToday(day) ? "text-indigo-300" : "text-white"}`}>
                              {fmtTime(m.date)}
                            </p>
                          </div>
                          <div className="w-px h-10 bg-white/10" />
                          {/* Teams */}
                          <div>
                            <p className="font-semibold text-white text-sm">
                              {m.teams && m.teams.length > 0
                                ? m.teams.join(" vs ")
                                : <span className="text-gray-500">Équipes non définies</span>}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {m.tournamentName && (
                                <span className="text-xs text-indigo-300 bg-indigo-400/10 border border-indigo-400/20 px-2 py-0.5 rounded-full">
                                  {m.tournamentName}
                                </span>
                              )}
                              {m.note && (
                                <span className="text-xs text-gray-400">{m.note}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isToday(day) && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Aujourd'hui
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Past matches toggle */}
          {past.length > 0 && (
            <div>
              <button
                onClick={() => setShowPast(o => !o)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer group"
              >
                <span className={`transition-transform duration-200 ${showPast ? "rotate-90" : ""}`}>▶</span>
                <span>{showPast ? "Masquer" : "Voir"} les {past.length} match{past.length !== 1 ? "s" : ""} passé{past.length !== 1 ? "s" : ""}</span>
              </button>

              {showPast && (
                <div className="mt-4 space-y-2">
                  {past.map(m => (
                    <div
                      key={m.id}
                      className="bg-[#1a1a2e] rounded-xl border border-white/10 px-5 py-3 flex items-center justify-between gap-4 opacity-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[46px]">
                          <p className="text-xs text-gray-400 font-semibold">
                            {new Date(m.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                          </p>
                          <p className="text-sm font-bold text-gray-300">{fmtTime(m.date)}</p>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div>
                          <p className="font-semibold text-white text-sm">
                            {m.teams && m.teams.length > 0 ? m.teams.join(" vs ") : "—"}
                          </p>
                          {m.tournamentName && (
                            <p className="text-xs text-gray-500 mt-0.5">{m.tournamentName}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0">
                        Terminé
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
