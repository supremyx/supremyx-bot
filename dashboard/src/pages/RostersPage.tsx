import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Member {
  displayName: string;
  role: string;
  userId: string;
  note?: string;
  joinedAt: string;
}

interface Roster {
  teamName: string;
  members: Member[];
  updatedAt: string;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  captain:    { bg: "rgba(234,179,8,0.15)",   text: "#fde047", border: "rgba(234,179,8,0.3)"   },
  leader:     { bg: "rgba(234,179,8,0.15)",   text: "#fde047", border: "rgba(234,179,8,0.3)"   },
  coach:      { bg: "rgba(59,130,246,0.15)",  text: "#93c5fd", border: "rgba(59,130,246,0.3)"  },
  manager:    { bg: "rgba(168,85,247,0.15)",  text: "#d8b4fe", border: "rgba(168,85,247,0.3)"  },
  substitute: { bg: "rgba(255,255,255,0.05)", text: "#9ca3af", border: "rgba(255,255,255,0.1)" },
  sub:        { bg: "rgba(255,255,255,0.05)", text: "#9ca3af", border: "rgba(255,255,255,0.1)" },
  member:     { bg: "rgba(212,150,58,0.15)",  text: "var(--primary)", border: "rgba(212,150,58,0.3)" },
  player:     { bg: "rgba(212,150,58,0.15)",  text: "var(--primary)", border: "rgba(212,150,58,0.3)" },
};
const DEFAULT_ROLE = { bg: "rgba(255,255,255,0.05)", text: "#9ca3af", border: "rgba(255,255,255,0.1)" };

function roleStyle(role: string) {
  return ROLE_COLORS[role.toLowerCase()] ?? DEFAULT_ROLE;
}

function TeamCard({ roster }: { roster: Roster }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between transition-colors cursor-pointer"
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full flex items-center justify-center font-black text-sm select-none" style={{ background: "rgba(212,150,58,0.15)", border: "1px solid rgba(212,150,58,0.3)", color: "var(--primary)" }}>
            {roster.teamName.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-bold text-sm">{roster.teamName}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {roster.members.length} membre{roster.members.length !== 1 ? "s" : ""} · Mis à jour le {fmtDate(roster.updatedAt)}
            </p>
          </div>
        </div>
        <span className="transition-transform duration-200" style={{ color: "var(--muted-foreground)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {roster.members.length === 0 ? (
            <p className="text-center text-sm py-6" style={{ color: "var(--muted-foreground)" }}>Aucun membre dans cette équipe.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                  <th className="py-2 px-5 text-left">Joueur</th>
                  <th className="py-2 px-5 text-left">Rôle</th>
                  <th className="py-2 px-5 text-left hidden sm:table-cell">Depuis</th>
                  <th className="py-2 px-5 text-left hidden md:table-cell">Note</th>
                </tr>
              </thead>
              <tbody>
                {roster.members.map((m, i) => {
                  const rc = roleStyle(m.role);
                  return (
                    <tr key={m.userId + i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                      <td className="py-2.5 px-5 font-semibold text-sm">{m.displayName}</td>
                      <td className="py-2.5 px-5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}>
                          {m.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-5 text-xs hidden sm:table-cell" style={{ color: "var(--muted-foreground)" }}>{m.joinedAt ? fmtDate(m.joinedAt) : "—"}</td>
                      <td className="py-2.5 px-5 text-xs hidden md:table-cell" style={{ color: "var(--muted-foreground)" }}>{m.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function RostersPage() {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/rosters"))
      .then(r => r.json())
      .then(d => { setRosters(d.rosters ?? []); setLoading(false); })
      .catch(() => { setError("Impossible de charger les données."); setLoading(false); });
  }, []);

  const filtered = rosters.filter(r =>
    r.teamName.toLowerCase().includes(search.toLowerCase()) ||
    r.members.some(m => m.displayName.toLowerCase().includes(search.toLowerCase()))
  );

  const totalMembers = rosters.reduce((s, r) => s + r.members.length, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {rosters.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Équipes",  value: rosters.length, color: "var(--primary)" },
            { label: "Membres",  value: totalMembers,   color: "#34d399" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="text-2xl font-black" style={{ color }}>{value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-sm">Rosters des équipes</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Cliquer sur une équipe pour voir ses membres</p>
        </div>
        {rosters.length > 0 && (
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-xs focus:outline-none w-36"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
        )}
      </div>

      {loading && <div className="py-20 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>}
      {error && <div className="py-16 text-center"><div className="text-4xl mb-3">⚠️</div><p className="text-red-400 font-semibold">{error}</p></div>}
      {!loading && !error && rosters.length === 0 && (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">🛡️</div>
          <p className="text-sm">Aucun roster enregistré pour le moment.</p>
        </div>
      )}
      {!loading && !error && rosters.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl py-10 text-center text-sm" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          Aucun résultat pour « {search} »
        </div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(r => <TeamCard key={r.teamName} roster={r} />)}
        </div>
      )}
    </div>
  );
}
