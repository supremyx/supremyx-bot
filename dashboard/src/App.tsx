import { useEffect, useState, useCallback, useRef } from "react";
import { Toaster } from "sonner";
import { Trophy, Medal, Award, Users, Zap, Target, Menu, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import TournoisPage from "./pages/TournoisPage";
import JoueursPage from "./pages/JoueursPage";
import RostersPage from "./pages/RostersPage";
import CalendrierPage from "./pages/CalendrierPage";
import StatsPage from "./pages/StatsPage";
import LogsPage from "./pages/LogsPage";
import ResultsPage from "./pages/ResultsPage";
import TeamPage from "./pages/TeamPage";
import ComparisonPage from "./pages/ComparisonPage";
import SaisonsPage from "./pages/SaisonsPage";
import ModerationPage from "./pages/ModerationPage";
import BotStatsPage from "./pages/BotStatsPage";
import IaAnalyticsPage from "./pages/IaAnalyticsPage";
import EventsPage from "./pages/EventsPage";
import TicketsPage from "./pages/TicketsPage";
import BirthdaysPage from "./pages/BirthdaysPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import SondagesPage from "./pages/SondagesPage";
import EmbedsProgrammesPage from "./pages/EmbedsProgrammesPage";
import GlobalSearch from "./components/GlobalSearch";
import { useMatchNotifications } from "./hooks/useMatchNotifications";
import { apiUrl } from "./lib/api";

type Page = "classement" | "tournois" | "joueurs" | "rosters" | "calendrier" | "stats" | "logs" | "resultats" | "equipe" | "comparaison" | "saisons" | "moderation" | "botstats" | "ia-analytics" | "events" | "tickets" | "birthdays" | "suggestions" | "sondages" | "embeds-programmes";

interface Team {
  rank: number;
  team: string;
  points: number;
  kills: number;
  wins: number;
  losses: number;
}

const NAV_ITEMS: { key: Page; label: string; icon: string }[] = [
  { key: "classement",   label: "Classement",   icon: "🏆" },
  { key: "tournois",     label: "Tournois",      icon: "🎮" },
  { key: "saisons",      label: "Saisons",       icon: "🗓️" },
  { key: "joueurs",      label: "Joueurs",       icon: "💀" },
  { key: "rosters",      label: "Effectifs",      icon: "🛡️" },
  { key: "calendrier",   label: "Calendrier",    icon: "📅" },
  { key: "resultats",    label: "Résultats",     icon: "🎯" },
  { key: "comparaison",  label: "Comparer",      icon: "⚔️" },
  { key: "stats",        label: "Stats",         icon: "📊" },
  { key: "moderation",   label: "Modération",    icon: "🛡️" },
  { key: "botstats",     label: "Stats Bot",     icon: "🤖" },
  { key: "ia-analytics", label: "Analytiques IA", icon: "🧠" },
  { key: "events",       label: "Événements",    icon: "📅" },
  { key: "tickets",      label: "Tickets",       icon: "🎫" },
  { key: "birthdays",    label: "Anniversaires", icon: "🎂" },
  { key: "suggestions",  label: "Suggestions",   icon: "💡" },
  { key: "sondages",          label: "Sondages",   icon: "📊" },
  { key: "embeds-programmes", label: "Embeds prog.", icon: "📨" },
  { key: "logs",              label: "Journaux",    icon: "📋" },
];

function useBotStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  const check = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/health"), { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      setOnline(data.status === "ok");
    } catch {
      setOnline(false);
    }
  }, []);
  useEffect(() => {
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [check]);
  return online;
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="size-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="size-5 text-gray-300" />;
  if (rank === 3) return <Award className="size-5 text-amber-500" />;
  return <span className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>{rank}</span>;
}

function TeamRow({ t, flash, onClick }: { t: Team; flash: boolean; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition-colors duration-300"
      style={{
        borderBottom: "1px solid var(--border)",
        background: flash
          ? "rgba(212,150,58,0.12)"
          : t.rank <= 3
          ? "rgba(212,150,58,0.04)"
          : "transparent",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,150,58,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.background = flash ? "rgba(212,150,58,0.12)" : t.rank <= 3 ? "rgba(212,150,58,0.04)" : "transparent")}
    >
      <td className="py-3 px-4 text-center w-12">
        <div className="flex items-center justify-center">
          <RankIcon rank={t.rank} />
        </div>
      </td>
      <td className="py-3 px-4 font-semibold text-sm">{t.team}</td>
      <td className="py-3 px-4 text-center text-sm font-bold" style={{ color: "var(--primary)" }}>
        {t.points.toLocaleString("fr-FR")}
      </td>
      <td className="py-3 px-4 text-center text-sm font-semibold text-red-400">
        {t.kills.toLocaleString("fr-FR")}
      </td>
      <td className="py-3 px-4 text-center text-sm text-emerald-400">{t.wins}</td>
      <td className="py-3 px-4 text-center text-sm text-rose-400">{t.losses}</td>
    </tr>
  );
}

export default function App() {
  useMatchNotifications();
  const botOnline = useBotStatus();
  const [page, setPage]               = useState<Page>("classement");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ranking, setRanking]         = useState<Team[]>([]);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [flash, setFlash]             = useState<Set<string>>(new Set());
  const [countdown, setCountdown]     = useState(30);
  const [activeTeam, setActiveTeam]   = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [searchedPlayer, setSearchedPlayer] = useState<string | undefined>(undefined);

  const goToTeam = useCallback((name: string) => { setActiveTeam(name); setPage("equipe"); }, []);
  const goToComparison = useCallback((a: string, b?: string) => {
    setActiveTeam(a); setCompareWith(b ?? null); setPage("comparaison");
  }, []);

  const fetchRanking = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/ranking"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRanking(prev => {
        const newFlash = new Set<string>();
        const prevMap = new Map(prev.map(t => [t.team, t]));
        for (const t of (data.ranking ?? [])) {
          const old = prevMap.get(t.team);
          if (old && (old.points !== t.points || old.kills !== t.kills)) newFlash.add(t.team);
        }
        if (newFlash.size > 0) { setFlash(newFlash); setTimeout(() => setFlash(new Set()), 1500); }
        return data.ranking ?? [];
      });
      setLastUpdate(new Date());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRanking();
    const id = setInterval(() => { fetchRanking(); setCountdown(30); }, 30_000);
    return () => clearInterval(id);
  }, [fetchRanking]);

  useEffect(() => {
    const id = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const totalKills  = ranking.reduce((s, t) => s + t.kills, 0);
  const totalPoints = ranking.reduce((s, t) => s + t.points, 0);

  const navigate = (key: Page) => { setPage(key); setMobileMenuOpen(false); };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)", fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif" }}>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          },
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(22,21,30,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)" }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo + Status */}
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("classement")} className="flex items-center gap-3">
              <div className="relative flex size-10 items-center justify-center rounded-lg font-black text-lg select-none" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                S
                {botOnline !== null && (
                  <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 ${botOnline ? "bg-emerald-400" : "bg-red-500"}`} style={{ borderColor: "var(--card)" }} />
                )}
              </div>
              <span className="text-lg font-bold tracking-tight hidden sm:block">
                SUPREMYX <span style={{ color: "var(--primary)" }}>CI</span>
              </span>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1 ml-2">
              {NAV_ITEMS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => navigate(key)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  style={{
                    background: page === key ? "var(--primary)" : "transparent",
                    color: page === key ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  }}
                  onMouseEnter={e => { if (page !== key) { (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}}
                  onMouseLeave={e => { if (page !== key) { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <GlobalSearch onSelectTeam={goToTeam} onSelectPlayer={(name) => { setSearchedPlayer(undefined); setTimeout(() => setSearchedPlayer(name), 0); setPage("joueurs"); }} />
            {lastUpdate && page === "classement" && (
              <span className="hidden xl:inline text-xs" style={{ color: "var(--muted-foreground)" }}>
                Mis à jour à {lastUpdate.toLocaleTimeString("fr-FR")}
              </span>
            )}
            {page === "classement" && (
              <button
                onClick={() => { fetchRanking(); setCountdown(30); }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                ↻ Actualiser <span className="opacity-60 font-normal">({countdown}s)</span>
              </button>
            )}
            {/* Bot status badge */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--muted)", color: botOnline ? "#34d399" : botOnline === false ? "#f87171" : "var(--muted-foreground)" }}>
              <span className={`size-1.5 rounded-full ${botOnline ? "bg-emerald-400 animate-pulse" : botOnline === false ? "bg-red-400" : "bg-gray-500"}`} />
              {botOnline === null ? "…" : botOnline ? "Bot en ligne" : "Hors ligne"}
            </div>
            {/* Mobile menu toggle */}
            <button
              className="lg:hidden p-2 rounded-lg transition-colors"
              style={{ color: "var(--muted-foreground)" }}
              onClick={() => setMobileMenuOpen(o => !o)}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}>
            <nav className="flex flex-col gap-1 p-3">
              {NAV_ITEMS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => navigate(key)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors cursor-pointer"
                  style={{
                    background: page === key ? "rgba(212,150,58,0.15)" : "transparent",
                    color: page === key ? "var(--primary)" : "var(--foreground)",
                  }}
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Pages */}
      {page === "tournois"   && <TournoisPage />}
      {page === "joueurs"    && <JoueursPage initialSelected={searchedPlayer} />}
      {page === "rosters"    && <RostersPage />}
      {page === "calendrier" && <CalendrierPage />}
      {page === "resultats"  && <ResultsPage onTeamClick={goToTeam} />}
      {page === "stats"      && <StatsPage />}
      {page === "logs"       && <LogsPage />}
      {page === "equipe" && activeTeam && (
        <TeamPage teamName={activeTeam} onBack={() => setPage("classement")} onCompare={(name) => goToComparison(name)} />
      )}
      {page === "comparaison" && (
        <ComparisonPage initialA={activeTeam ?? undefined} initialB={compareWith ?? undefined} onBack={() => setPage("classement")} />
      )}
      {page === "saisons"    && <SaisonsPage />}
      {page === "moderation"   && <ModerationPage />}
      {page === "botstats"     && <BotStatsPage />}
      {page === "ia-analytics" && <IaAnalyticsPage />}
      {page === "events"       && <EventsPage />}
      {page === "tickets"      && <TicketsPage />}
      {page === "birthdays"    && <BirthdaysPage />}
      {page === "suggestions"  && <SuggestionsPage />}
      {page === "sondages"          && <SondagesPage />}
      {page === "embeds-programmes" && <EmbedsProgrammesPage />}

      {/* Classement page */}
      <main className={`mx-auto max-w-5xl px-4 py-10 ${page !== "classement" ? "hidden" : ""}`}>

        {/* Hero stat cards */}
        {ranking.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[
              { icon: Users,  value: ranking.length,                      label: "Équipes",       color: "var(--primary)" },
              { icon: Trophy, value: totalPoints.toLocaleString("fr-FR"), label: "Points totaux", color: "var(--primary)" },
              { icon: Target, value: totalKills.toLocaleString("fr-FR"),  label: "Kills totaux",  color: "#f87171" },
              { icon: Zap,    value: ranking.filter(t => t.wins > 0).length, label: "Équipes actives", color: "#34d399" },
            ].map(({ icon: Icon, value, label, color }) => (
              <div key={label} className="flex flex-col items-center gap-2 rounded-xl p-4 backdrop-blur-sm text-center" style={{ border: "1px solid var(--border)", background: "rgba(22,21,30,0.6)" }}>
                <Icon className="size-5" style={{ color }} />
                <span className="text-2xl font-bold" style={{ color }}>{value}</span>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Top 3 podium */}
        {ranking.length >= 3 && (
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            {ranking.slice(0, 3).map((t, i) => (
              <div
                key={t.team}
                onClick={() => goToTeam(t.team)}
                className="cursor-pointer rounded-xl p-6 text-center relative overflow-hidden transition-transform hover:-translate-y-0.5"
                style={{
                  border: `1px solid ${i === 0 ? "rgba(250,204,21,0.3)" : i === 1 ? "rgba(209,213,219,0.3)" : "rgba(217,119,6,0.3)"}`,
                  background: i === 0
                    ? "linear-gradient(135deg, rgba(250,204,21,0.08) 0%, transparent 100%)"
                    : i === 1
                    ? "linear-gradient(135deg, rgba(209,213,219,0.08) 0%, transparent 100%)"
                    : "linear-gradient(135deg, rgba(217,119,6,0.08) 0%, transparent 100%)",
                }}
              >
                <div className="mb-3 flex justify-center">
                  {i === 0 ? <Trophy className="size-10 text-yellow-400" /> : i === 1 ? <Medal className="size-10 text-gray-300" /> : <Award className="size-10 text-amber-500" />}
                </div>
                <div className="text-xs font-semibold mb-1 px-2 py-0.5 rounded-full inline-block" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>#{t.rank}</div>
                <h3 className="text-base font-bold mt-2">{t.team}</h3>
                <p className="mt-2 text-2xl font-bold" style={{ color: "var(--primary)" }}>{t.points.toLocaleString("fr-FR")}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>points</p>
                <div className="mt-3 flex justify-center gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <span className="text-emerald-400">{t.wins} victoires</span>
                  <span className="text-red-400">{t.kills} kills</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full table */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 className="font-bold text-base">Classement Général</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Cliquer sur une équipe pour voir le détail
              </p>
            </div>
            <div className="flex items-center gap-2">
              {loading && <span className="text-xs animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</span>}
              {ranking.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      const header = ["Rang", "Équipe", "Points", "Kills", "Victoires", "Défaites"];
                      const rows = ranking.map(t => [t.rank, t.team, t.points, t.kills, t.wins, t.losses]);
                      const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url;
                      a.download = `supremyx-classement-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click(); URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                  >
                    ⬇ CSV
                  </button>
                  <button
                    onClick={() => {
                      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                      const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

                      // Header band
                      doc.setFillColor(212, 150, 58);
                      doc.rect(0, 0, 210, 20, "F");
                      doc.setTextColor(255, 255, 255);
                      doc.setFontSize(14);
                      doc.setFont("helvetica", "bold");
                      doc.text("SUPREMYX CI — Classement Général", 14, 13);

                      // Subtitle
                      doc.setFillColor(30, 28, 40);
                      doc.rect(0, 20, 210, 10, "F");
                      doc.setFontSize(8);
                      doc.setFont("helvetica", "normal");
                      doc.setTextColor(180, 180, 190);
                      doc.text(`Généré le ${date}  ·  ${ranking.length} équipe${ranking.length > 1 ? "s" : ""}  ·  ${totalPoints.toLocaleString("fr-FR")} pts totaux`, 14, 27);

                      // Table
                      autoTable(doc, {
                        startY: 34,
                        head: [["#", "Équipe", "Points", "Kills", "V", "D", "Winrate"]],
                        body: ranking.map(t => [
                          t.rank,
                          t.team,
                          t.points.toLocaleString("fr-FR"),
                          t.kills.toLocaleString("fr-FR"),
                          t.wins,
                          t.losses,
                          t.wins + t.losses > 0
                            ? `${Math.round((t.wins / (t.wins + t.losses)) * 100)}%`
                            : "—",
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
                          2: { halign: "center", cellWidth: 24, textColor: [212, 150, 58] as [number, number, number], fontStyle: "bold" },
                          3: { halign: "center", cellWidth: 22, textColor: [248, 113, 113] as [number, number, number] },
                          4: { halign: "center", cellWidth: 18, textColor: [52, 211, 153] as [number, number, number] },
                          5: { halign: "center", cellWidth: 18, textColor: [244, 63, 94] as [number, number, number] },
                          6: { halign: "center", cellWidth: 26 },
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

                      // Footer
                      const pageH = doc.internal.pageSize.height;
                      doc.setFillColor(30, 28, 40);
                      doc.rect(0, pageH - 10, 210, 10, "F");
                      doc.setFontSize(7);
                      doc.setTextColor(120, 120, 130);
                      doc.text("© 2026 SUPREMYX — Côte d'Ivoire · supremyx.xyz", 14, pageH - 3.5);

                      doc.save(`supremyx-classement-${new Date().toISOString().slice(0, 10)}.pdf`);
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

          {error ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-red-400 font-semibold">{error}</p>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Le bot Discord est peut-être hors ligne</p>
            </div>
          ) : ranking.length === 0 && !loading ? (
            <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
              <div className="text-4xl mb-3">📋</div>
              <p>Aucune équipe enregistrée pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                    <th className="py-2 px-4 text-center">#</th>
                    <th className="py-2 px-4 text-left">Équipe</th>
                    <th className="py-2 px-4 text-center">Points</th>
                    <th className="py-2 px-4 text-center">Kills</th>
                    <th className="py-2 px-4 text-center">V</th>
                    <th className="py-2 px-4 text-center">D</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map(t => (
                    <TeamRow key={t.team} t={t} flash={flash.has(t.team)} onClick={() => goToTeam(t.team)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-8" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm font-bold">SUPREMYX <span style={{ color: "var(--primary)" }}>CI</span></p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Dashboard · Actualisation automatique toutes les 30 secondes
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>© 2026 SUPREMYX — Côte d'Ivoire</p>
          </div>
        </div>
      </main>
    </div>
  );
}
