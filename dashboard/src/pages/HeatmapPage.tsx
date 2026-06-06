import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface MatchEntry {
  id: string;
  team: string;
  placement: number;
  kills: number;
  points: number;
  date: string;
}

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const DAYS_FR = ["L","M","M","J","V","S","D"];

function getColor(matches: MatchEntry[]) {
  if (!matches.length) return "var(--muted)";
  const wins = matches.filter(m => m.placement === 1).length;
  const avgPlacement = matches.reduce((s, m) => s + m.placement, 0) / matches.length;
  if (wins > 0) return "rgba(52,211,153,0.9)";
  if (avgPlacement <= 3) return "rgba(96,165,250,0.8)";
  if (avgPlacement <= 5) return "rgba(251,191,36,0.7)";
  return "rgba(248,113,113,0.6)";
}

function buildCalendarData(matches: MatchEntry[], year: number) {
  const byDate = new Map<string, MatchEntry[]>();
  for (const m of matches) {
    const d = new Date(m.date);
    if (d.getFullYear() !== year) continue;
    const key = d.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(m);
  }
  return byDate;
}

function WeekGrid({ year, byDate, onHover, onLeave }: {
  year: number;
  byDate: Map<string, MatchEntry[]>;
  onHover: (date: string, matches: MatchEntry[], rect: DOMRect) => void;
  onLeave: () => void;
}) {
  const jan1 = new Date(year, 0, 1);
  const startOffset = (jan1.getDay() + 6) % 7; // Monday=0
  const totalDays = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
  const weeks: (string | null)[][] = [];

  let week: (string | null)[] = Array(startOffset).fill(null);
  for (let d = 0; d < totalDays; d++) {
    const date = new Date(year, 0, d + 1);
    const key = date.toISOString().slice(0, 10);
    week.push(key);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }

  const monthLabels: { month: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((w, col) => {
    const first = w.find(d => d !== null);
    if (first) {
      const m = new Date(first).getMonth();
      if (m !== lastMonth) { monthLabels.push({ month: MONTHS_FR[m], col }); lastMonth = m; }
    }
  });

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ minWidth: weeks.length * 14 + 32 }}>
        {/* Month labels */}
        <div className="flex mb-1 pl-8">
          {weeks.map((_, col) => {
            const label = monthLabels.find(l => l.col === col);
            return (
              <div key={col} style={{ width: 14, flexShrink: 0, fontSize: 10, color: "var(--muted-foreground)" }}>
                {label ? label.month : ""}
              </div>
            );
          })}
        </div>
        <div className="flex">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-1" style={{ paddingTop: 2 }}>
            {DAYS_FR.map((d, i) => (
              <div key={i} style={{ height: 12, fontSize: 9, color: "var(--muted-foreground)", lineHeight: "12px", width: 14, textAlign: "right", paddingRight: 3 }}>
                {i % 2 === 0 ? d : ""}
              </div>
            ))}
          </div>
          {/* Grid */}
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-0.5 mr-0.5">
              {week.map((date, dIdx) => {
                const matches = date ? (byDate.get(date) ?? []) : [];
                const color = date ? getColor(matches) : "transparent";
                return (
                  <div
                    key={dIdx}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: date ? (matches.length ? color : "rgba(255,255,255,0.05)") : "transparent",
                      cursor: matches.length ? "pointer" : "default",
                      border: matches.length ? "1px solid rgba(255,255,255,0.1)" : "none",
                    }}
                    onMouseEnter={e => date && matches.length && onHover(date, matches, (e.target as HTMLElement).getBoundingClientRect())}
                    onMouseLeave={onLeave}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Tooltip {
  date: string;
  matches: MatchEntry[];
  x: number;
  y: number;
}

export default function HeatmapPage() {
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [teams, setTeams] = useState<string[]>([]);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch(apiUrl("/api/results?limit=500"))
      .then(r => r.json())
      .then(d => {
        const all: MatchEntry[] = (d.recentMatchEntries ?? []).map((m: MatchEntry) => ({ ...m }));
        setMatches(all);
        const uniqueTeams = [...new Set(all.map(m => m.team))].sort();
        setTeams(uniqueTeams);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = selectedTeam === "all" ? matches : matches.filter(m => m.team === selectedTeam);
  const byDate = buildCalendarData(filtered, year);

  const totalMatches = filtered.filter(m => {
    const d = new Date(m.date);
    return d.getFullYear() === year;
  }).length;
  const totalWins = filtered.filter(m => {
    const d = new Date(m.date);
    return d.getFullYear() === year && m.placement === 1;
  }).length;
  const matchDays = [...byDate.keys()].length;

  const availableYears = [...new Set(matches.map(m => new Date(m.date).getFullYear()))].sort().reverse();
  if (!availableYears.includes(year) && availableYears.length) setYear(availableYears[0]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10" onMouseLeave={() => setTooltip(null)}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">🗓️ Heatmap des Performances</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Calendrier des jours de match et résultats sur l'année
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          <option value="all">Toutes les équipes</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          {(availableYears.length ? availableYears : [new Date().getFullYear()]).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Matchs joués", value: totalMatches, color: "var(--primary)" },
          { label: "Victoires", value: totalWins, color: "#34d399" },
          { label: "Jours actifs", value: matchDays, color: "#60a5fa" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {loading ? (
          <div className="py-8 text-center" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
        ) : (
          <WeekGrid
            year={year}
            byDate={byDate}
            onHover={(date, dayMatches, rect) => setTooltip({ date, matches: dayMatches, x: rect.left, y: rect.top })}
            onLeave={() => setTooltip(null)}
          />
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 flex-wrap text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span>Moins</span>
          {[
            { color: "rgba(255,255,255,0.05)", label: "Aucun match" },
            { color: "rgba(248,113,113,0.6)", label: "Hors top 5" },
            { color: "rgba(251,191,36,0.7)", label: "Top 5" },
            { color: "rgba(96,165,250,0.8)", label: "Top 3" },
            { color: "rgba(52,211,153,0.9)", label: "Victoire" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color, border: "1px solid rgba(255,255,255,0.1)" }} />
              <span>{l.label}</span>
            </div>
          ))}
          <span>Plus</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-xl shadow-2xl p-4 text-sm pointer-events-none"
          style={{
            top: tooltip.y - 120,
            left: tooltip.x - 80,
            background: "var(--card)",
            border: "1px solid var(--border)",
            minWidth: 200,
          }}
        >
          <div className="font-bold mb-2">{new Date(tooltip.date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
          {tooltip.matches.map((m, i) => (
            <div key={i} className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>{m.team}</span>
              {" · "} Pl. {m.placement} · {m.kills} kills · {m.points} pts
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
