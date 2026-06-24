import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Poule {
  _id: string;
  letter: string;
  teams: string[];
  tournamentId: string | null;
  createdAt: string;
}

interface PoulesData {
  poules: Poule[];
}

const LETTER_COLORS: Record<string, string> = {
  A: "#d4963a", B: "#3b82f6", C: "#22c55e", D: "#a855f7",
  E: "#ef4444", F: "#f59e0b", G: "#14b8a6", H: "#ec4899",
};

function getColor(letter: string) {
  return LETTER_COLORS[letter.toUpperCase()] ?? "#94a3b8";
}

export default function PoulesPage() {
  const [data, setData] = useState<PoulesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/poules"))
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const poules = data?.poules ?? [];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black" style={{ color: "var(--foreground)" }}>🏟️ Poules de tournoi</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>Groupes d'équipes pour les phases de poules</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-sm" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : poules.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--muted-foreground)" }}>
          <div className="text-4xl mb-3">🏟️</div>
          <p className="text-sm">Aucune poule configurée.</p>
          <p className="text-xs mt-1">Utilise <code className="text-xs px-1 rounded" style={{ background: "var(--muted)" }}>!poule creer &lt;Lettre&gt;: &lt;Équipes&gt;</code> sur Discord.</p>
        </div>
      ) : (
        <>
          <div className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
            {poules.length} groupe{poules.length > 1 ? "s" : ""} · {poules.reduce((s, p) => s + p.teams.length, 0)} équipes au total
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {poules.map(poule => {
              const color = getColor(poule.letter);
              return (
                <div key={poule._id} className="rounded-xl p-5 flex flex-col gap-3" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black" style={{ background: `${color}20`, color }}>
                      {poule.letter}
                    </div>
                    <div>
                      <div className="font-bold text-sm">Groupe {poule.letter}</div>
                      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{poule.teams.length} équipe{poule.teams.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {poule.teams.map((team, i) => (
                      <div key={team} className="flex items-center gap-2 text-sm">
                        <span className="text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0"
                          style={{ background: `${color}20`, color }}>
                          {i + 1}
                        </span>
                        <span className="font-medium">{team}</span>
                      </div>
                    ))}
                  </div>
                  {poule.tournamentId && (
                    <div className="text-xs pt-2 border-t" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                      🏆 Tournoi lié
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
