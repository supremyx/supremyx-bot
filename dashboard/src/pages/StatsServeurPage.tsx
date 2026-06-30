import { useState, useEffect } from "react";
import { apiUrl } from "../lib/api";

interface ServerStats {
  totalMatches: number;
  totalTeams: number;
  totalPlayers: number;
  totalTournois: number;
  totalKills: number;
  totalPoints: number;
  avgKills: string;
  avgPoints: string;
  recordMatch: { team: string; kills: number } | null;
  mostActive: string;
  topKiller: string;
  topWinner: string;
  totalWarnings: number;
}

function StatCard({ icon, value, label, color = "var(--primary)" }: { icon: string; value: string | number; label: string; color?: string }) {
  return (
    <div className="rounded-xl p-5 text-center flex flex-col items-center gap-2"
      style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
      <span className="text-3xl">{icon}</span>
      <span className="text-2xl font-bold" style={{ color }}>{typeof value === "number" ? value.toLocaleString("fr-FR") : value}</span>
      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
    </div>
  );
}

export default function StatsServeurPage() {
  const [stats, setStats]     = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/statsserveur"))
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => { setError("Impossible de charger les statistiques"); setLoading(false); });
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">📊 Statistiques du Serveur</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Données en temps réel · Toutes périodes confondues
        </p>
      </div>

      {loading && (
        <div className="py-16 text-center">
          <div className="animate-pulse text-4xl mb-3">📊</div>
          <p style={{ color: "var(--muted-foreground)" }}>Chargement des statistiques…</p>
        </div>
      )}

      {error && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      )}

      {!loading && !error && stats && (
        <div className="space-y-6">
          {/* Main stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon="🏟️" value={stats.totalMatches} label="Matchs enregistrés" />
            <StatCard icon="💀" value={stats.totalKills} label="Kills totaux" color="#f87171" />
            <StatCard icon="⭐" value={stats.totalPoints} label="Points distribués" color="#fbbf24" />
            <StatCard icon="🎮" value={stats.totalTeams} label="Équipes" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon="👤" value={stats.totalPlayers} label="Joueurs enregistrés" />
            <StatCard icon="🏆" value={stats.totalTournois} label="Tournois" color="#34d399" />
            <StatCard icon="📈" value={stats.avgKills} label="Kills moyens / match" />
            <StatCard icon="⚠️" value={stats.totalWarnings} label="Avertissements" color="#f59e0b" />
          </div>

          {/* Records & highlights */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-bold">🏅 Records & Highlights</h2>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {[
                { icon: "🔥", label: "Record kills en 1 match", value: stats.recordMatch ? `${stats.recordMatch.kills} kills — ${stats.recordMatch.team}` : "—" },
                { icon: "🏃", label: "Équipe la plus active", value: stats.mostActive || "—" },
                { icon: "💀", label: "Équipe top kills totaux", value: stats.topKiller || "—" },
                { icon: "🥇", label: "Équipe la plus victorieuse", value: stats.topWinner || "—" },
                { icon: "📊", label: "Points moyens / match", value: stats.avgPoints },
              ].map(({ icon, label, value }) => (
                <div key={label} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{label}</span>
                  </div>
                  <span className="font-semibold text-sm">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary bar */}
          <div className="rounded-xl p-5" style={{ background: "var(--primary)10", border: "1px solid var(--primary)33" }}>
            <p className="text-sm text-center" style={{ color: "var(--primary)" }}>
              <strong>{stats.totalMatches.toLocaleString("fr-FR")}</strong> matchs joués ·{" "}
              <strong>{stats.totalKills.toLocaleString("fr-FR")}</strong> kills ·{" "}
              <strong>{stats.totalTeams}</strong> équipes ·{" "}
              <strong>{stats.totalPlayers.toLocaleString("fr-FR")}</strong> joueurs enregistrés
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
