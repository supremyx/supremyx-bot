import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TournoiReg {
  _id: string;
  guildId: string;
  tournamentName: string;
  teamName: string;
  players: string[];
  contact: string;
  status: "pending" | "accepted" | "refused";
  refuseReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  registeredAt: string;
}

interface WaitlistReg {
  _id: string;
  guildId: string;
  teamName: string;
  tag: string;
  captainId: string;
  captainTag: string;
  position: number;
  status: "pending" | "confirmed" | "rejected";
  vip: boolean;
  registeredBy: string;
  createdAt: string;
}

interface InscriptionConfig {
  guildId: string;
  maxSlots: number;
  tournamentTitle: string;
  active: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
    pending:   { label: "En attente", bg: "rgba(250,204,21,0.12)", color: "#fbbf24", border: "rgba(250,204,21,0.3)" },
    accepted:  { label: "Acceptée",   bg: "rgba(34,197,94,0.12)",  color: "#4ade80", border: "rgba(34,197,94,0.3)"  },
    confirmed: { label: "Confirmée",  bg: "rgba(34,197,94,0.12)",  color: "#4ade80", border: "rgba(34,197,94,0.3)"  },
    refused:   { label: "Refusée",    bg: "rgba(239,68,68,0.12)",  color: "#f87171", border: "rgba(239,68,68,0.3)"  },
    rejected:  { label: "Rejetée",    bg: "rgba(239,68,68,0.12)",  color: "#f87171", border: "rgba(239,68,68,0.3)"  },
  };
  const s = map[status] ?? { label: status, bg: "rgba(100,116,139,0.15)", color: "#94a3b8", border: "rgba(100,116,139,0.3)" };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function InscriptionsPage() {
  const [tab, setTab]               = useState<"tournoi" | "waitlist" | "config">("tournoi");
  const [tournoi, setTournoi]       = useState<TournoiReg[]>([]);
  const [waitlist, setWaitlist]     = useState<WaitlistReg[]>([]);
  const [config, setConfig]         = useState<InscriptionConfig | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [actionId, setActionId]     = useState<string | null>(null);

  // Config form state
  const [cfgTitle, setCfgTitle]   = useState("");
  const [cfgSlots, setCfgSlots]   = useState(16);
  const [cfgActive, setCfgActive] = useState(true);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg, setCfgMsg]       = useState<string | null>(null);

  // Filter for tournoi tab
  const [filterT, setFilterT] = useState<"all" | "pending" | "accepted" | "refused">("all");
  // Filter for waitlist tab
  const [filterW, setFilterW] = useState<"all" | "pending" | "confirmed" | "rejected">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/inscriptions"));
      const data = await res.json();
      setTournoi(data.tournoi ?? []);
      setWaitlist(data.waitlist ?? []);
      if (data.config) {
        setConfig(data.config);
        setCfgTitle(data.config.tournamentTitle ?? "");
        setCfgSlots(data.config.maxSlots ?? 16);
        setCfgActive(data.config.active ?? true);
      }
    } catch {
      setError("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Tournoi actions ──────────────────────────────────────────────────────────
  async function updateTournoi(id: string, status: string, refuseReason?: string) {
    setActionId(id);
    try {
      await fetch(apiUrl(`/api/inscriptions/tournoi/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ status, refuseReason }),
      });
      await load();
    } finally {
      setActionId(null);
    }
  }

  async function deleteTournoi(id: string) {
    if (!confirm("Supprimer cette inscription ?")) return;
    setActionId(id);
    try {
      await fetch(apiUrl(`/api/inscriptions/tournoi/${id}`), {
        method: "DELETE",
        headers: { "x-api-key": API_KEY },
      });
      await load();
    } finally {
      setActionId(null);
    }
  }

  // ── Waitlist actions ─────────────────────────────────────────────────────────
  async function updateWaitlist(id: string, status: string) {
    setActionId(id);
    try {
      await fetch(apiUrl(`/api/inscriptions/waitlist/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setActionId(null);
    }
  }

  async function deleteWaitlist(id: string) {
    if (!confirm("Retirer cette équipe de la liste d'attente ?")) return;
    setActionId(id);
    try {
      await fetch(apiUrl(`/api/inscriptions/waitlist/${id}`), {
        method: "DELETE",
        headers: { "x-api-key": API_KEY },
      });
      await load();
    } finally {
      setActionId(null);
    }
  }

  // ── Config save ──────────────────────────────────────────────────────────────
  async function saveConfig() {
    if (!config?.guildId) { setCfgMsg("❌ Aucun serveur configuré."); return; }
    setCfgSaving(true);
    setCfgMsg(null);
    try {
      const res = await fetch(apiUrl("/api/inscriptions/config"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ guildId: config.guildId, maxSlots: cfgSlots, tournamentTitle: cfgTitle, active: cfgActive }),
      });
      if (res.ok) { setCfgMsg("✅ Configuration sauvegardée."); await load(); }
      else        { setCfgMsg("❌ Erreur lors de la sauvegarde."); }
    } finally {
      setCfgSaving(false);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const filteredTournoi  = tournoi.filter(r  => filterT === "all" || r.status === filterT);
  const filteredWaitlist = waitlist.filter(r => filterW === "all" || r.status === filterW);

  const tStats = {
    total:    tournoi.length,
    pending:  tournoi.filter(r => r.status === "pending").length,
    accepted: tournoi.filter(r => r.status === "accepted").length,
    refused:  tournoi.filter(r => r.status === "refused").length,
  };
  const wStats = {
    total:     waitlist.length,
    pending:   waitlist.filter(r => r.status === "pending").length,
    confirmed: waitlist.filter(r => r.status === "confirmed").length,
    rejected:  waitlist.filter(r => r.status === "rejected").length,
  };

  const btnBase: React.CSSProperties = {
    padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
    cursor: "pointer", border: "1px solid", transition: "opacity .15s",
  };

  if (loading) return <div className="py-24 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>;
  if (error)   return <div className="py-24 text-center text-red-400">{error}</div>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">

      {/* Header */}
      <h1 className="text-2xl font-bold mb-1">🎟️ Inscriptions</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
        Gestion des inscriptions au tournoi et de la liste d'attente
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Inscriptions tournoi", value: tStats.total,    color: "var(--primary)" },
          { label: "En attente",           value: tStats.pending,  color: "#fbbf24" },
          { label: "Acceptées",            value: tStats.accepted, color: "#4ade80" },
          { label: "Waitlist",             value: wStats.total,    color: "#c084fc" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="text-2xl font-bold" style={{ color }}>{value}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "tournoi",  label: "🏆 Inscriptions tournoi" },
          { key: "waitlist", label: "⏳ Liste d'attente" },
          { key: "config",   label: "⚙️ Configuration" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            data-testid={`tab-${key}`}
            onClick={() => setTab(key)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            style={{
              background: tab === key ? "var(--primary)" : "var(--muted)",
              color:      tab === key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Inscriptions Tournoi ── */}
      {tab === "tournoi" && (
        <div>
          {/* Sub-filters */}
          <div className="flex gap-2 mb-4">
            {([
              { key: "all",      label: "Toutes" },
              { key: "pending",  label: "En attente" },
              { key: "accepted", label: "Acceptées" },
              { key: "refused",  label: "Refusées" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                data-testid={`filter-tournoi-${key}`}
                onClick={() => setFilterT(key)}
                className="px-3 py-1 rounded-md text-xs font-medium cursor-pointer"
                style={{
                  background: filterT === key ? "var(--accent)" : "transparent",
                  color:      filterT === key ? "var(--accent-foreground)" : "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredTournoi.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
              Aucune inscription dans cette catégorie.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredTournoi.map(r => (
                <div
                  key={r._id}
                  data-testid={`card-tournoi-${r._id}`}
                  className="rounded-xl p-4"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-base truncate">{r.teamName}</span>
                        <StatusBadge status={r.status} />
                        {r.refuseReason && (
                          <span className="text-xs truncate" style={{ color: "#f87171" }}>
                            — {r.refuseReason}
                          </span>
                        )}
                      </div>
                      <div className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                        🏆 {r.tournamentName} · 📡 {r.contact} · 🕐 {fmtDate(r.registeredAt)}
                      </div>
                      {r.players.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.players.map((p, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-xs"
                              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      {r.status !== "accepted" && (
                        <button
                          data-testid={`btn-accept-tournoi-${r._id}`}
                          disabled={actionId === r._id}
                          onClick={() => updateTournoi(r._id, "accepted")}
                          style={{ ...btnBase, background: "rgba(34,197,94,0.15)", color: "#4ade80", borderColor: "rgba(34,197,94,0.3)" }}
                        >
                          ✅ Accepter
                        </button>
                      )}
                      {r.status !== "refused" && (
                        <button
                          data-testid={`btn-refuse-tournoi-${r._id}`}
                          disabled={actionId === r._id}
                          onClick={() => {
                            const reason = prompt("Raison du refus (optionnel) :");
                            updateTournoi(r._id, "refused", reason ?? "");
                          }}
                          style={{ ...btnBase, background: "rgba(239,68,68,0.15)", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}
                        >
                          ❌ Refuser
                        </button>
                      )}
                      <button
                        data-testid={`btn-delete-tournoi-${r._id}`}
                        disabled={actionId === r._id}
                        onClick={() => deleteTournoi(r._id)}
                        style={{ ...btnBase, background: "rgba(100,116,139,0.15)", color: "#94a3b8", borderColor: "rgba(100,116,139,0.3)" }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Waitlist ── */}
      {tab === "waitlist" && (
        <div>
          {/* Progress bar */}
          {config && (
            <div className="mb-4 rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold">Places confirmées</span>
                <span style={{ color: "var(--muted-foreground)" }}>
                  {wStats.confirmed} / {config.maxSlots}
                </span>
              </div>
              <div className="w-full rounded-full h-2" style={{ background: "var(--muted)" }}>
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (wStats.confirmed / config.maxSlots) * 100)}%`,
                    background: wStats.confirmed >= config.maxSlots ? "#f87171" : "var(--primary)",
                  }}
                />
              </div>
              <div className="text-xs mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                {config.tournamentTitle} · Inscriptions {config.active ? "ouvertes ✅" : "fermées ❌"}
              </div>
            </div>
          )}

          {/* Sub-filters */}
          <div className="flex gap-2 mb-4">
            {([
              { key: "all",       label: "Toutes" },
              { key: "pending",   label: "En attente" },
              { key: "confirmed", label: "Confirmées" },
              { key: "rejected",  label: "Rejetées" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                data-testid={`filter-waitlist-${key}`}
                onClick={() => setFilterW(key)}
                className="px-3 py-1 rounded-md text-xs font-medium cursor-pointer"
                style={{
                  background: filterW === key ? "var(--accent)" : "transparent",
                  color:      filterW === key ? "var(--accent-foreground)" : "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredWaitlist.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
              Aucune équipe dans cette catégorie.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredWaitlist.map(r => (
                <div
                  key={r._id}
                  data-testid={`card-waitlist-${r._id}`}
                  className="rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      className="text-lg font-bold w-8 text-center flex-shrink-0"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      #{r.position}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold truncate">{r.teamName}</span>
                        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{r.tag}</span>
                        <StatusBadge status={r.status} />
                        {r.vip && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc" }}>
                            VIP
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        Capitaine : {r.captainTag || r.captainId} · {fmtDate(r.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {r.status !== "confirmed" && (
                      <button
                        data-testid={`btn-confirm-waitlist-${r._id}`}
                        disabled={actionId === r._id}
                        onClick={() => updateWaitlist(r._id, "confirmed")}
                        style={{ ...btnBase, background: "rgba(34,197,94,0.15)", color: "#4ade80", borderColor: "rgba(34,197,94,0.3)" }}
                      >
                        ✅ Confirmer
                      </button>
                    )}
                    {r.status !== "rejected" && (
                      <button
                        data-testid={`btn-reject-waitlist-${r._id}`}
                        disabled={actionId === r._id}
                        onClick={() => updateWaitlist(r._id, "rejected")}
                        style={{ ...btnBase, background: "rgba(239,68,68,0.15)", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}
                      >
                        ❌ Rejeter
                      </button>
                    )}
                    <button
                      data-testid={`btn-delete-waitlist-${r._id}`}
                      disabled={actionId === r._id}
                      onClick={() => deleteWaitlist(r._id)}
                      style={{ ...btnBase, background: "rgba(100,116,139,0.15)", color: "#94a3b8", borderColor: "rgba(100,116,139,0.3)" }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Configuration ── */}
      {tab === "config" && (
        <div className="max-w-lg">
          <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <h2 className="text-base font-bold mb-5">⚙️ Paramètres du système d'inscription</h2>

            {!config?.guildId ? (
              <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Aucune configuration trouvée. Utilisez <code>!inscription ouvrir</code> via Discord pour initialiser.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Titre du tournoi</label>
                  <input
                    data-testid="input-tournament-title"
                    type="text"
                    value={cfgTitle}
                    onChange={e => setCfgTitle(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "var(--input)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    placeholder="Ex : SUPREMYX Open #3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Places maximum</label>
                  <input
                    data-testid="input-max-slots"
                    type="number"
                    min={1}
                    max={256}
                    value={cfgSlots}
                    onChange={e => setCfgSlots(Number(e.target.value))}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "var(--input)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    data-testid="toggle-active"
                    onClick={() => setCfgActive(v => !v)}
                    className="w-12 h-6 rounded-full transition-colors relative flex-shrink-0"
                    style={{ background: cfgActive ? "var(--primary)" : "var(--muted)", border: "1px solid var(--border)" }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                      style={{ background: "#fff", left: cfgActive ? "calc(100% - 22px)" : "2px" }}
                    />
                  </button>
                  <span className="text-sm">
                    Inscriptions {cfgActive ? <strong style={{ color: "#4ade80" }}>ouvertes</strong> : <strong style={{ color: "#f87171" }}>fermées</strong>}
                  </span>
                </div>

                {cfgMsg && (
                  <p className="text-sm" style={{ color: cfgMsg.startsWith("✅") ? "#4ade80" : "#f87171" }}>
                    {cfgMsg}
                  </p>
                )}

                <button
                  data-testid="btn-save-config"
                  onClick={saveConfig}
                  disabled={cfgSaving}
                  className="w-full rounded-lg py-2 text-sm font-bold cursor-pointer transition-opacity"
                  style={{
                    background: "var(--primary)", color: "var(--primary-foreground)",
                    opacity: cfgSaving ? 0.6 : 1,
                  }}
                >
                  {cfgSaving ? "Sauvegarde…" : "💾 Sauvegarder"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
