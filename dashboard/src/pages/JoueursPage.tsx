import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { apiUrl } from "../lib/api";

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
    fetch(apiUrl(`/api/players/${encodeURIComponent(name)}`))
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger les données."); setLoading(false); });
  }, [name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="font-bold text-lg">{name}</h2>
            {detail && (
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {detail.teams.join(", ")} · {detail.totalMatches} match{detail.totalMatches !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button onClick={onClose} className="size-8 rounded-lg flex items-center justify-center text-lg transition-colors cursor-pointer" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>×</button>
        </div>

        {loading && <div className="py-20 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>}
        {error && <div className="py-20 text-center text-red-400">{error}</div>}

        {detail && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total kills",  value: detail.totalKills.toLocaleString("fr-FR"), color: "#f87171" },
                { label: "Moy. kills",   value: detail.avgKills,                           color: "#fb923c" },
                { label: "Best kills",   value: detail.bestKills,                          color: "#facc15" },
                { label: "Matchs",       value: detail.totalMatches,                       color: "var(--primary)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                  <div className="text-xl font-black" style={{ color }}>{value}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{label}</div>
                </div>
              ))}
            </div>

            {detail.history.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: "var(--muted-foreground)" }}>
                  Historique des 20 derniers matchs
                </h3>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                        <th className="py-2 px-3 text-left">Date</th>
                        <th className="py-2 px-3 text-center">Kills</th>
                        {detail.teams.length > 1 && <th className="py-2 px-3 text-left hidden sm:table-cell">Équipe</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.history.map((h, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                          <td className="py-2 px-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{fmtDate(h.date)}</td>
                          <td className="py-2 px-3 text-center text-red-400 font-bold">{h.kills}</td>
                          {detail.teams.length > 1 && <td className="py-2 px-3 text-xs hidden sm:table-cell" style={{ color: "var(--muted-foreground)" }}>{h.teamName || "—"}</td>}
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
    fetch(apiUrl("/api/players?limit=100"))
      .then(r => r.json())
      .then(d => { setPlayers(d.players ?? []); setLoading(false); })
      .catch(() => { setError("Impossible de charger les données."); setLoading(false); });
  }, []);

  const filtered = players.filter(p =>
    p.displayName.toLowerCase().includes(search.toLowerCase()) ||
    p.teamName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {selected && <PlayerModal name={selected} onClose={() => setSelected(null)} />}

      {players.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Joueurs",       value: players.length,                                                          color: "var(--primary)" },
            { label: "Total kills",   value: players.reduce((s, p) => s + p.totalKills, 0).toLocaleString("fr-FR"), color: "#f87171" },
            { label: "Meilleur kill", value: Math.max(...players.map(p => p.bestKills), 0),                          color: "#facc15" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="text-2xl font-black" style={{ color }}>{value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="font-bold text-sm">Classement Joueurs</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Cliquer sur un joueur pour voir le détail</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {players.length > 0 && (
              <>
                <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-xs focus:outline-none w-36"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
                <button
                  onClick={() => {
                    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                    const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

                    doc.setFillColor(212, 150, 58);
                    doc.rect(0, 0, 210, 20, "F");
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.text("SUPREMYX CI — Classement Joueurs", 14, 13);

                    doc.setFillColor(30, 28, 40);
                    doc.rect(0, 20, 210, 10, "F");
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(180, 180, 190);
                    doc.text(`Généré le ${date}  ·  ${players.length} joueur${players.length > 1 ? "s" : ""}`, 14, 27);

                    autoTable(doc, {
                      startY: 34,
                      head: [["#", "Joueur", "Équipe", "Kills totaux", "Moy. kills", "Best", "Matchs"]],
                      body: players.map(p => [
                        p.rank,
                        p.displayName,
                        p.teamName,
                        p.totalKills.toLocaleString("fr-FR"),
                        p.avgKills,
                        p.bestKills,
                        p.totalMatches,
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
                        1: { halign: "left",   cellWidth: 52 },
                        2: { halign: "left",   cellWidth: 40 },
                        3: { halign: "center", cellWidth: 28, textColor: [248, 113, 113] as [number, number, number] },
                        4: { halign: "center", cellWidth: 24, textColor: [212, 150, 58] as [number, number, number] },
                        5: { halign: "center", cellWidth: 20, textColor: [250, 204, 21] as [number, number, number] },
                        6: { halign: "center", cellWidth: 20 },
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

                    doc.save(`supremyx-joueurs-${new Date().toISOString().slice(0, 10)}.pdf`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  style={{ background: "rgba(212,150,58,0.15)", color: "var(--primary)", border: "1px solid rgba(212,150,58,0.3)" }}
                >
                  📄 PDF
                </button>
              </>
            )}
          </div>
        </div>

        {loading && <div className="py-16 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>}
        {error && <div className="py-16 text-center"><div className="text-4xl mb-3">⚠️</div><p className="text-red-400 font-semibold">{error}</p></div>}
        {!loading && !error && players.length === 0 && (
          <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
            <div className="text-3xl mb-2">👤</div>
            <p className="text-sm">Aucun joueur enregistré pour le moment.</p>
          </div>
        )}
        {!loading && !error && players.length > 0 && filtered.length === 0 && (
          <div className="py-10 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Aucun résultat pour « {search} »</div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
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
                  <tr key={p.displayName + p.teamName} onClick={() => setSelected(p.displayName)} className="cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid var(--border)", background: p.rank <= 3 ? "rgba(212,150,58,0.04)" : "transparent" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,150,58,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = p.rank <= 3 ? "rgba(212,150,58,0.04)" : "transparent")}
                  >
                    <td className="py-3 px-4 text-center font-bold text-lg w-12">
                      {search ? <span className="text-base" style={{ color: "var(--muted-foreground)" }}>{p.rank}</span> : (MEDAL[p.rank] ?? <span className="text-base" style={{ color: "var(--muted-foreground)" }}>{p.rank}</span>)}
                    </td>
                    <td className="py-3 px-4 font-semibold">{p.displayName}</td>
                    <td className="py-3 px-4 text-xs hidden sm:table-cell" style={{ color: "var(--muted-foreground)" }}>{p.teamName}</td>
                    <td className="py-3 px-4 text-center text-red-400 font-bold text-base">{p.totalKills.toLocaleString("fr-FR")}</td>
                    <td className="py-3 px-4 text-center text-orange-400 hidden sm:table-cell">{p.avgKills}</td>
                    <td className="py-3 px-4 text-center text-yellow-400 hidden sm:table-cell">{p.bestKills}</td>
                    <td className="py-3 px-4 text-center hidden sm:table-cell" style={{ color: "var(--muted-foreground)" }}>{p.totalMatches}</td>
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
