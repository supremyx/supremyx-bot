import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Birthday {
  _id: string;
  userId: string;
  guildId: string;
  day: number;
  month: number;
  year?: number;
  daysUntil: number;
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MONTHS_LONG = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function pad(n: number) { return String(n).padStart(2, "0"); }

export default function BirthdaysPage() {
  const [upcoming, setUpcoming] = useState<Birthday[]>([]);
  const [all, setAll]           = useState<Birthday[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tab, setTab]           = useState<"upcoming" | "calendar">("upcoming");

  useEffect(() => {
    fetch(apiUrl("/api/birthdays"))
      .then(r => r.json())
      .then(d => {
        setUpcoming(d.upcoming ?? []);
        setAll(d.birthdays ?? []);
        setLoading(false);
      })
      .catch(() => { setError("Erreur de chargement"); setLoading(false); });
  }, []);

  if (loading) return <div className="py-24 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement des anniversaires…</div>;
  if (error)   return <div className="py-24 text-center text-red-400">{error}</div>;

  // Groupement par mois pour le calendrier
  const byMonth: Record<number, Birthday[]> = {};
  for (const b of all) {
    if (!byMonth[b.month]) byMonth[b.month] = [];
    byMonth[b.month].push(b);
  }

  const today = new Date();
  const isToday = (b: Birthday) => b.day === today.getDate() && b.month === today.getMonth() + 1;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">🎂 Anniversaires</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>{all.length} anniversaire(s) enregistré(s)</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["upcoming", "calendar"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            style={{
              background: tab === t ? "var(--primary)" : "var(--muted)",
              color:      tab === t ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {t === "upcoming" ? "🎉 Prochains" : "📆 Calendrier"}
          </button>
        ))}
      </div>

      {tab === "upcoming" && (
        <>
          {upcoming.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>Aucun anniversaire enregistré.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {upcoming.map((b, i) => (
                <div
                  key={b._id}
                  className="flex items-center gap-4 rounded-xl px-5 py-4 transition-all"
                  style={{
                    border: `1px solid ${isToday(b) ? "rgba(212,150,58,0.5)" : "var(--border)"}`,
                    background: isToday(b) ? "rgba(212,150,58,0.07)" : "var(--card)",
                  }}
                >
                  <div className="text-3xl">{isToday(b) ? "🎂" : i < 3 ? ["🥇","🥈","🥉"][i] : "🎁"}</div>
                  <div className="flex-1">
                    <div className="font-semibold">{isToday(b) ? "🎉 C'est aujourd'hui !" : ""}</div>
                    <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      {pad(b.day)} {MONTHS_LONG[b.month - 1]}{b.year ? ` ${b.year}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    {isToday(b) ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(212,150,58,0.2)", color: "var(--primary)" }}>Aujourd'hui !</span>
                    ) : (
                      <span className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>
                        dans {b.daysUntil}j
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "calendar" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
            const monthBirths = byMonth[m] ?? [];
            return (
              <div key={m} className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <span>{MONTHS_LONG[m - 1]}</span>
                  {monthBirths.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(212,150,58,0.2)", color: "var(--primary)" }}>{monthBirths.length}</span>
                  )}
                </h3>
                {monthBirths.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Aucun</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {monthBirths.sort((a, b) => a.day - b.day).map(b => (
                      <div key={b._id} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs w-6" style={{ color: "var(--primary)" }}>{pad(b.day)}</span>
                        <span style={{ color: "var(--muted-foreground)" }}>🎂</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
