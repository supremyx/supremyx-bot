import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const placementColor = (p: number) => {
  if (p === 1) return "#facc15";
  if (p === 2) return "#d1d5db";
  if (p === 3) return "#d97706";
  return "var(--muted-foreground)";
};

const rankRowBg = (rank: number) => {
  if (rank === 1) return "rgba(234,179,8,0.06)";
  if (rank === 2) return "rgba(209,213,219,0.04)";
  if (rank === 3) return "rgba(217,119,6,0.04)";
  return "transparent";
};

const rankRowBorder = (rank: number) => {
  if (rank === 1) return "#eab308";
  if (rank === 2) return "#9ca3af";
  if (rank === 3) return "#d97706";
  return "transparent";
};

function Podium({ standings }: { standings: Standing[] }) {
  const top3 = standings.slice(0, 3);
  if (top3.length === 0) return null;

  const order = [1, 0, 2].filter(i => top3[i]);
  const heights = ["h-20", "h-28", "h-14"];
  const podiumColors = [
    { bg: "rgba(209,213,219,0.15)", border: "rgba(209,213,219,0.3)", text: "#d1d5db" },
    { bg: "rgba(234,179,8,0.15)",   border: "rgba(234,179,8,0.3)",   text: "#fde047" },
    { bg: "rgba(217,119,6,0.15)",   border: "rgba(217,119,6,0.3)",   text: "#d97706" },
  ];
  const labels = ["🥈 2ème", "🥇 1er", "🥉 3ème"];
  const emojis = ["🥈", "🥇", "🥉"];

  return (
    <div className="flex items-end justify-center gap-3 py-6">
      {order.map(idx => {
        const s = top3[idx];
        if (!s) return null;
        const pc = podiumColors[idx];
        return (
          <div key={s.team} className="flex flex-col items-center gap-2 w-28">
            <p className="text-xs font-black text-center truncate w-full" style={{ color: pc.text }}>{s.team}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.points} pts</p>
            <div className={`w-full ${heights[idx]} rounded-t-xl flex items-center justify-center`} style={{ background: pc.bg, border: `1px solid ${pc.border}`, borderBottom: "none" }}>
              <span className="text-2xl">{emojis[idx]}</span>
            </div>
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{labels[idx]}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function TournamentDetailView({ tournamentId, onBack }: { tournamentId: string; onBack: () => void }) {
  const [data, setData] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [tab, setTab] = useState<"classement" | "manches">("classement");

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl(`/api/tournaments/${tournamentId}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [tournamentId]);

  if (loading) return <div className="py-16 text-center animate-pulse text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement du tournoi…</div>;

  if (error || !data) return (
    <div className="py-12 text-center">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="text-red-400 text-sm">{error ?? "Données introuvables"}</p>
      <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>← Retour</button>
    </div>
  );

  const { tournament, standings, rounds, matchCount, teamCount } = data;

  return (
    <div className="space-y-6">
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <button onClick={onBack} className="px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>← Retour</button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-lg truncate">{tournament.name}</h2>
              {tournament.active ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 px-2.5 py-0.5 rounded-full shrink-0" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  En cours
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                  Terminé
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Créé le {fmtDate(tournament.createdAt)}{tournament.endedAt && ` · Terminé le ${fmtDate(tournament.endedAt)}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3" style={{ borderBottom: "1px solid var(--border)" }}>
          {[
            { label: "Équipes", value: teamCount },
            { label: "Matchs enregistrés", value: matchCount },
            { label: "Manches", value: rounds.length },
          ].map(({ label, value }, i) => (
            <div key={label} className="py-4 text-center" style={{ borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
              <div className="text-2xl font-black" style={{ color: "var(--primary)" }}>{value}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {standings.length >= 2 && !tournament.active && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="font-bold text-sm">🏆 Podium final</h3>
          </div>
          <Podium standings={standings} />
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {(["classement", "manches"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            style={{ background: tab === t ? "var(--primary)" : "transparent", color: tab === t ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
          >
            {t === "classement" ? "📊 Classement" : `🎮 Manches (${rounds.length})`}
          </button>
        ))}
      </div>

      {tab === "classement" && (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {standings.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm">Aucun match enregistré dans ce tournoi.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 flex justify-end" style={{ borderBottom: "1px solid var(--border)" }}>
                <button
                  onClick={() => {
                    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                    const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

                    doc.setFillColor(212, 150, 58);
                    doc.rect(0, 0, 210, 20, "F");
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.text(`SUPREMYX CI — ${tournament.name}`, 14, 13);

                    doc.setFillColor(30, 28, 40);
                    doc.rect(0, 20, 210, 10, "F");
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(180, 180, 190);
                    const status = tournament.active ? "En cours" : "Terminé";
                    doc.text(`Généré le ${date}  ·  ${standings.length} équipe${standings.length > 1 ? "s" : ""}  ·  ${matchCount} matchs  ·  ${status}`, 14, 27);

                    autoTable(doc, {
                      startY: 34,
                      head: [["#", "Équipe", "Points", "Kills", "Victoires", "Matchs"]],
                      body: standings.map(s => [
                        s.rank,
                        s.team,
                        s.points.toLocaleString("fr-FR"),
                        s.kills.toLocaleString("fr-FR"),
                        s.wins,
                        s.matches,
                      ]),
                      styles: {
                        fontSize: 9,
                        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
                        textColor: [220, 220, 230],
                        fillColor: [22, 21, 30],
                        lineColor: [50, 48, 65],
                        lineWidth: 0.2,
                      },
                      headStyles: {
                        fillColor: [40, 38, 55],
                        textColor: [212, 150, 58],
                        fontStyle: "bold",
                        fontSize: 8,
                        halign: "center",
                      },
                      columnStyles: {
                        0: { halign: "center", cellWidth: 12 },
                        1: { halign: "left",   cellWidth: 70 },
                        2: { halign: "center", cellWidth: 28, textColor: [212, 150, 58] as [number, number, number], fontStyle: "bold" },
                        3: { halign: "center", cellWidth: 24, textColor: [248, 113, 113] as [number, number, number] },
                        4: { halign: "center", cellWidth: 28, textColor: [52, 211, 153] as [number, number, number] },
                        5: { halign: "center", cellWidth: 24 },
                      },
                      alternateRowStyles: { fillColor: [26, 24, 38] },
                      didDrawRow: (data) => {
                        if (data.row.index < 3) {
                          const colors: [number, number, number][] = [[250, 204, 21], [209, 213, 219], [217, 119, 6]];
                          doc.setFillColor(...colors[data.row.index]);
                          doc.rect(14, data.row.y, 1.5, data.row.height, "F");
                        }
                      },
                    });

                    const pageH = doc.internal.pageSize.height;
                    doc.setFillColor(30, 28, 40);
                    doc.rect(0, pageH - 10, 210, 10, "F");
                    doc.setFontSize(7);
                    doc.setTextColor(120, 120, 130);
                    doc.text("© 2026 SUPREMYX — Côte d'Ivoire · supremyx.pro", 14, pageH - 3.5);

                    const slug = tournament.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                    doc.save(`supremyx-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  style={{ background: "rgba(212,150,58,0.15)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}
                >
                  📄 PDF
                </button>
              </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                    <th className="py-2 px-4 text-center w-10">#</th>
                    <th className="py-2 px-4 text-left">Équipe</th>
                    <th className="py-2 px-4 text-center">Points</th>
                    <th className="py-2 px-4 text-center">Kills</th>
                    <th className="py-2 px-4 text-center hidden sm:table-cell">Victoires</th>
                    <th className="py-2 px-4 text-center hidden sm:table-cell">Matchs</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map(s => (
                    <tr key={s.team} className="transition-colors" style={{ borderBottom: "1px solid var(--border)", background: rankRowBg(s.rank), borderLeft: `2px solid ${rankRowBorder(s.rank)}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.background = rankRowBg(s.rank))}
                    >
                      <td className="py-3 px-4 text-center font-black">{MEDAL[s.rank] ?? <span style={{ color: "var(--muted-foreground)" }}>{s.rank}</span>}</td>
                      <td className="py-3 px-4 font-semibold">{s.team}</td>
                      <td className="py-3 px-4 text-center font-black text-base" style={{ color: "var(--primary)" }}>{s.points}</td>
                      <td className="py-3 px-4 text-center text-red-400 font-semibold">{s.kills}</td>
                      <td className="py-3 px-4 text-center text-emerald-400 hidden sm:table-cell">{s.wins}</td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell" style={{ color: "var(--muted-foreground)" }}>{s.matches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {tab === "manches" && (
        <div className="space-y-3">
          {rounds.length === 0 ? (
            <div className="py-16 text-center rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
              <div className="text-4xl mb-3">🎮</div>
              <p className="text-sm">Aucun round enregistré pour le moment.</p>
            </div>
          ) : (
            rounds.map(round => {
              const isOpen = expandedRound === round.roundNumber;
              const winner = round.entries.find(e => e.placement === 1);
              return (
                <div key={round.roundNumber} className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <button onClick={() => setExpandedRound(isOpen ? null : round.roundNumber)}
                    className="w-full px-5 py-4 flex items-center justify-between transition-colors cursor-pointer"
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-8 rounded-full flex items-center justify-center font-black text-sm shrink-0" style={{ background: "rgba(212,150,58,0.15)", border: "1px solid rgba(212,150,58,0.3)", color: "var(--primary)" }}>
                        {round.roundNumber}
                      </span>
                      <div className="text-left">
                        <p className="font-semibold text-sm">Round {round.roundNumber}</p>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {fmtDate(round.date)} à {fmtTime(round.date)}
                          {winner && <span className="ml-2 text-yellow-400">· 🥇 {winner.team}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{round.entries.length} équipe{round.entries.length !== 1 ? "s" : ""}</span>
                      <span className="transition-transform duration-200" style={{ color: "var(--muted-foreground)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="overflow-x-auto" style={{ borderTop: "1px solid var(--border)" }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                            <th className="py-2 px-4 text-center">Place</th>
                            <th className="py-2 px-4 text-left">Équipe</th>
                            <th className="py-2 px-4 text-center">Points</th>
                            <th className="py-2 px-4 text-center">Kills</th>
                          </tr>
                        </thead>
                        <tbody>
                          {round.entries.map((e, i) => (
                            <tr key={e.team} style={{ borderBottom: "1px solid var(--border)", background: i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                              <td className="py-2.5 px-4 text-center font-bold" style={{ color: placementColor(e.placement) }}>
                                {e.placement > 0 ? (MEDAL[e.placement] ?? `#${e.placement}`) : "—"}
                              </td>
                              <td className="py-2.5 px-4 font-semibold">{e.team}</td>
                              <td className="py-2.5 px-4 text-center font-bold" style={{ color: "var(--primary)" }}>+{e.points}</td>
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
