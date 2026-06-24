import { useEffect, useState, useCallback, useRef } from "react";
import { Toaster } from "sonner";
import { Trophy, Medal, Award, Users, Zap, Target, Menu, X, ExternalLink, Search } from "lucide-react";
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
import BilanPage from "./pages/BilanPage";
import EventsPage from "./pages/EventsPage";
import TicketsPage from "./pages/TicketsPage";
import BirthdaysPage from "./pages/BirthdaysPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import SondagesPage from "./pages/SondagesPage";
import EmbedsProgrammesPage from "./pages/EmbedsProgrammesPage";
import ParametresPage from "./pages/ParametresPage";
import LiveActivityPage from "./pages/LiveActivityPage";
import GlobalSearch from "./components/GlobalSearch";
import NotificationBanner from "./components/NotificationBanner";
import NotificationHistory from "./components/NotificationHistory";
import { useMatchNotifications } from "./hooks/useMatchNotifications";
import { apiUrl } from "./lib/api";

type Page = "classement" | "tournois" | "joueurs" | "rosters" | "calendrier" | "stats" | "logs" | "resultats" | "equipe" | "comparaison" | "saisons" | "moderation" | "botstats" | "ia-analytics" | "bilan" | "events" | "tickets" | "birthdays" | "suggestions" | "sondages" | "embeds-programmes" | "parametres" | "live-activity";

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
  { key: "bilan",        label: "Bilans hebdo",   icon: "📋" },
  { key: "events",       label: "Événements",    icon: "📅" },
  { key: "tickets",      label: "Tickets",       icon: "🎫" },
  { key: "birthdays",    label: "Anniversaires", icon: "🎂" },
  { key: "suggestions",  label: "Suggestions",   icon: "💡" },
  { key: "sondages",          label: "Sondages",   icon: "📊" },
  { key: "embeds-programmes", label: "Embeds prog.", icon: "📨" },
  { key: "logs",              label: "Journaux",    icon: "📋" },
  { key: "live-activity",     label: "Activité live", icon: "📡" },
  { key: "parametres",        label: "Paramètres",  icon: "⚙️" },
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

/* ── Fiche joueur rapide (overlay global depuis la recherche) ── */
interface PlayerDetail {
  displayName: string;
  teams: string[];
  totalKills: number;
  totalMatches: number;
  bestKills: number;
  avgKills: number;
  history: { kills: number; date: string; teamName?: string }[];
}

/* ── Comparaison côte-à-côte ── */
function PlayerCompareModal({ nameA, nameB, onClose, onSwap }: {
  nameA: string; nameB: string;
  onClose: () => void;
  onSwap: (a: string, b: string) => void;
}) {
  const [detailA, setDetailA] = useState<PlayerDetail | null>(null);
  const [detailB, setDetailB] = useState<PlayerDetail | null>(null);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingB, setLoadingB] = useState(true);

  useEffect(() => {
    fetch(apiUrl(`/api/players/${encodeURIComponent(nameA)}`)).then(r => r.json())
      .then(d => { setDetailA(d); setLoadingA(false); }).catch(() => setLoadingA(false));
  }, [nameA]);
  useEffect(() => {
    fetch(apiUrl(`/api/players/${encodeURIComponent(nameB)}`)).then(r => r.json())
      .then(d => { setDetailB(d); setLoadingB(false); }).catch(() => setLoadingB(false));
  }, [nameB]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

  type StatKey = "totalKills" | "avgKills" | "bestKills" | "totalMatches";
  const STATS: { key: StatKey; label: string; color: string; fmt?: (v: number) => string }[] = [
    { key: "totalKills",   label: "Kills totaux", color: "#f87171", fmt: v => v.toLocaleString("fr-FR") },
    { key: "avgKills",     label: "Moy. kills",   color: "#fb923c" },
    { key: "bestKills",    label: "Meilleur",     color: "#facc15" },
    { key: "totalMatches", label: "Matchs",       color: "var(--primary)" },
  ];

  function winner(key: StatKey) {
    if (!detailA || !detailB) return null;
    if (detailA[key] > detailB[key]) return "A";
    if (detailB[key] > detailA[key]) return "B";
    return "tie";
  }

  const loading = loadingA || loadingB;
  const maxHistory = 15;
  const globalMax = detailA && detailB
    ? Math.max(...detailA.history.slice(0, maxHistory).map(h => h.kills), ...detailB.history.slice(0, maxHistory).map(h => h.kills), 1)
    : 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(12px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base font-bold truncate" style={{ color: "#f87171" }}>{nameA}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>VS</span>
            <span className="text-base font-bold truncate" style={{ color: "var(--primary)" }}>{nameB}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onSwap(nameB, nameA)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >⇄ Inverser</button>
            <button onClick={onClose} className="size-8 rounded-lg flex items-center justify-center text-lg cursor-pointer" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>×</button>
          </div>
        </div>

        {loading && <div className="py-20 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement des données…</div>}

        {!loading && detailA && detailB && (
          <div className="p-6 space-y-6">

            {/* Stats comparison rows */}
            <div className="space-y-3">
              {STATS.map(({ key, label, color, fmt }) => {
                const valA = detailA[key] as number;
                const valB = detailB[key] as number;
                const maxV = Math.max(valA, valB, 1);
                const pctA = (valA / maxV) * 100;
                const pctB = (valB / maxV) * 100;
                const w = winner(key);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      <span className="font-bold" style={{ color: w === "A" ? "#f87171" : "var(--muted-foreground)" }}>
                        {fmt ? fmt(valA) : valA} {w === "A" && "🏆"}
                      </span>
                      <span className="text-center font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
                      <span className="font-bold" style={{ color: w === "B" ? "var(--primary)" : "var(--muted-foreground)" }}>
                        {w === "B" && "🏆"} {fmt ? fmt(valB) : valB}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 h-2">
                      <div className="flex-1 flex justify-end">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pctA}%`, background: "rgba(248,113,113,0.7)" }} />
                      </div>
                      <div className="w-px h-3 shrink-0" style={{ background: "var(--border)" }} />
                      <div className="flex-1">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pctB}%`, background: "rgba(212,150,58,0.7)" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Score global */}
            {(() => {
              const winsA = STATS.filter(s => winner(s.key) === "A").length;
              const winsB = STATS.filter(s => winner(s.key) === "B").length;
              const verdict = winsA > winsB ? nameA : winsB > winsA ? nameB : null;
              return (
                <div className="rounded-xl p-4 text-center" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                  {verdict
                    ? <><p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Vainqueur global</p>
                        <p className="text-lg font-black">🏆 {verdict}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{winsA} vs {winsB} catégories</p></>
                    : <><p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Résultat</p>
                        <p className="text-lg font-black">🤝 Égalité parfaite</p></>}
                </div>
              );
            })()}

            {/* Mini graphiques superposés */}
            {(detailA.history.length > 0 || detailB.history.length > 0) && (
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: "var(--muted-foreground)" }}>
                  Kills sur les {maxHistory} derniers matchs
                </h3>
                <div className="flex items-end gap-0.5 h-20">
                  {Array.from({ length: maxHistory }).map((_, i) => {
                    const hA = detailA.history[i];
                    const hB = detailB.history[i];
                    return (
                      <div key={i} className="flex-1 flex items-end gap-px" title={`${hA ? hA.kills : "–"} vs ${hB ? hB.kills : "–"}`}>
                        {hA && <div className="flex-1 rounded-t-sm" style={{ height: `${Math.max((hA.kills / globalMax) * 100, 3)}%`, background: "rgba(248,113,113,0.65)" }} />}
                        {hB && <div className="flex-1 rounded-t-sm" style={{ height: `${Math.max((hB.kills / globalMax) * 100, 3)}%`, background: "rgba(212,150,58,0.65)" }} />}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-4 mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full inline-block" style={{ background: "rgba(248,113,113,0.7)" }} />{nameA}</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full inline-block" style={{ background: "rgba(212,150,58,0.7)" }} />{nameB}</span>
                </div>
              </div>
            )}

            {/* Tableau historique côte-à-côte */}
            {(detailA.history.length > 0 || detailB.history.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { detail: detailA, name: nameA, color: "#f87171" },
                  { detail: detailB, name: nameB, color: "var(--primary)" },
                ].map(({ detail, name: n, color }) => (
                  <div key={n}>
                    <p className="text-xs font-bold mb-2 truncate" style={{ color }}>{n}</p>
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                            <th className="py-1.5 px-2 text-left">Date</th>
                            <th className="py-1.5 px-2 text-center">Kills</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.history.slice(0, 8).map((h, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                              <td className="py-1.5 px-2" style={{ color: "var(--muted-foreground)" }}>{fmtDate(h.date)}</td>
                              <td className="py-1.5 px-2 text-center font-bold" style={{ color }}>{h.kills}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Fiche rapide joueur (overlay global) ── */
interface ComparePickerResult { displayName: string; teamName: string; }

function PlayerQuickModal({ name, onClose, onGoToPage, onCompare }: {
  name: string;
  onClose: () => void;
  onGoToPage: (name: string) => void;
  onCompare: (a: string, b: string) => void;
}) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<ComparePickerResult[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(apiUrl(`/api/players/${encodeURIComponent(name)}`))
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger les données."); setLoading(false); });
  }, [name]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { if (showPicker) setShowPicker(false); else onClose(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, showPicker]);

  useEffect(() => {
    if (showPicker) setTimeout(() => pickerInputRef.current?.focus(), 50);
    else { setPickerQuery(""); setPickerResults([]); }
  }, [showPicker]);

  useEffect(() => {
    if (!pickerQuery.trim()) { setPickerResults([]); return; }
    setPickerLoading(true);
    const lq = pickerQuery.toLowerCase();
    fetch(apiUrl("/api/players?limit=100")).then(r => r.json()).then(d => {
      setPickerResults((d.players ?? [])
        .filter((p: ComparePickerResult) => p.displayName.toLowerCase().includes(lq) && p.displayName !== name)
        .slice(0, 6));
      setPickerLoading(false);
    }).catch(() => setPickerLoading(false));
  }, [pickerQuery, name]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">💀</span>
              <h2 className="font-bold text-lg">{name}</h2>
            </div>
            {detail && (
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {detail.teams.join(", ")} · {detail.totalMatches} match{detail.totalMatches !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onClose(); onGoToPage(name); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >
              <ExternalLink className="size-3" /> Page joueurs
            </button>
            <button onClick={onClose} className="size-8 rounded-lg flex items-center justify-center text-lg cursor-pointer" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>×</button>
          </div>
        </div>

        {loading && <div className="py-20 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>}
        {error && <div className="py-20 text-center text-red-400">{error}</div>}

        {detail && (
          <div className="p-6 space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Kills totaux", value: detail.totalKills.toLocaleString("fr-FR"), color: "#f87171" },
                { label: "Moy. kills",   value: detail.avgKills,                            color: "#fb923c" },
                { label: "Meilleur",     value: detail.bestKills,                           color: "#facc15" },
                { label: "Matchs",       value: detail.totalMatches,                        color: "var(--primary)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                  <div className="text-xl font-black" style={{ color }}>{value}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Mini chart kills */}
            {detail.history.length > 0 && (
              <div>
                <div className="flex items-end gap-1 h-16 mb-1">
                  {detail.history.slice(0, 20).map((h, i) => {
                    const maxK = Math.max(...detail.history.slice(0, 20).map(x => x.kills), 1);
                    const pct = Math.max((h.kills / maxK) * 100, 4);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center group relative">
                        <div className="w-full rounded-t-sm transition-all" title={`${h.kills} kills`}
                          style={{ height: `${pct}%`, background: "rgba(248,113,113,0.6)", minHeight: 3 }} />
                        <span className="absolute -top-5 text-[9px] opacity-0 group-hover:opacity-100 font-bold text-red-400">{h.kills}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>Kills sur les {Math.min(detail.history.length, 20)} derniers matchs</p>
              </div>
            )}

            {/* History table */}
            {detail.history.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: "var(--muted-foreground)" }}>
                  Historique récent
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

            {/* ── Comparer avec un autre joueur ── */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setShowPicker(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold cursor-pointer transition-colors"
                style={{ background: showPicker ? "rgba(212,150,58,0.1)" : "var(--muted)", color: "var(--foreground)" }}
              >
                <span>⚔️ Comparer avec un autre joueur…</span>
                <span style={{ color: "var(--muted-foreground)" }}>{showPicker ? "▲" : "▼"}</span>
              </button>
              {showPicker && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                    <Search className="size-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                    <input
                      ref={pickerInputRef}
                      value={pickerQuery}
                      onChange={e => setPickerQuery(e.target.value)}
                      placeholder="Nom du joueur adversaire…"
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                      style={{ color: "var(--foreground)" }}
                    />
                    {pickerLoading && <div className="size-3.5 border-2 border-t-transparent rounded-full animate-spin shrink-0" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />}
                  </div>
                  {pickerResults.length > 0 ? (
                    <div className="py-1">
                      {pickerResults.map(p => (
                        <button
                          key={p.displayName}
                          onClick={() => onCompare(name, p.displayName)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer transition-colors"
                          style={{ background: "transparent" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,150,58,0.08)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <span>💀</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{p.displayName}</p>
                            <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{p.teamName}</p>
                          </div>
                          <span className="ml-auto text-xs font-semibold" style={{ color: "var(--primary)" }}>⚔️ VS</span>
                        </button>
                      ))}
                    </div>
                  ) : pickerQuery && !pickerLoading ? (
                    <p className="text-center text-xs py-4" style={{ color: "var(--muted-foreground)" }}>Aucun joueur trouvé pour « {pickerQuery} »</p>
                  ) : (
                    <p className="text-center text-xs py-4" style={{ color: "var(--muted-foreground)" }}>Tape le nom d'un joueur pour le comparer</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
  const { notifications, dismiss, dismissAll } = useMatchNotifications();
  const botOnline = useBotStatus();
  const [page, setPage]               = useState<Page>("classement");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ranking, setRanking]         = useState<Team[]>([]);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [flash, setFlash]             = useState<Set<string>>(new Set());
  const [countdown, setCountdown]     = useState(30);
  const [activeTeam, setActiveTeam]   = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [searchedPlayer, setSearchedPlayer] = useState<string | undefined>(undefined);
  const [quickPlayer, setQuickPlayer]       = useState<string | null>(null);
  const [comparePlayers, setComparePlayers] = useState<{ a: string; b: string } | null>(null);

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

      {/* Fiche joueur rapide — overlay global */}
      {quickPlayer && !comparePlayers && (
        <PlayerQuickModal
          name={quickPlayer}
          onClose={() => setQuickPlayer(null)}
          onGoToPage={(name) => {
            setQuickPlayer(null);
            setSearchedPlayer(undefined);
            setTimeout(() => setSearchedPlayer(name), 0);
            setPage("joueurs");
          }}
          onCompare={(a, b) => {
            setQuickPlayer(null);
            setComparePlayers({ a, b });
          }}
        />
      )}

      {/* Comparaison côte-à-côte — overlay global */}
      {comparePlayers && (
        <PlayerCompareModal
          nameA={comparePlayers.a}
          nameB={comparePlayers.b}
          onClose={() => setComparePlayers(null)}
          onSwap={(a, b) => setComparePlayers({ a, b })}
        />
      )}

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
            <GlobalSearch onSelectTeam={goToTeam} onSelectPlayer={(name) => setQuickPlayer(name)} />
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
            {/* Bell / notification history */}
            <button
              data-testid="button-open-notification-history"
              onClick={() => setHistoryOpen(o => !o)}
              className="relative flex items-center justify-center size-9 rounded-lg transition-colors cursor-pointer"
              style={{ background: historyOpen ? "rgba(212,150,58,0.15)" : "rgba(255,255,255,0.05)", color: historyOpen ? "var(--primary)" : "var(--muted-foreground)" }}
              title="Historique des notifications"
            >
              🔔
              {notifications.length > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>

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

      {/* Notification History drawer */}
      <NotificationHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        notifications={notifications}
        onDismiss={dismiss}
        onDismissAll={dismissAll}
      />

      {/* Notification Banner */}
      <NotificationBanner notifications={notifications} onDismiss={dismiss} onDismissAll={dismissAll} />

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
      {page === "bilan"        && <BilanPage />}
      {page === "events"       && <EventsPage />}
      {page === "tickets"      && <TicketsPage />}
      {page === "birthdays"    && <BirthdaysPage />}
      {page === "suggestions"  && <SuggestionsPage />}
      {page === "sondages"          && <SondagesPage />}
      {page === "embeds-programmes" && <EmbedsProgrammesPage />}
      {page === "parametres"        && <ParametresPage />}
      {page === "live-activity"     && <LiveActivityPage liveNotifications={notifications} />}

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
