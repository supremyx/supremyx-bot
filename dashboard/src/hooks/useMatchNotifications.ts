import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiUrl } from "../lib/api";

interface MatchEntry {
  id: string;
  team: string;
  placement: number;
  kills: number;
  points: number;
  tournamentName: string;
  date: string;
}

const POLL_INTERVAL = 30_000;
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function useMatchNotifications() {
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(apiUrl("/api/results"));
        if (!res.ok) return;
        const data = await res.json();
        const matches: MatchEntry[] = data.recentMatchEntries ?? [];

        if (!initialized.current) {
          // First load — just store current IDs, don't notify
          for (const m of matches) seenIds.current.add(m.id);
          initialized.current = true;
          return;
        }

        const newMatches = matches.filter(m => !seenIds.current.has(m.id));

        if (newMatches.length > 1) {
          // Multiple new matches at once — show a summary
          toast("🎮 Nouveaux matchs enregistrés", {
            description: `${newMatches.length} nouveaux résultats viennent d'être ajoutés.`,
            duration: 6000,
          });
          for (const m of newMatches) seenIds.current.add(m.id);
        } else if (newMatches.length === 1) {
          const m = newMatches[0];
          const placement = m.placement > 0
            ? (MEDAL[m.placement] ?? `#${m.placement}`)
            : null;
          toast(`🎮 Nouveau match — ${m.team}`, {
            description: [
              placement && `Place : ${placement}`,
              `+${m.points} pts · ${m.kills} kills`,
              m.tournamentName && `Tournoi : ${m.tournamentName}`,
            ].filter(Boolean).join("  ·  "),
            duration: 7000,
          });
          seenIds.current.add(m.id);
        }
      } catch {
        // silently ignore network errors
      }
    }

    // Initial check
    check();

    const id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);
}
