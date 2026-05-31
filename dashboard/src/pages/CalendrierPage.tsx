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
  new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

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

function isToday(d: string) { return new Date(d).toDateString() === new Date().toDateString(); }
function isTomorrow(d: string) { const t = new Date(); t.setDate(t.getDate() + 1); return new Date(d).toDateString() === t.toDateString(); }

function dayLabel(day: string) {
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
    ]).then(([upcomingData, all]) => {
      const upcomingIds = new Set((upcomingData.schedule ?? []).map((m: ScheduledMatch) => m.id));
      const pastMatches = (all.schedule ?? []).filter((m: ScheduledMatch) => !upcomingIds.has(m.id) || m.completed);
      setUpcoming(upcomingData.schedule ?? []);
      setPast(pastMatches.reverse());
      setLoading(false);
    }).catch(() => { setError("Impossible de charger les données."); setLoading(false); });
  }, []);

  const groups = groupByDay(upcoming);
  const days = Object.keys(groups);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {!loading && !error && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Matchs à venir", value: upcoming.length, color: "var(--primary)" },
            { label: "Matchs passés",  value: past.length,     color: "var(--muted-foreground)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="text-2xl font-black" style={{ color }}>{value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="py-20 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>}
      {error && <div className="py-16 text-center"><div className="text-4xl mb-3">⚠️</div><p className="text-red-400 font-semibold">{error}</p></div>}

      {!loading && !error && (
        <>
          <div className="space-y-4">
            <h2 className="font-bold text-sm">Matchs à venir</h2>
            {days.length === 0 ? (
              <div className="rounded-xl py-14 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">Aucun match planifié pour le moment.</p>
              </div>
            ) : (
              days.map(day => (
                <div key={day}>
                  <div className="flex items-center gap-3 mb-2 px-1">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: isToday(day) ? "var(--primary)" : isTomorrow(day) ? "#34d399" : "var(--muted-foreground)" }}>
                      {dayLabel(day)}
                    </span>
                    <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  </div>

                  <div className="space-y-2">
                    {groups[day].map(m => (
                      <div key={m.id} className="rounded-xl px-5 py-4 flex items-center justify-between gap-4"
                        style={{ background: "var(--card)", border: `1px solid ${isToday(day) ? "rgba(212,150,58,0.3)" : "var(--border)"}` }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[46px]">
                            <p className="text-lg font-black leading-none" style={{ color: isToday(day) ? "var(--primary)" : "var(--foreground)" }}>
                              {fmtTime(m.date)}
                            </p>
                          </div>
                          <div className="w-px h-10" style={{ background: "var(--border)" }} />
                          <div>
                            <p className="font-semibold text-sm">
                              {m.teams && m.teams.length > 0 ? m.teams.join(" vs ") : <span style={{ color: "var(--muted-foreground)" }}>Équipes non définies</span>}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {m.tournamentName && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(212,150,58,0.15)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}>
                                  {m.tournamentName}
                                </span>
                              )}
                              {m.note && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{m.note}</span>}
                            </div>
                          </div>
                        </div>
                        {isToday(day) && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 px-2.5 py-1 rounded-full shrink-0" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
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

          {past.length > 0 && (
            <div>
              <button onClick={() => setShowPast(o => !o)}
                className="flex items-center gap-2 text-sm transition-colors cursor-pointer"
                style={{ color: "var(--muted-foreground)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--foreground)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--muted-foreground)")}
              >
                <span className="transition-transform duration-200" style={{ transform: showPast ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                <span>{showPast ? "Masquer" : "Voir"} les {past.length} match{past.length !== 1 ? "s" : ""} passé{past.length !== 1 ? "s" : ""}</span>
              </button>

              {showPast && (
                <div className="mt-4 space-y-2">
                  {past.map(m => (
                    <div key={m.id} className="rounded-xl px-5 py-3 flex items-center justify-between gap-4 opacity-50"
                      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[46px]">
                          <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
                            {new Date(m.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                          </p>
                          <p className="text-sm font-bold">{fmtTime(m.date)}</p>
                        </div>
                        <div className="w-px h-8" style={{ background: "var(--border)" }} />
                        <div>
                          <p className="font-semibold text-sm">{m.teams && m.teams.length > 0 ? m.teams.join(" vs ") : "—"}</p>
                          {m.tournamentName && <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{m.tournamentName}</p>}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
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
