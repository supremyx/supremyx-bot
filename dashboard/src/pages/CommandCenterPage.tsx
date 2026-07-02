import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiUrl } from "../lib/api";
import { toast } from "sonner";

const LS_KEY = "supremyx_api_key";

interface Channel { id: string; name: string; }
interface Role { id: string; name: string; color: string; }
interface Member { id: string; tag: string; username: string; displayName: string; }
interface Tournament { _id: string; name: string; active: boolean; winner?: string; startedAt: string; }
interface GuildInfo { id: string; name: string; channels: Channel[]; roles: Role[]; members: Member[]; }
interface Note { _id: string; target: string; content: string; author: string; createdAt: string; }
interface BlacklistEntry { _id: string; target: string; reason: string; addedBy: string; createdAt: string; }

async function apiAction(path: string, method: string, body?: object, apiKey?: string) {
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
  };
  if (body && method !== "GET") opts.body = JSON.stringify(body);
  const res = await fetch(apiUrl(path), opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// ─── Types recherche ──────────────────────────────────────────────────────────
interface TeamResult    { type: "team";      name: string; points: number; kills: number; rank: number; }
interface PlayerResult  { type: "player";    displayName: string; teamName: string; totalKills: number; totalMatches: number; }
interface BlackResult   { type: "black";     target: string; reason: string; }
interface NoteResult    { type: "note";      _id: string; target: string; content: string; }
type SearchResult = TeamResult | PlayerResult | BlackResult | NoteResult;

// ─── Composant recherche globale ───────────────────────────────────────────────
function GlobalSearch({
  apiKey, teams, players, blacklist, onNavigate,
}: {
  apiKey: string;
  teams: { name: string; points: number; kills: number; rank: number }[];
  players: { displayName: string; teamName: string; totalKills: number; totalMatches: number }[];
  blacklist: { target: string; reason: string }[];
  onNavigate: (tab: string) => void;
}) {
  const [q, setQ]           = useState("");
  const [open, setOpen]     = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [noteResults, setNoteResults] = useState<NoteResult[]>([]);
  const timerRef            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef             = useRef<HTMLDivElement>(null);

  // Fermer en cliquant dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Recherche debounced
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); setNoteResults([]); setOpen(false); return; }

    timerRef.current = setTimeout(async () => {
      const lower = q.toLowerCase();
      const teamHits:  TeamResult[]   = teams
        .filter(t => t.name.toLowerCase().includes(lower))
        .slice(0, 4)
        .map(t => ({ type: "team" as const, ...t }));
      const playerHits: PlayerResult[] = players
        .filter(p => p.displayName.toLowerCase().includes(lower) || p.teamName.toLowerCase().includes(lower))
        .slice(0, 4)
        .map(p => ({ type: "player" as const, ...p }));
      const blackHits: BlackResult[] = blacklist
        .filter(b => b.target.toLowerCase().includes(lower))
        .slice(0, 3)
        .map(b => ({ type: "black" as const, ...b }));

      setResults([...teamHits, ...playerHits, ...blackHits]);

      // Notes — appel API live
      try {
        const d = await apiAction(`/api/actions/notes?target=${encodeURIComponent(q)}`, "GET", undefined, apiKey);
        setNoteResults((d.notes || []).slice(0, 3).map((n: { _id: string; target: string; content: string }) => ({ type: "note" as const, ...n })));
      } catch { setNoteResults([]); }

      setOpen(true);
    }, 280);
  }, [q, teams, players, blacklist, apiKey]);

  const total = results.length + noteResults.length;

  const highlight = (text: string) => {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: "rgba(88,101,242,0.35)", color: "inherit", borderRadius: 2 }}>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const SECTION = (label: string, emoji: string) => (
    <div style={{ padding: "4px 12px", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid var(--border)", marginBottom: 2 }}>
      {emoji} {label}
    </div>
  );

  const ROW = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", padding: "7px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 10, borderRadius: 6 }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
      onMouseLeave={e => (e.currentTarget.style.background = "none")}
    >
      {children}
    </button>
  );

  return (
    <div ref={wrapRef} style={{ position: "relative", maxWidth: 540, marginBottom: "1rem" }}>
      {/* Search input */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", border: "1.5px solid", borderColor: open ? "#5865f2" : "var(--border)", borderRadius: 10, background: "var(--card)", transition: "border-color 0.15s" }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onKeyDown={e => e.key === "Escape" && (setOpen(false), setQ(""))}
          placeholder="Rechercher une équipe, un joueur, une note…"
          style={{ flex: 1, border: "none", background: "transparent", color: "var(--foreground)", fontSize: 14, outline: "none" }}
          data-testid="input-global-search"
        />
        {q && (
          <button onClick={() => { setQ(""); setOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Dropdown */}
      {open && total > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 100, overflow: "hidden", maxHeight: 440, overflowY: "auto" }}>

          {/* Équipes */}
          {results.filter(r => r.type === "team").length > 0 && (
            <>
              {SECTION("Équipes", "👥")}
              {results.filter(r => r.type === "team").map((r) => {
                const t = r as TeamResult;
                return (
                  <ROW key={t.name} onClick={() => { onNavigate("equipes"); setOpen(false); setQ(""); }}>
                    <span style={{ fontSize: 18 }}>🏆</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{highlight(t.name)}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted-foreground)" }}>#{t.rank} · {t.points} pts · {t.kills} kills</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#5865f2" }}>→ Équipes</span>
                  </ROW>
                );
              })}
            </>
          )}

          {/* Joueurs */}
          {results.filter(r => r.type === "player").length > 0 && (
            <>
              {SECTION("Joueurs", "💀")}
              {results.filter(r => r.type === "player").map((r) => {
                const p = r as PlayerResult;
                return (
                  <ROW key={`${p.displayName}-${p.teamName}`} onClick={() => { onNavigate("xp"); setOpen(false); setQ(""); }}>
                    <span style={{ fontSize: 18 }}>🎮</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{highlight(p.displayName)}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted-foreground)" }}>{highlight(p.teamName)} · {p.totalKills} kills en {p.totalMatches} matchs</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#5865f2" }}>→ XP</span>
                  </ROW>
                );
              })}
            </>
          )}

          {/* Notes */}
          {noteResults.length > 0 && (
            <>
              {SECTION("Notes", "📝")}
              {noteResults.map((n) => (
                <ROW key={n._id} onClick={() => { onNavigate("notes"); setOpen(false); setQ(""); }}>
                  <span style={{ fontSize: 18 }}>📌</span>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <span style={{ fontWeight: 600 }}>{highlight(n.target)}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted-foreground)", display: "inline-block", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}>{n.content}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#5865f2" }}>→ Notes</span>
                </ROW>
              ))}
            </>
          )}

          {/* Blacklist */}
          {results.filter(r => r.type === "black").length > 0 && (
            <>
              {SECTION("Blacklist", "🚫")}
              {results.filter(r => r.type === "black").map((r) => {
                const b = r as BlackResult;
                return (
                  <ROW key={b.target} onClick={() => { onNavigate("blacklist"); setOpen(false); setQ(""); }}>
                    <span style={{ fontSize: 18 }}>🚫</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{highlight(b.target)}</span>
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted-foreground)" }}>{b.reason}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#5865f2" }}>→ Blacklist</span>
                  </ROW>
                );
              })}
            </>
          )}

          {/* Footer */}
          <div style={{ padding: "6px 12px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--muted-foreground)", display: "flex", justifyContent: "space-between" }}>
            <span>{total} résultat{total > 1 ? "s" : ""} pour « {q} »</span>
            <span>Échap pour fermer</span>
          </div>
        </div>
      )}

      {/* No results */}
      {open && total === 0 && q.length >= 2 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 12px", textAlign: "center", fontSize: 13, color: "var(--muted-foreground)", zIndex: 100 }}>
          Aucun résultat pour « {q} »
        </div>
      )}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({
  teams, players, blacklist, pendingInscriptions,
}: {
  teams: { name: string; points: number; kills: number; wins: number; losses: number }[];
  players: { totalKills: number; totalMatches: number }[];
  blacklist: { target: string }[];
  pendingInscriptions: number;
}) {
  if (teams.length === 0 && players.length === 0) return null;

  const totalKills   = teams.reduce((s, t) => s + (t.kills || 0), 0);
  const totalPoints  = teams.reduce((s, t) => s + (t.points || 0), 0);
  const totalWins    = teams.reduce((s, t) => s + (t.wins || 0), 0);
  const topTeam      = teams[0];

  const STAT_CARD_STYLE: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flex: "1 1 130px",
    minWidth: 120,
  };

  const stats: { emoji: string; label: string; value: string | number; sub?: string; accent?: string }[] = [
    { emoji: "👥", label: "Équipes",          value: teams.length,    sub: `${totalWins} victoires` },
    { emoji: "💀", label: "Total kills",       value: totalKills.toLocaleString("fr-FR"), sub: `${totalPoints} pts cumulés` },
    { emoji: "🎮", label: "Joueurs actifs",    value: players.length,  sub: `via stats matchs` },
    { emoji: "🚫", label: "Blacklistés",       value: blacklist.length, sub: "joueurs bannis" },
    {
      emoji: "🟡",
      label: "Inscriptions en attente",
      value: pendingInscriptions,
      sub: pendingInscriptions === 0 ? "Rien à traiter" : "à valider",
      accent: pendingInscriptions > 0 ? "#f59e0b" : undefined,
    },
    ...(topTeam ? [{
      emoji: "🥇",
      label: "Top équipe",
      value: topTeam.name,
      sub: `${topTeam.points} pts · ${topTeam.kills} kills`,
      accent: "#f59e0b",
    }] : []),
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: "1.25rem" }}>
      {stats.map(s => (
        <div key={s.label} style={STAT_CARD_STYLE}>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {s.emoji} {s.label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: s.accent ?? "var(--foreground)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.value}
          </div>
          {s.sub && (
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

const TABS = [
  { id: "tournois",      label: "Tournois",      emoji: "🎮" },
  { id: "matchs",        label: "Matchs",         emoji: "⚔️" },
  { id: "equipes",       label: "Équipes",         emoji: "👥" },
  { id: "roster",        label: "Roster",         emoji: "🪖" },
  { id: "xp",            label: "XP & Niveaux",   emoji: "📊" },
  { id: "comms",         label: "Communication",  emoji: "📢" },
  { id: "embed",         label: "Embed Builder",  emoji: "🖼️" },
  { id: "moderation",    label: "Modération",     emoji: "🛡️" },
  { id: "inscriptions",  label: "Inscriptions",   emoji: "🎟️" },
  { id: "config",        label: "Configuration",  emoji: "⚙️" },
  { id: "notes",         label: "Notes",          emoji: "📝" },
  { id: "blacklist",     label: "Blacklist",      emoji: "🚫" },
];

function Card({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.25rem", display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 6 }}>
        <span>{emoji}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--background)", color: "var(--foreground)", fontSize: 13, boxSizing: "border-box" }}
    />
  );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--background)", color: "var(--foreground)", fontSize: 13, boxSizing: "border-box" }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--background)", color: "var(--foreground)", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
    />
  );
}

function ActionBtn({ onClick, loading, label, danger }: { onClick: () => void; loading: boolean; label: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: "7px 16px", borderRadius: 6, border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600,
        background: danger ? "#ed4245" : "#5865f2", color: "#fff", opacity: loading ? 0.6 : 1, alignSelf: "flex-start",
      }}
    >
      {loading ? "⏳ En cours…" : label}
    </button>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
      {children}
    </div>
  );
}

// ─── Tab sections ─────────────────────────────────────────────────────────────

function TournoisTab({ apiKey, guildInfo }: { apiKey: string; guildInfo: GuildInfo | null }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [newName, setNewName] = useState("");
  const [winner, setWinner] = useState("");
  const [selTournoi, setSelTournoi] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const data = await apiAction("/api/tournaments", "GET", undefined, apiKey);
      setTournaments(Array.isArray(data) ? data : data.tournaments || []);
    } catch {}
  }, [apiKey]);

  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(l => ({ ...l, [key]: true }));
    try { await fn(); toast.success("Action réussie !"); load(); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(l => ({ ...l, [key]: false })); }
  };

  const active = tournaments.find(t => t.active);

  return (
    <Grid>
      <Card emoji="🆕" title="Créer un tournoi">
        <Field label="Nom du tournoi"><Input value={newName} onChange={setNewName} placeholder="Ex: SUPREMYX Cup #5" /></Field>
        {active && <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>⚠️ Tournoi actif en cours : <strong>{active.name}</strong>. Terminez-le d'abord.</p>}
        <ActionBtn loading={!!loading.create} onClick={() => act("create", () => apiAction("/api/actions/tournoi/create", "POST", { name: newName }, apiKey))} label="✅ Créer le tournoi" />
      </Card>

      <Card emoji="🏁" title="Terminer le tournoi actif">
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
          {active ? `Tournoi actif : "${active.name}"` : "Aucun tournoi actif."}
        </p>
        <Field label="Équipe gagnante (optionnel)">
          <Input value={winner} onChange={setWinner} placeholder="Nom de l'équipe gagnante (laisser vide si aucun)" />
        </Field>
        <ActionBtn loading={!!loading.finish} onClick={() => act("finish", () => apiAction("/api/actions/tournoi/finish", "POST", { winner }, apiKey))} label="🏁 Terminer" />
      </Card>

      <Card emoji="🗑️" title="Supprimer un tournoi">
        <Field label="Tournoi à supprimer">
          <Select value={selTournoi} onChange={setSelTournoi} placeholder="— Choisir un tournoi —"
            options={tournaments.map(t => ({ value: t._id, label: `${t.active ? "🟢" : "⚪"} ${t.name}` }))}
          />
        </Field>
        <ActionBtn danger loading={!!loading.delete} onClick={() => act("delete", () => apiAction(`/api/actions/tournoi/${selTournoi}`, "DELETE", undefined, apiKey))} label="🗑️ Supprimer" />
      </Card>

      <Card emoji="📋" title="Tournois existants">
        <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {tournaments.length === 0 && <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Aucun tournoi.</p>}
          {tournaments.map(t => (
            <div key={t._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 6, background: "var(--muted)", fontSize: 12 }}>
              <span>{t.active ? "🟢" : "⚪"} {t.name}</span>
              <span style={{ color: "var(--muted-foreground)" }}>{t.winner ? `🏆 ${t.winner}` : ""}</span>
            </div>
          ))}
        </div>
      </Card>
    </Grid>
  );
}

function MatchsTab({ apiKey }: { apiKey: string }) {
  const [team, setTeam] = useState(""); const [placement, setPlacement] = useState(""); const [kills, setKills] = useState(""); const [tournamentName, setTournamentName] = useState(""); const [teams, setTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiAction("/api/ranking", "GET", undefined, apiKey).then(d => {
      const list = Array.isArray(d) ? d : d.ranking || [];
      setTeams(list.map((t: { team: string }) => t.team));
    }).catch(() => {});
  }, [apiKey]);

  const submit = async () => {
    if (!team || !placement || !kills) return toast.error("Équipe, placement et kills requis");
    setLoading(true);
    try {
      const data = await apiAction("/api/actions/match/add", "POST", { team, placement: Number(placement), kills: Number(kills), tournamentName: tournamentName || undefined }, apiKey);
      toast.success(`Match ajouté pour ${team} — Place ${data.placement}, ${data.kills} kills → ${data.points} points`);
      setPlacement(""); setKills("");
    } catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <Grid>
      <Card emoji="➕" title="Ajouter un résultat de match">
        <Field label="Équipe">
          <Select value={team} onChange={setTeam} placeholder="— Choisir une équipe —" options={teams.map(t => ({ value: t, label: t }))} />
        </Field>
        <Field label="Placement (1-8)"><Input value={placement} onChange={setPlacement} placeholder="Ex: 1" type="number" /></Field>
        <Field label="Kills"><Input value={kills} onChange={setKills} placeholder="Ex: 12" type="number" /></Field>
        <Field label="Nom du tournoi (optionnel)"><Input value={tournamentName} onChange={setTournamentName} placeholder="Ex: SUPREMYX Cup #5" /></Field>
        <ActionBtn loading={loading} onClick={submit} label="➕ Ajouter le match" />
      </Card>

      <Card emoji="ℹ️" title="Comment ça marche">
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>
          Les points sont calculés automatiquement selon le barème configuré (placement + bonus kills).<br /><br />
          Le match est associé au tournoi actif si aucun nom de tournoi n'est précisé.<br /><br />
          Pour supprimer un match, utilisez la page <strong>Résultats</strong>.
        </p>
      </Card>
    </Grid>
  );
}

function EquipesTab({ apiKey }: { apiKey: string }) {
  const [createName, setCreateName] = useState(""); const [deleteName, setDeleteName] = useState(""); const [oldName, setOldName] = useState(""); const [newName, setNewName] = useState(""); const [teams, setTeams] = useState<string[]>([]); const [loading, setLoading] = useState<Record<string, boolean>>({});

  const loadTeams = useCallback(() => {
    apiAction("/api/ranking", "GET", undefined, apiKey).then(d => {
      const list = Array.isArray(d) ? d : d.ranking || [];
      setTeams(list.map((t: { team: string }) => t.team));
    }).catch(() => {});
  }, [apiKey]);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(l => ({ ...l, [key]: true }));
    try { await fn(); toast.success("Action réussie !"); loadTeams(); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(l => ({ ...l, [key]: false })); }
  };

  return (
    <Grid>
      <Card emoji="🆕" title="Créer une équipe">
        <Field label="Nom de l'équipe"><Input value={createName} onChange={setCreateName} placeholder="Ex: Team Phoenix" /></Field>
        <ActionBtn loading={!!loading.create} onClick={() => act("create", async () => { await apiAction("/api/actions/team/create", "POST", { name: createName }, apiKey); setCreateName(""); })} label="✅ Créer l'équipe" />
      </Card>

      <Card emoji="✏️" title="Renommer une équipe">
        <Field label="Équipe actuelle">
          <Select value={oldName} onChange={setOldName} placeholder="— Choisir —" options={teams.map(t => ({ value: t, label: t }))} />
        </Field>
        <Field label="Nouveau nom"><Input value={newName} onChange={setNewName} placeholder="Nouveau nom" /></Field>
        <ActionBtn loading={!!loading.rename} onClick={() => act("rename", async () => { await apiAction("/api/actions/team/rename", "PATCH", { oldName, newName }, apiKey); setOldName(""); setNewName(""); })} label="✏️ Renommer" />
      </Card>

      <Card emoji="🗑️" title="Supprimer une équipe">
        <Field label="Équipe à supprimer">
          <Select value={deleteName} onChange={setDeleteName} placeholder="— Choisir —" options={teams.map(t => ({ value: t, label: t }))} />
        </Field>
        <p style={{ fontSize: 11, color: "#f87171", margin: 0 }}>⚠️ Supprime aussi les stats et le roster associés.</p>
        <ActionBtn danger loading={!!loading.delete} onClick={() => act("delete", async () => { await apiAction("/api/actions/team", "DELETE", { name: deleteName }, apiKey); setDeleteName(""); })} label="🗑️ Supprimer" />
      </Card>

      <Card emoji="📋" title="Équipes enregistrées">
        <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {teams.map(t => (
            <span key={t} style={{ padding: "2px 8px", borderRadius: 12, background: "var(--muted)", fontSize: 12 }}>{t}</span>
          ))}
          {teams.length === 0 && <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Aucune équipe.</p>}
        </div>
      </Card>
    </Grid>
  );
}

function RosterTab({ apiKey, guildInfo }: { apiKey: string; guildInfo: GuildInfo | null }) {
  const [teamName, setTeamName] = useState(""); const [displayName, setDisplayName] = useState(""); const [role, setRole] = useState("Flex"); const [userId, setUserId] = useState(""); const [rmTeam, setRmTeam] = useState(""); const [rmName, setRmName] = useState(""); const [teams, setTeams] = useState<string[]>([]); const [loading, setLoading] = useState<Record<string, boolean>>({});

  const ROLES = ["IGL", "Fragger", "Support", "Sniper", "Entry", "Flex", "Coach", "Remplaçant"];

  useEffect(() => {
    apiAction("/api/ranking", "GET", undefined, apiKey).then(d => {
      const list = Array.isArray(d) ? d : d.ranking || [];
      setTeams(list.map((t: { team: string }) => t.team));
    }).catch(() => {});
  }, [apiKey]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(l => ({ ...l, [key]: true }));
    try { await fn(); toast.success("Action réussie !"); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(l => ({ ...l, [key]: false })); }
  };

  return (
    <Grid>
      <Card emoji="➕" title="Ajouter un joueur au roster">
        <Field label="Équipe">
          <Select value={teamName} onChange={setTeamName} placeholder="— Choisir —" options={teams.map(t => ({ value: t, label: t }))} />
        </Field>
        <Field label="Pseudo du joueur"><Input value={displayName} onChange={setDisplayName} placeholder="Ex: Maverick" /></Field>
        <Field label="Rôle">
          <Select value={role} onChange={setRole} options={ROLES.map(r => ({ value: r, label: r }))} />
        </Field>
        <Field label="Discord User ID (optionnel)">
          <Select value={userId} onChange={setUserId} placeholder="— Ou saisir manuellement —"
            options={(guildInfo?.members || []).map(m => ({ value: m.id, label: `${m.displayName} (${m.tag})` }))}
          />
          <div style={{ marginTop: 4 }}><Input value={userId} onChange={setUserId} placeholder="ID Discord (ex: 123456789012345678)" /></div>
        </Field>
        <ActionBtn loading={!!loading.add} onClick={() => act("add", () => apiAction("/api/actions/roster/member", "POST", { teamName, displayName, role, userId }, apiKey))} label="➕ Ajouter" />
      </Card>

      <Card emoji="➖" title="Retirer un joueur du roster">
        <Field label="Équipe">
          <Select value={rmTeam} onChange={setRmTeam} placeholder="— Choisir —" options={teams.map(t => ({ value: t, label: t }))} />
        </Field>
        <Field label="Pseudo exact du joueur"><Input value={rmName} onChange={setRmName} placeholder="Ex: Maverick" /></Field>
        <ActionBtn danger loading={!!loading.remove} onClick={() => act("remove", () => apiAction("/api/actions/roster/member", "DELETE", { teamName: rmTeam, displayName: rmName }, apiKey))} label="➖ Retirer" />
      </Card>

      <Card emoji="ℹ️" title="Astuce">
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>
          Pour voir le roster complet d'une équipe, rendez-vous sur la page <strong>Effectifs</strong>.<br /><br />
          Le Discord User ID permet de lier le joueur à son compte Discord pour les notifs et les statistiques de niveau XP.
        </p>
      </Card>
    </Grid>
  );
}

function XpTab({ apiKey, guildInfo }: { apiKey: string; guildInfo: GuildInfo | null }) {
  const [userId, setUserId] = useState(""); const [username, setUsername] = useState(""); const [amount, setAmount] = useState(""); const [loading, setLoading] = useState(false);

  const act = async (sign: 1 | -1) => {
    if (!userId || !amount) return toast.error("User ID et montant requis");
    setLoading(true);
    try {
      const data = await apiAction("/api/actions/player/xp", "POST", { userId, username, amount: sign * Number(amount) }, apiKey);
      toast.success(`XP ${sign > 0 ? "accordé" : "retiré"} ! Total: ${data.xp} XP (Niveau ${data.level})`);
    } catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <Grid>
      <Card emoji="📊" title="Donner / Retirer de l'XP">
        <Field label="Membre Discord">
          <Select value={userId} onChange={v => { setUserId(v); const m = guildInfo?.members.find(m => m.id === v); if (m) setUsername(m.username); }}
            placeholder="— Choisir un membre —"
            options={(guildInfo?.members || []).map(m => ({ value: m.id, label: `${m.displayName} (${m.tag})` }))}
          />
        </Field>
        <Field label="Discord User ID (si absent de la liste)"><Input value={userId} onChange={setUserId} placeholder="123456789012345678" /></Field>
        <Field label="Username"><Input value={username} onChange={setUsername} placeholder="Ex: maverick" /></Field>
        <Field label="Montant d'XP"><Input value={amount} onChange={setAmount} placeholder="Ex: 100" type="number" /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <ActionBtn loading={loading} onClick={() => act(1)} label="➕ Donner l'XP" />
          <ActionBtn danger loading={loading} onClick={() => act(-1)} label="➖ Retirer l'XP" />
        </div>
      </Card>

      <Card emoji="ℹ️" title="Système XP">
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>
          Le niveau est recalculé automatiquement : <code>niveau = √(xp / 100)</code>.<br /><br />
          L'XP est spécifique à chaque serveur. Les stats de niveau sont visibles sur la page <strong>Joueurs</strong>.
        </p>
      </Card>
    </Grid>
  );
}

function CommsTab({ apiKey, guildInfo }: { apiKey: string; guildInfo: GuildInfo | null }) {
  const [annCh, setAnnCh] = useState(""); const [annMsg, setAnnMsg] = useState("");
  const [sayCh, setSayCh] = useState(""); const [sayMsg, setSayMsg] = useState("");
  const [pollCh, setPollCh] = useState(""); const [pollQ, setPollQ] = useState("");
  const [effCh, setEffCh] = useState(""); const [effN, setEffN] = useState("10");
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const channels = (guildInfo?.channels || []).map(c => ({ value: c.id, label: `#${c.name}` }));

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(l => ({ ...l, [key]: true }));
    try { const r = await fn(); toast.success("Action réussie !" + ((r as { deleted?: number }).deleted !== undefined ? ` (${(r as { deleted: number }).deleted} messages supprimés)` : "")); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(l => ({ ...l, [key]: false })); }
  };

  return (
    <Grid>
      <Card emoji="📣" title="Envoyer une annonce">
        <Field label="Salon Discord">
          <Select value={annCh} onChange={setAnnCh} placeholder="— Choisir un salon —" options={channels} />
        </Field>
        <Field label="Message">
          <Textarea value={annMsg} onChange={setAnnMsg} placeholder="Tapez votre annonce ici…" rows={4} />
        </Field>
        <ActionBtn loading={!!loading.ann} onClick={() => act("ann", () => apiAction("/api/actions/announce", "POST", { channelId: annCh, message: annMsg }, apiKey))} label="📣 Envoyer l'annonce" />
      </Card>

      <Card emoji="💬" title="Faire parler le bot (!dire)">
        <Field label="Salon Discord">
          <Select value={sayCh} onChange={setSayCh} placeholder="— Choisir un salon —" options={channels} />
        </Field>
        <Field label="Message">
          <Textarea value={sayMsg} onChange={setSayMsg} placeholder="Message à envoyer…" />
        </Field>
        <ActionBtn loading={!!loading.say} onClick={() => act("say", () => apiAction("/api/actions/say", "POST", { channelId: sayCh, message: sayMsg }, apiKey))} label="💬 Envoyer" />
      </Card>

      <Card emoji="📊" title="Créer un sondage (!vote)">
        <Field label="Salon Discord">
          <Select value={pollCh} onChange={setPollCh} placeholder="— Choisir un salon —" options={channels} />
        </Field>
        <Field label="Question"><Input value={pollQ} onChange={setPollQ} placeholder="Ex: Êtes-vous disponibles vendredi ?" /></Field>
        <ActionBtn loading={!!loading.poll} onClick={() => act("poll", () => apiAction("/api/actions/poll", "POST", { channelId: pollCh, question: pollQ }, apiKey))} label="📊 Publier le sondage" />
      </Card>

      <Card emoji="🗑️" title="Supprimer des messages (!effacer)">
        <Field label="Salon Discord">
          <Select value={effCh} onChange={setEffCh} placeholder="— Choisir un salon —" options={channels} />
        </Field>
        <Field label="Nombre de messages (1–100)">
          <Input value={effN} onChange={setEffN} placeholder="10" type="number" />
        </Field>
        <p style={{ fontSize: 11, color: "#f87171", margin: 0 }}>⚠️ Les messages de +14 jours ne peuvent pas être supprimés en masse (limite Discord).</p>
        <ActionBtn danger loading={!!loading.eff} onClick={() => act("eff", () => apiAction("/api/actions/effacer", "POST", { channelId: effCh, count: Number(effN) }, apiKey))} label="🗑️ Supprimer" />
      </Card>
    </Grid>
  );
}

function EmbedTab({ apiKey, guildInfo }: { apiKey: string; guildInfo: GuildInfo | null }) {
  const [ch, setCh] = useState(""); const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [color, setColor] = useState("#5865f2"); const [footer, setFooter] = useState(""); const [image, setImage] = useState(""); const [loading, setLoading] = useState(false);

  const channels = (guildInfo?.channels || []).map(c => ({ value: c.id, label: `#${c.name}` }));

  const preview: React.CSSProperties = {
    borderLeft: `4px solid ${color}`, padding: "10px 14px", borderRadius: "0 6px 6px 0",
    background: "#2b2d31", color: "#dbdee1",
  };

  const submit = async () => {
    if (!ch || (!title && !desc)) return toast.error("Salon + titre ou description requis");
    setLoading(true);
    try { await apiAction("/api/actions/embed/send", "POST", { channelId: ch, title, description: desc, color, footer, image }, apiKey); toast.success("Embed publié !"); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card emoji="🖼️" title="Constructeur d'embed">
        <Field label="Salon Discord">
          <Select value={ch} onChange={setCh} placeholder="— Choisir un salon —" options={channels} />
        </Field>
        <Field label="Titre"><Input value={title} onChange={setTitle} placeholder="Titre de l'embed" /></Field>
        <Field label="Description"><Textarea value={desc} onChange={setDesc} placeholder="Contenu de l'embed (Markdown supporté)" rows={5} /></Field>
        <Field label="Couleur">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 40, height: 32, border: "none", borderRadius: 4, cursor: "pointer", background: "none" }} />
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{color}</span>
          </div>
        </Field>
        <Field label="Footer (optionnel)"><Input value={footer} onChange={setFooter} placeholder="SUPREMYX Esports" /></Field>
        <Field label="URL Image (optionnel)"><Input value={image} onChange={setImage} placeholder="https://…" /></Field>
        <ActionBtn loading={loading} onClick={submit} label="🚀 Publier l'embed" />
      </Card>

      <Card emoji="👁️" title="Prévisualisation">
        <div style={preview}>
          {title && <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14 }}>{title}</p>}
          {desc && <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{desc}</p>}
          {image && <img src={image} alt="" style={{ maxWidth: "100%", marginTop: 8, borderRadius: 4 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
          {footer && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#949ba4" }}>{footer}</p>}
        </div>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
          Prévisualisation approximative. Le rendu final peut varier selon Discord.
        </p>
      </Card>
    </div>
  );
}

function ModerationTab({ apiKey, guildInfo }: { apiKey: string; guildInfo: GuildInfo | null }) {
  const [warnId, setWarnId] = useState(""); const [warnTag, setWarnTag] = useState(""); const [warnReason, setWarnReason] = useState("");
  const [muteId, setMuteId] = useState(""); const [muteDur, setMuteDur] = useState("60"); const [muteReason, setMuteReason] = useState("");
  const [unmuteId, setUnmuteId] = useState("");
  const [rmWarnId, setRmWarnId] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const memberOpts = (guildInfo?.members || []).map(m => ({ value: m.id, label: `${m.displayName} (${m.tag})` }));

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(l => ({ ...l, [key]: true }));
    try { await fn(); toast.success("Action réussie !"); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(l => ({ ...l, [key]: false })); }
  };

  return (
    <Grid>
      <Card emoji="⚠️" title="Avertir un membre (!avertir)">
        <Field label="Membre">
          <Select value={warnId} onChange={v => { setWarnId(v); const m = guildInfo?.members.find(m => m.id === v); if (m) setWarnTag(m.tag); }}
            placeholder="— Choisir —" options={memberOpts} />
        </Field>
        <Field label="Discord User ID"><Input value={warnId} onChange={setWarnId} placeholder="ID Discord" /></Field>
        <Field label="Tag (@user#0000)"><Input value={warnTag} onChange={setWarnTag} placeholder="user#1234" /></Field>
        <Field label="Raison"><Input value={warnReason} onChange={setWarnReason} placeholder="Motif de l'avertissement" /></Field>
        <ActionBtn loading={!!loading.warn} onClick={() => act("warn", () => apiAction("/api/actions/warn", "POST", { userId: warnId, userTag: warnTag, reason: warnReason }, apiKey))} label="⚠️ Avertir" />
      </Card>

      <Card emoji="🔇" title="Mettre en sourdine (!sourdine)">
        <Field label="Membre">
          <Select value={muteId} onChange={setMuteId} placeholder="— Choisir —" options={memberOpts} />
        </Field>
        <Field label="ID Discord (si absent)"><Input value={muteId} onChange={setMuteId} placeholder="ID Discord" /></Field>
        <Field label="Durée (minutes)"><Input value={muteDur} onChange={setMuteDur} placeholder="60" type="number" /></Field>
        <Field label="Raison"><Input value={muteReason} onChange={setMuteReason} placeholder="Motif (optionnel)" /></Field>
        <ActionBtn loading={!!loading.mute} onClick={() => act("mute", () => apiAction("/api/actions/mute", "POST", { userId: muteId, durationMinutes: Number(muteDur), reason: muteReason }, apiKey))} label="🔇 Mettre en sourdine" />
      </Card>

      <Card emoji="🔊" title="Retirer la sourdine (!retablir)">
        <Field label="Membre">
          <Select value={unmuteId} onChange={setUnmuteId} placeholder="— Choisir —" options={memberOpts} />
        </Field>
        <Field label="ID Discord (si absent)"><Input value={unmuteId} onChange={setUnmuteId} placeholder="ID Discord" /></Field>
        <ActionBtn loading={!!loading.unmute} onClick={() => act("unmute", () => apiAction("/api/actions/unmute", "POST", { userId: unmuteId }, apiKey))} label="🔊 Rétablir" />
      </Card>

      <Card emoji="🗑️" title="Retirer un avertissement (!supprimerwarn)">
        <Field label="Membre">
          <Select value={rmWarnId} onChange={setRmWarnId} placeholder="— Choisir —" options={memberOpts} />
        </Field>
        <Field label="ID Discord (si absent)"><Input value={rmWarnId} onChange={setRmWarnId} placeholder="ID Discord" /></Field>
        <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>Retire le dernier avertissement enregistré pour ce membre.</p>
        <ActionBtn danger loading={!!loading.rmwarn} onClick={() => act("rmwarn", () => apiAction("/api/actions/warn", "DELETE", { userId: rmWarnId }, apiKey))} label="🗑️ Retirer le warn" />
      </Card>
    </Grid>
  );
}

function ConfigTab({ apiKey, guildInfo }: { apiKey: string; guildInfo: GuildInfo | null }) {
  const [welMsg, setWelMsg] = useState(""); const [welCh, setWelCh] = useState(""); const [welEnabled, setWelEnabled] = useState(true);
  const [arRole, setArRole] = useState(""); const [arEnabled, setArEnabled] = useState(true);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const channels = (guildInfo?.channels || []).map(c => ({ value: c.id, label: `#${c.name}` }));
  const roles = (guildInfo?.roles || []).map(r => ({ value: r.id, label: r.name }));

  useEffect(() => {
    if (!apiKey) return;
    apiAction("/api/actions/config/welcome", "GET", undefined, apiKey).then(d => { if (d.message) setWelMsg(d.message); if (d.channelId) setWelCh(d.channelId); if (d.enabled !== undefined) setWelEnabled(d.enabled); }).catch(() => {});
    apiAction("/api/actions/config/autorole", "GET", undefined, apiKey).then(d => { if (d.roleId) setArRole(d.roleId); if (d.enabled !== undefined) setArEnabled(d.enabled); }).catch(() => {});
  }, [apiKey]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(l => ({ ...l, [key]: true }));
    try { await fn(); toast.success("Configuration sauvegardée !"); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(l => ({ ...l, [key]: false })); }
  };

  return (
    <Grid>
      <Card emoji="👋" title="Message de bienvenue (!bienvenue)">
        <Field label="Salon d'accueil">
          <Select value={welCh} onChange={setWelCh} placeholder="— Choisir un salon —" options={channels} />
        </Field>
        <Field label="Message">
          <Textarea value={welMsg} onChange={setWelMsg} placeholder="Bienvenue {user} sur {server} ! Tu es notre {count}e membre." rows={3} />
          <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "4px 0 0" }}>Variables : {"{user}"} {"{server}"} {"{count}"}</p>
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={welEnabled} onChange={e => setWelEnabled(e.target.checked)} />
          Activé
        </label>
        <ActionBtn loading={!!loading.welcome} onClick={() => act("welcome", () => apiAction("/api/actions/config/welcome", "PUT", { channelId: welCh, message: welMsg, enabled: welEnabled }, apiKey))} label="💾 Sauvegarder" />
      </Card>

      <Card emoji="🎭" title="Rôle automatique (!rolesauto)">
        <Field label="Rôle à attribuer aux nouveaux membres">
          <Select value={arRole} onChange={setArRole} placeholder="— Choisir un rôle —" options={roles} />
        </Field>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={arEnabled} onChange={e => setArEnabled(e.target.checked)} />
          Activé
        </label>
        <ActionBtn loading={!!loading.autorole} onClick={() => act("autorole", () => apiAction("/api/actions/config/autorole", "PUT", { roleId: arRole, enabled: arEnabled }, apiKey))} label="💾 Sauvegarder" />
      </Card>

      <Card emoji="ℹ️" title="Autres configurations">
        <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.7 }}>
          Barème de points, salons de journaux, MOTD → <strong>page Paramètres</strong><br />
          Config IA (modèle, quota) → <strong>page Analytiques IA</strong><br />
          Config inscriptions → <strong>page Inscriptions</strong><br />
          Config tickets → <strong>page Tickets</strong><br />
          Config rapports hebdo → <strong>page Bilans hebdo</strong>
        </p>
      </Card>
    </Grid>
  );
}

function NotesTab({ apiKey }: { apiKey: string }) {
  const [target, setTarget] = useState(""); const [content, setContent] = useState(""); const [search, setSearch] = useState(""); const [notes, setNotes] = useState<Note[]>([]); const [loading, setLoading] = useState<Record<string, boolean>>({});

  const loadNotes = useCallback(async () => {
    try { const d = await apiAction(`/api/actions/notes${search ? `?target=${encodeURIComponent(search)}` : ""}`, "GET", undefined, apiKey); setNotes(d.notes || []); }
    catch {}
  }, [apiKey, search]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(l => ({ ...l, [key]: true }));
    try { await fn(); toast.success("Action réussie !"); loadNotes(); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(l => ({ ...l, [key]: false })); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Grid>
        <Card emoji="📝" title="Ajouter une note">
          <Field label="Cible (équipe ou joueur)"><Input value={target} onChange={setTarget} placeholder="Ex: Team Phoenix ou Maverick" /></Field>
          <Field label="Contenu de la note"><Textarea value={content} onChange={setContent} placeholder="Note interne visible uniquement par le staff…" rows={4} /></Field>
          <ActionBtn loading={!!loading.add} onClick={() => act("add", async () => { await apiAction("/api/actions/notes", "POST", { target, content }, apiKey); setTarget(""); setContent(""); })} label="📝 Ajouter la note" />
        </Card>
        <Card emoji="🔍" title="Rechercher des notes">
          <Field label="Filtrer par cible"><Input value={search} onChange={setSearch} placeholder="Ex: Team Phoenix" /></Field>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>La liste se met à jour automatiquement.</p>
        </Card>
      </Grid>
      <Card emoji="📋" title={`Notes récentes (${notes.length})`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
          {notes.length === 0 && <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Aucune note.</p>}
          {notes.map(n => (
            <div key={n._id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 12px", borderRadius: 8, background: "var(--muted)", fontSize: 13 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{n.target}</span>
                <span style={{ color: "var(--muted-foreground)", fontSize: 11, marginLeft: 8 }}>{new Date(n.createdAt).toLocaleDateString("fr-FR")} · {n.author}</span>
                <p style={{ margin: "4px 0 0", color: "var(--foreground)", lineHeight: 1.4 }}>{n.content}</p>
              </div>
              <button onClick={() => act(n._id, () => apiAction(`/api/actions/notes/${n._id}`, "DELETE", undefined, apiKey))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: 16, padding: "0 4px" }}>
                🗑️
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BlacklistTab({ apiKey }: { apiKey: string }) {
  const [addTarget, setAddTarget] = useState(""); const [addReason, setAddReason] = useState(""); const [rmTarget, setRmTarget] = useState(""); const [entries, setEntries] = useState<BlacklistEntry[]>([]); const [loading, setLoading] = useState<Record<string, boolean>>({});

  const loadBl = useCallback(async () => {
    try { const d = await apiAction("/api/blacklist", "GET", undefined, apiKey); setEntries(Array.isArray(d) ? d : d.blacklist || []); }
    catch {}
  }, [apiKey]);

  useEffect(() => { loadBl(); }, [loadBl]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(l => ({ ...l, [key]: true }));
    try { await fn(); toast.success("Action réussie !"); loadBl(); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(l => ({ ...l, [key]: false })); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Grid>
        <Card emoji="🚫" title="Ajouter à la blacklist (!listenoiree ajouter)">
          <Field label="Pseudo / Nom"><Input value={addTarget} onChange={setAddTarget} placeholder="Ex: ToxicPlayer" /></Field>
          <Field label="Raison"><Input value={addReason} onChange={setAddReason} placeholder="Motif de blacklist" /></Field>
          <ActionBtn loading={!!loading.add} onClick={() => act("add", async () => { await apiAction("/api/actions/blacklist", "POST", { target: addTarget, reason: addReason }, apiKey); setAddTarget(""); setAddReason(""); })} label="🚫 Ajouter" />
        </Card>

        <Card emoji="✅" title="Retirer de la blacklist (!listenoiree retirer)">
          <Field label="Pseudo / Nom à retirer">
            <Select value={rmTarget} onChange={setRmTarget} placeholder="— Choisir —" options={entries.map(e => ({ value: e.target, label: e.target }))} />
            <div style={{ marginTop: 4 }}><Input value={rmTarget} onChange={setRmTarget} placeholder="Ou saisir le nom exact" /></div>
          </Field>
          <ActionBtn loading={!!loading.rm} onClick={() => act("rm", async () => { await apiAction("/api/actions/blacklist", "DELETE", { target: rmTarget }, apiKey); setRmTarget(""); })} label="✅ Retirer de la blacklist" />
        </Card>
      </Grid>

      <Card emoji="📋" title={`Liste noire (${entries.length} entrées)`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 350, overflowY: "auto" }}>
          {entries.length === 0 && <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Liste noire vide.</p>}
          {entries.map(e => (
            <div key={e._id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "6px 10px", borderRadius: 6, background: "var(--muted)", fontSize: 13 }}>
              <span style={{ fontWeight: 600, minWidth: 120 }}>🚫 {e.target}</span>
              <span style={{ flex: 1, color: "var(--muted-foreground)" }}>{e.reason}</span>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{new Date(e.createdAt).toLocaleDateString("fr-FR")}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Inscriptions Tab ─────────────────────────────────────────────────────────

interface TournamentReg {
  _id: string; tournamentName: string; teamName: string; players: string[];
  contact: string; status: string; refuseReason?: string; registeredAt: string;
}
interface WaitlistReg {
  _id: string; teamName: string; tag: string; captainId: string;
  captainTag: string; status: string; position: number; vip: boolean; createdAt: string;
}
interface InscriptionCfg {
  guildId?: string; maxSlots?: number; tournamentTitle?: string;
  active?: boolean; registrationChannelId?: string; waitlistChannelId?: string; roleId?: string;
}

function InscriptionsTab({ apiKey, guildInfo }: { apiKey: string; guildInfo: GuildInfo | null }) {
  const [tournoiRegs, setTournoiRegs] = useState<TournamentReg[]>([]);
  const [waitlist, setWaitlist]       = useState<WaitlistReg[]>([]);
  const [cfg, setCfg]                 = useState<InscriptionCfg>({});
  const [draft, setDraft]             = useState<InscriptionCfg>({});
  const [refuseId, setRefuseId]       = useState<string | null>(null);
  const [refuseReason, setRefuseReason] = useState("");
  const [loading, setLoading]         = useState<Record<string, boolean>>({});

  const channels = (guildInfo?.channels || []).map(c => ({ value: c.id, label: `#${c.name}` }));
  const roles    = (guildInfo?.roles || []).map(r => ({ value: r.id, label: r.name }));

  const load = useCallback(async () => {
    try {
      const d = await apiAction("/api/inscriptions", "GET", undefined, apiKey);
      setTournoiRegs(d.tournoi || []);
      setWaitlist(d.waitlist || []);
    } catch {}
    try {
      const c = await apiAction("/api/inscriptions/config", "GET", undefined, apiKey);
      setCfg(c); setDraft(c);
    } catch {}
  }, [apiKey]);

  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setLoading(l => ({ ...l, [key]: true }));
    try { await fn(); toast.success("Action réussie !"); load(); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(l => ({ ...l, [key]: false })); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, [string, string]> = {
      pending:   ["🟡 En attente", "#f59e0b"],
      accepted:  ["🟢 Acceptée",   "#34d399"],
      refused:   ["🔴 Refusée",    "#f87171"],
      confirmed: ["🟢 Confirmée",  "#34d399"],
      rejected:  ["🔴 Rejetée",    "#f87171"],
    };
    const [label, color] = map[s] || [s, "var(--muted-foreground)"];
    return <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>;
  };

  const pending   = tournoiRegs.filter(r => r.status === "pending");
  const reviewed  = tournoiRegs.filter(r => r.status !== "pending");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Config ──────────────────────────────────────────────────────── */}
      <Card emoji="⚙️" title="Configuration des inscriptions">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Titre du tournoi">
            <Input value={draft.tournamentTitle ?? ""} onChange={v => setDraft(d => ({ ...d, tournamentTitle: v }))} placeholder="Ex: SUPREMYX CUP #5" />
          </Field>
          <Field label="Places max">
            <Input value={String(draft.maxSlots ?? 16)} onChange={v => setDraft(d => ({ ...d, maxSlots: Number(v) }))} placeholder="16" type="number" />
          </Field>
          <Field label="Salon inscriptions">
            <Select value={draft.registrationChannelId ?? ""} onChange={v => setDraft(d => ({ ...d, registrationChannelId: v }))} placeholder="— Choisir —" options={channels} />
          </Field>
          <Field label="Salon waitlist">
            <Select value={draft.waitlistChannelId ?? ""} onChange={v => setDraft(d => ({ ...d, waitlistChannelId: v }))} placeholder="— Choisir —" options={channels} />
          </Field>
          <Field label="Rôle inscrit">
            <Select value={draft.roleId ?? ""} onChange={v => setDraft(d => ({ ...d, roleId: v }))} placeholder="— Choisir —" options={roles} />
          </Field>
          <Field label="Statut des inscriptions">
            <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="active" checked={draft.active !== false} onChange={() => setDraft(d => ({ ...d, active: true }))} />
                🟢 Ouvertes
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="active" checked={draft.active === false} onChange={() => setDraft(d => ({ ...d, active: false }))} />
                🔴 Fermées
              </label>
            </div>
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ActionBtn loading={!!loading.savecfg} onClick={() => act("savecfg", () => {
            const gId = cfg.guildId || guildInfo?.id || "global";
            return apiAction("/api/inscriptions/config", "PUT", { ...draft, guildId: gId }, apiKey);
          })} label="💾 Sauvegarder la config" />
          {cfg.active !== false
            ? <span style={{ fontSize: 12, color: "#34d399" }}>✅ Inscriptions actuellement <strong>ouvertes</strong></span>
            : <span style={{ fontSize: 12, color: "#f87171" }}>🔴 Inscriptions actuellement <strong>fermées</strong></span>
          }
        </div>
      </Card>

      {/* ── Inscriptions en attente ─────────────────────────────────────── */}
      <Card emoji={`🟡 En attente (${pending.length})`} title="">
        {pending.length === 0
          ? <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>Aucune inscription en attente.</p>
          : pending.map(r => (
            <div key={r._id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, background: "var(--background)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>🏷️ {r.teamName}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
                    📋 {r.tournamentName} · Contact : {r.contact}
                  </p>
                  {r.players.length > 0 && (
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
                      👥 Joueurs : {r.players.join(", ")}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap", marginLeft: 12 }}>
                  {new Date(r.registeredAt).toLocaleDateString("fr-FR")}
                </span>
              </div>

              {/* Panneau refus contextuel */}
              {refuseId === r._id && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={refuseReason}
                    onChange={e => setRefuseReason(e.target.value)}
                    placeholder="Raison du refus (optionnel)"
                    style={{ flex: 1, padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--background)", color: "var(--foreground)", fontSize: 13 }}
                  />
                  <button
                    onClick={() => act(`refuse_${r._id}`, async () => {
                      await apiAction(`/api/inscriptions/tournoi/${r._id}`, "PATCH", { status: "refused", refuseReason }, apiKey);
                      setRefuseId(null); setRefuseReason("");
                    })}
                    style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#ed4245", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
                  >Confirmer le refus</button>
                  <button onClick={() => setRefuseId(null)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--foreground)", fontSize: 13, cursor: "pointer" }}>✕</button>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => act(`accept_${r._id}`, () => apiAction(`/api/inscriptions/tournoi/${r._id}`, "PATCH", { status: "accepted" }, apiKey))}
                  disabled={!!loading[`accept_${r._id}`]}
                  style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#34d399", color: "#000", fontSize: 13, cursor: "pointer", fontWeight: 600, opacity: loading[`accept_${r._id}`] ? 0.6 : 1 }}
                >✅ Accepter</button>
                <button
                  onClick={() => { setRefuseId(r._id); setRefuseReason(""); }}
                  style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#f87171", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
                >❌ Refuser</button>
                <button
                  onClick={() => act(`del_${r._id}`, () => apiAction(`/api/inscriptions/tournoi/${r._id}`, "DELETE", undefined, apiKey))}
                  disabled={!!loading[`del_${r._id}`]}
                  style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--muted-foreground)", fontSize: 13, cursor: "pointer" }}
                >🗑️ Supprimer</button>
              </div>
            </div>
          ))
        }
      </Card>

      {/* ── Historique traitées ─────────────────────────────────────────── */}
      {reviewed.length > 0 && (
        <Card emoji="📋" title={`Historique (${reviewed.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
            {reviewed.map(r => (
              <div key={r._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 6, background: "var(--muted)", fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{r.teamName}</span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.tournamentName}</span>
                <span>{statusBadge(r.status)}</span>
                {r.refuseReason && <span style={{ fontSize: 11, color: "var(--muted-foreground)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💬 {r.refuseReason}</span>}
                <button
                  onClick={() => act(`del_${r._id}`, () => apiAction(`/api/inscriptions/tournoi/${r._id}`, "DELETE", undefined, apiKey))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: 14 }}>🗑️</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Waitlist ─────────────────────────────────────────────────────── */}
      {waitlist.length > 0 && (
        <Card emoji={`📋 Waitlist (${waitlist.length})`} title="">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
            {waitlist.map(r => (
              <div key={r._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "var(--background)", border: "1px solid var(--border)", fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 700 }}>#{r.position} {r.teamName}</span>
                  {r.vip && <span style={{ marginLeft: 6, fontSize: 11, background: "rgba(212,150,58,0.2)", color: "#d4963a", padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>VIP</span>}
                  <span style={{ marginLeft: 8, color: "var(--muted-foreground)" }}>{r.captainTag}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {statusBadge(r.status)}
                  <button
                    onClick={() => act(`wok_${r._id}`, () => apiAction(`/api/inscriptions/waitlist/${r._id}`, "PATCH", { status: "confirmed" }, apiKey))}
                    disabled={r.status === "confirmed"}
                    style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: "#34d399", color: "#000", fontSize: 12, cursor: r.status === "confirmed" ? "default" : "pointer", fontWeight: 600, opacity: r.status === "confirmed" ? 0.5 : 1 }}
                  >✅ Confirmer</button>
                  <button
                    onClick={() => act(`wdel_${r._id}`, () => apiAction(`/api/inscriptions/waitlist/${r._id}`, "DELETE", undefined, apiKey))}
                    style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "#f87171", fontSize: 12, cursor: "pointer" }}
                  >🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(LS_KEY) ?? "");
  const [activeTab, setActiveTab] = useState("tournois");
  const [guildInfo, setGuildInfo] = useState<GuildInfo | null>(null);
  const [guildLoading, setGuildLoading] = useState(false);

  // ── Cache pour la recherche globale & stats ──────────────────────────────
  const [cachedTeams, setCachedTeams]           = useState<{ name: string; points: number; kills: number; wins: number; losses: number; rank: number }[]>([]);
  const [cachedPlayers, setCachedPlayers]       = useState<{ displayName: string; teamName: string; totalKills: number; totalMatches: number }[]>([]);
  const [cachedBlacklist, setCachedBlacklist]   = useState<{ target: string; reason: string }[]>([]);
  const [pendingInscriptions, setPendingInscriptions] = useState(0);
  const [recentWarnings, setRecentWarnings]           = useState(0);

  const loadCache = useCallback(async (key: string) => {
    if (!key) return;
    try {
      const r = await apiAction("/api/ranking", "GET", undefined, key);
      setCachedTeams((r.ranking || []).map((t: { team: string; points: number; kills: number; wins: number; losses: number; rank: number }) => ({
        name: t.team, points: t.points, kills: t.kills, wins: t.wins ?? 0, losses: t.losses ?? 0, rank: t.rank,
      })));
    } catch {}
    try {
      const p = await apiAction("/api/players?limit=100", "GET", undefined, key);
      setCachedPlayers(p.players || []);
    } catch {}
    try {
      const b = await apiAction("/api/blacklist", "GET", undefined, key);
      setCachedBlacklist(b.blacklist || []);
    } catch {}
    try {
      const i = await apiAction("/api/inscriptions", "GET", undefined, key);
      setPendingInscriptions((i.tournoi || []).filter((r: { status: string }) => r.status === "pending").length);
    } catch {}
    try {
      const w = await apiAction("/api/warnings?limit=50", "GET", undefined, key);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const recent = (w.warnings || []).filter((x: { createdAt: string }) => new Date(x.createdAt).getTime() > cutoff).length;
      setRecentWarnings(recent);
    } catch {}
  }, []);

  const loadGuild = useCallback(async (key: string) => {
    if (!key) return;
    setGuildLoading(true);
    try {
      const data = await apiAction("/api/actions/guild/info", "GET", undefined, key);
      setGuildInfo(data);
    } catch {}
    finally { setGuildLoading(false); }
  }, []);

  useEffect(() => { loadGuild(apiKey); loadCache(apiKey); }, [apiKey, loadGuild, loadCache]);

  const handleKeyChange = (v: string) => {
    setApiKey(v);
    localStorage.setItem(LS_KEY, v);
  };

  const tabContent: Record<string, React.ReactNode> = {
    tournois:     <TournoisTab apiKey={apiKey} guildInfo={guildInfo} />,
    matchs:       <MatchsTab apiKey={apiKey} />,
    equipes:      <EquipesTab apiKey={apiKey} />,
    roster:       <RosterTab apiKey={apiKey} guildInfo={guildInfo} />,
    xp:           <XpTab apiKey={apiKey} guildInfo={guildInfo} />,
    comms:        <CommsTab apiKey={apiKey} guildInfo={guildInfo} />,
    embed:        <EmbedTab apiKey={apiKey} guildInfo={guildInfo} />,
    moderation:   <ModerationTab apiKey={apiKey} guildInfo={guildInfo} />,
    inscriptions: <InscriptionsTab apiKey={apiKey} guildInfo={guildInfo} />,
    config:       <ConfigTab apiKey={apiKey} guildInfo={guildInfo} />,
    notes:        <NotesTab apiKey={apiKey} />,
    blacklist:    <BlacklistTab apiKey={apiKey} />,
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>
          🎛️ Centre de Commandes
        </h1>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted-foreground)" }}>
          Exécutez toutes les actions du bot directement depuis le dashboard — sans passer par Discord.
        </p>

        {/* API key input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)", maxWidth: 500 }}>
          <span style={{ fontSize: 13, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>🔑 Clé API :</span>
          <input
            type="password"
            value={apiKey}
            onChange={e => handleKeyChange(e.target.value)}
            placeholder="Entrez votre clé API BOT_API_KEY…"
            style={{ flex: 1, border: "none", background: "transparent", color: "var(--foreground)", fontSize: 13, outline: "none" }}
          />
          {guildInfo && <span style={{ fontSize: 12, color: "#34d399", whiteSpace: "nowrap" }}>✓ {guildInfo.name}</span>}
          {guildLoading && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>⏳</span>}
        </div>
      </div>

      {/* Stats globales */}
      {apiKey && (
        <StatsBar
          teams={cachedTeams}
          players={cachedPlayers}
          blacklist={cachedBlacklist}
          pendingInscriptions={pendingInscriptions}
        />
      )}

      {/* Recherche globale */}
      {apiKey && (
        <GlobalSearch
          apiKey={apiKey}
          teams={cachedTeams}
          players={cachedPlayers}
          blacklist={cachedBlacklist}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      )}

      {/* Tab bar */}
      {(() => {
        const tabBadges: Record<string, number> = {
          inscriptions: pendingInscriptions,
          moderation:   recentWarnings,
        };
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "1.25rem" }}>
            {TABS.map(tab => {
              const badge  = tabBadges[tab.id] ?? 0;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`tab-${tab.id}`}
                  style={{
                    position: "relative",
                    padding: "6px 14px", borderRadius: 20, border: "1px solid var(--border)",
                    cursor: "pointer", fontSize: 13, fontWeight: 500,
                    background: active ? "#5865f2" : "var(--card)",
                    color: active ? "#fff" : "var(--foreground)",
                    transition: "all 0.15s",
                  }}
                >
                  {tab.emoji} {tab.label}
                  {badge > 0 && !active && (
                    <span style={{
                      position: "absolute", top: -5, right: -5,
                      minWidth: 18, height: 18, padding: "0 4px",
                      background: tab.id === "moderation" ? "#f87171" : "#f59e0b",
                      color: "#000",
                      fontSize: 10, fontWeight: 800,
                      borderRadius: 999,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 0 0 2px var(--background)",
                      lineHeight: 1,
                    }}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Tab content */}
      <div>
        {tabContent[activeTab]}
      </div>
    </div>
  );
}
