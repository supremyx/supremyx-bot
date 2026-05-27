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
  new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const ROLE_COLOR: Record<string, string> = {
  captain:   "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  leader:    "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  coach:     "text-blue-400 bg-blue-400/10 border-blue-400/20",
  manager:   "text-purple-400 bg-purple-400/10 border-purple-400/20",
  substitute:"text-gray-400 bg-white/5 border-white/10",
  sub:       "text-gray-400 bg-white/5 border-white/10",
  member:    "text-indigo-300 bg-indigo-400/10 border-indigo-400/20",
  player:    "text-indigo-300 bg-indigo-400/10 border-indigo-400/20",
};

function roleStyle(role: string) {
  const key = role.toLowerCase();
  return ROLE_COLOR[key] ?? "text-gray-300 bg-white/5 border-white/10";
}

function TeamCard({ roster }: { roster: Roster }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-black text-indigo-300 text-sm select-none">
            {roster.teamName.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-bold text-white">{roster.teamName}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {roster.members.length} membre{roster.members.length !== 1 ? "s" : ""} · Mis à jour le {fmtDate(roster.updatedAt)}
            </p>
          </div>
        </div>
        <span className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-white/10">
          {roster.members.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-6">Aucun membre dans cette équipe.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                  <th className="py-2 px-5 text-left">Joueur</th>
                  <th className="py-2 px-5 text-left">Rôle</th>
                  <th className="py-2 px-5 text-left hidden sm:table-cell">Depuis</th>
                  <th className="py-2 px-5 text-left hidden md:table-cell">Note</th>
                </tr>
              </thead>
              <tbody>
                {roster.members.map((m, i) => (
                  <tr
                    key={m.userId + i}
                    className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                  >
                    <td className="py-2.5 px-5 font-semibold text-white">{m.displayName}</td>
                    <td className="py-2.5 px-5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${roleStyle(m.role)}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-5 text-gray-400 text-xs hidden sm:table-cell">
                      {m.joinedAt ? fmtDate(m.joinedAt) : "—"}
                    </td>
                    <td className="py-2.5 px-5 text-gray-500 text-xs hidden md:table-cell">
                      {m.note || "—"}
                    </td>
                  </tr>
                ))}
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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Summary cards */}
      {rosters.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Équipes",  value: rosters.length, color: "text-indigo-400" },
            { label: "Membres",  value: totalMembers,   color: "text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10 text-center">
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Header + search */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-white">🛡️ Rosters des équipes</h2>
          <p className="text-xs text-gray-500 mt-0.5">Cliquer sur une équipe pour voir ses membres</p>
        </div>
        {rosters.length > 0 && (
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-36"
          />
        )}
      </div>

      {loading && (
        <div className="py-20 text-center text-gray-400 animate-pulse">Chargement…</div>
      )}
      {error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      )}
      {!loading && !error && rosters.length === 0 && (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 py-16 text-center text-gray-500">
          <div className="text-3xl mb-2">🛡️</div>
          <p className="text-sm">Aucun roster enregistré pour le moment.</p>
        </div>
      )}
      {!loading && !error && rosters.length > 0 && filtered.length === 0 && (
        <div className="bg-[#1a1a2e] rounded-2xl border border-white/10 py-10 text-center text-gray-500 text-sm">
          Aucun résultat pour « {search} »
        </div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(r => (
            <TeamCard key={r.teamName} roster={r} />
          ))}
        </div>
      )}
    </div>
  );
}
