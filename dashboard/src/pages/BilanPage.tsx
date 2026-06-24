import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { apiUrl } from "../lib/api";

interface TeamStat    { rank?: number; name: string; points?: number; kills?: number; wins?: number; losses?: number; }
interface PlayerStat  { name: string; kills: number; team: string; }
interface BestMatch   { team: string; kills: number; createdAt: string; }

interface BilanStats {
  totalMatches: number;
  totalKills: number;
  avgKills: string;
  wins: number;
  topTeams: TeamStat[];
  topWeekTeams: TeamStat[];
  topWeekPlayers: PlayerStat[];
  bestKillMatch: BestMatch | null;
  activeTournament: string | null;
}

interface Bilan {
  _id: string;
  guildId: string;
  weekFrom: string;
  weekTo: string;
  triggeredBy: string;
  modelAlias: string;
  iaText: string | null;
  stats: BilanStats;
  createdAt: string;
}

const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-3 rounded-xl" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
      <span className="text-xl font-black" style={{ color }}>{value}</span>
      <span className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{label}</span>
    </div>
  );
}

function BilanCard({ bilan, isSelected, onClick }: { bilan: Bilan; isSelected: boolean; onClick: () => void }) {
  const s = bilan.stats;
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 transition-all cursor-pointer"
      style={{
        background: isSelected ? "rgba(212,150,58,0.12)" : "var(--card)",
        border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
        boxShadow: isSelected ? "0 0 0 1px var(--primary)" : "none",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-xs font-bold" style={{ color: "var(--primary)" }}>
            Semaine du {fmtShort(bilan.weekFrom)} → {fmtShort(bilan.weekTo)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {fmtDate(bilan.createdAt)} · {bilan.triggeredBy === "auto" ? "Automatique" : `Par ${bilan.triggeredBy}`}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
          {bilan.modelAlias}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Matchs", value: s.totalMatches, color: "var(--primary)" },
          { label: "Kills",  value: s.totalKills,   color: "#f87171" },
          { label: "Victoires", value: s.wins,       color: "#22c55e" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg py-1.5" style={{ background: "var(--muted)" }}>
            <div className="text-sm font-black" style={{ color }}>{value}</div>
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</div>
          </div>
        ))}
      </div>
      {bilan.iaText && (
        <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span>🧠</span><span>Analyse IA disponible</span>
        </div>
      )}
    </button>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <p style={{ color: "var(--muted-foreground)" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-bold" style={{ color: p.color }}>{p.name} : {p.value}</p>
      ))}
    </div>
  );
};

export default function BilanPage() {
  const [bilans, setBilans]       = useState<Bilan[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Bilan | null>(null);
  const [tab, setTab]             = useState<"stats" | "ia" | "trend">("stats");

  useEffect(() => {
    fetch(apiUrl("/api/ia/bilans?limit=20"))
      .then(r => r.json())
      .then(d => {
        const list = d.bilans ?? [];
        setBilans(list);
        if (list.length > 0) setSelected(list[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Données pour le graphique de tendance (kills & matchs par semaine)
  const trendData = [...bilans].reverse().map(b => ({
    week: fmtShort(b.weekFrom),
    kills: b.stats.totalKills,
    matchs: b.stats.totalMatches,
    victoires: b.stats.wins,
  }));

  if (loading) {
    return (
      <div className="py-24 text-center text-sm animate-pulse" style={{ color: "var(--muted-foreground)" }}>
        Chargement de l'historique des bilans…
      </div>
    );
  }

  if (bilans.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h1 className="text-xl font-bold mb-2">Aucun bilan généré</h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Les bilans apparaissent ici après leur génération.<br />
          Utilise <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: "var(--muted)" }}>!ia bilan maintenant</code> sur Discord pour en créer un.
        </p>
      </main>
    );
  }

  const s = selected?.stats;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black">📋 Historique des Bilans Hebdomadaires</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          {bilans.length} bilan(s) généré(s) · Cliquez sur un bilan pour voir le détail
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* ── Colonne gauche : liste des bilans ── */}
        <div className="flex flex-col gap-3">
          {bilans.map(b => (
            <BilanCard
              key={b._id}
              bilan={b}
              isSelected={selected?._id === b._id}
              onClick={() => { setSelected(b); setTab("stats"); }}
            />
          ))}
        </div>

        {/* ── Colonne droite : détail du bilan sélectionné ── */}
        {selected && s && (
          <div className="min-w-0">
            {/* En-tête du bilan */}
            <div className="rounded-xl p-5 mb-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-black text-lg">
                    Semaine du {fmtDate(selected.weekFrom)} → {fmtDate(selected.weekTo)}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    Généré le {fmtDate(selected.createdAt)} · {selected.triggeredBy === "auto" ? "Automatique (dimanche)" : `Déclenché par ${selected.triggeredBy}`} · Modèle : <span style={{ color: "var(--primary)" }}>{selected.modelAlias}</span>
                  </p>
                  {s.activeTournament && (
                    <p className="text-xs mt-1" style={{ color: "#f59e0b" }}>🎮 Tournoi : {s.activeTournament}</p>
                  )}
                </div>
              </div>

              {/* Stat pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Matchs joués"   value={s.totalMatches}          color="var(--primary)" />
                <StatPill label="Kills totaux"    value={s.totalKills}            color="#f87171" />
                <StatPill label="Moy. kills/match" value={s.avgKills}            color="#fb923c" />
                <StatPill label="Victoires (#1)"  value={s.wins}                  color="#22c55e" />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
              {(["stats", "ia", "trend"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                  style={{
                    background: tab === t ? "var(--card)" : "transparent",
                    color:      tab === t ? "var(--foreground)" : "var(--muted-foreground)",
                    boxShadow:  tab === t ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                  }}
                >
                  {t === "stats" ? "📊 Performances" : t === "ia" ? "🧠 Analyse IA" : "📈 Tendances"}
                </button>
              ))}
            </div>

            {/* ── Tab : Stats performances ── */}
            {tab === "stats" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Classement général */}
                <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <h3 className="font-bold mb-3">🏆 Classement général (Top 5)</h3>
                  {s.topTeams.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Aucune équipe.</p>
                  ) : (
                    <div className="space-y-2">
                      {s.topTeams.map((t, i) => (
                        <div key={t.name} className="flex items-center gap-2 text-sm">
                          <span className="w-6 text-center shrink-0">{MEDALS[i] ?? `${i + 1}.`}</span>
                          <span className="flex-1 font-medium truncate">{t.name}</span>
                          <span className="text-xs tabular-nums" style={{ color: "var(--primary)" }}>{t.points} pts</span>
                          <span className="text-xs tabular-nums" style={{ color: "#f87171" }}>{t.kills}k</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top équipes semaine */}
                <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <h3 className="font-bold mb-3">⚡ Top équipes (kills semaine)</h3>
                  {s.topWeekTeams.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Aucun match cette semaine.</p>
                  ) : (
                    <div className="space-y-3">
                      {s.topWeekTeams.map((t, i) => {
                        const max = s.topWeekTeams[0]?.kills ?? 1;
                        const pct = max > 0 ? ((t.kills ?? 0) / max) * 100 : 0;
                        return (
                          <div key={t.name}>
                            <div className="flex justify-between text-xs mb-1">
                              <span>{MEDALS[i]} {t.name}</span>
                              <span className="font-bold" style={{ color: "#f87171" }}>{t.kills} kills</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                              <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "#f87171" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Top joueurs semaine */}
                <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <h3 className="font-bold mb-3">🌟 Top joueurs (kills semaine)</h3>
                  {s.topWeekPlayers.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Aucune stat disponible.</p>
                  ) : (
                    <div className="space-y-3">
                      {s.topWeekPlayers.map((p, i) => {
                        const max = s.topWeekPlayers[0]?.kills ?? 1;
                        const pct = max > 0 ? (p.kills / max) * 100 : 0;
                        return (
                          <div key={p.name}>
                            <div className="flex justify-between text-xs mb-1">
                              <span>{MEDALS[i]} <strong>{p.name}</strong> <span style={{ color: "var(--muted-foreground)" }}>({p.team})</span></span>
                              <span className="font-bold" style={{ color: "#facc15" }}>{p.kills} kills</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                              <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "#facc15" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Record de la semaine */}
                <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <h3 className="font-bold mb-3">🔥 Record de la semaine</h3>
                  {s.bestKillMatch ? (
                    <div className="flex flex-col gap-2">
                      <div className="rounded-lg p-3 text-center" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)" }}>
                        <div className="text-3xl font-black" style={{ color: "#f87171" }}>{s.bestKillMatch.kills}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>kills en un match</div>
                      </div>
                      <p className="text-sm text-center font-semibold">{s.bestKillMatch.team}</p>
                      <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>{fmtDate(s.bestKillMatch.createdAt)}</p>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Aucun match cette semaine.</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab : Analyse IA ── */}
            {tab === "ia" && (
              <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🧠</span>
                  <h3 className="font-bold">Analyse générée par {selected.modelAlias}</h3>
                </div>
                {selected.iaText ? (
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: "var(--foreground)" }}
                  >
                    {selected.iaText}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-3xl mb-3">🤖</p>
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      Aucune analyse IA pour ce bilan.<br />
                      La clé OpenRouter n'était peut-être pas configurée à ce moment.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab : Tendances multi-semaines ── */}
            {tab === "trend" && (
              <div className="space-y-4">
                {trendData.length < 2 ? (
                  <div className="rounded-xl p-10 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="text-3xl mb-3">📈</p>
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      Il faut au moins 2 bilans pour afficher les tendances.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Kills par semaine */}
                    <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                      <h3 className="font-bold mb-4">🔴 Kills totaux par semaine</h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={trendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="kills" name="Kills" fill="#f87171" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Matchs & victoires par semaine */}
                    <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                      <h3 className="font-bold mb-4">📊 Matchs joués & Victoires par semaine</h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={trendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="matchs"    name="Matchs"    fill="var(--primary)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="victoires" name="Victoires" fill="#22c55e"         radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex gap-4 justify-center mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm inline-block" style={{ background: "var(--primary)" }} />Matchs</span>
                        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm inline-block" style={{ background: "#22c55e" }} />Victoires</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
