import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Giveaway {
  _id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  host: string;
  endsAt: string;
  ended: boolean;
  winnerId?: string;
  winnerTag?: string;
  participants: number;
  createdAt: string;
}

type FilterTab = "all" | "active" | "ended";

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function timeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Terminé";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 24) return `${Math.floor(h / 24)}j ${h % 24}h`;
  return `${h}h ${m}min`;
}

export default function GiveawayPage() {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/giveaways"))
      .then(r => r.json())
      .then(d => { setGiveaways(d.giveaways ?? []); setLoading(false); })
      .catch(() => { setError("Impossible de charger les giveaways."); setLoading(false); });
  }, []);

  const filtered = giveaways.filter(g => {
    if (tab === "active" && g.ended) return false;
    if (tab === "ended" && !g.ended) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return g.prize.toLowerCase().includes(q) || g.host.toLowerCase().includes(q) || (g.winnerTag?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  const total = giveaways.length;
  const active = giveaways.filter(g => !g.ended).length;
  const ended = giveaways.filter(g => g.ended).length;
  const totalParticipants = giveaways.reduce((s, g) => s + (g.participants ?? 0), 0);

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: "all",    label: "🎁 Tous",     count: total },
    { key: "active", label: "🔥 Actifs",   count: active },
    { key: "ended",  label: "✅ Terminés", count: ended },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-bold text-lg">🎁 Giveaways</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Tirages au sort organisés sur le serveur
        </p>
      </div>

      {/* Stats cards */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total", value: total, color: "var(--primary)", icon: "🎁" },
            { label: "Actifs", value: active, color: "#34d399", icon: "🔥" },
            { label: "Terminés", value: ended, color: "var(--muted-foreground)", icon: "✅" },
            { label: "Participants", value: totalParticipants.toLocaleString("fr-FR"), color: "#fb923c", icon: "👥" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="text-lg mb-1">{s.icon}</div>
              <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(""); }}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            style={{
              background: tab === t.key ? "var(--primary)" : "var(--muted)",
              color: tab === t.key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: `1px solid ${tab === t.key ? "var(--primary)" : "var(--border)"}`,
            }}
          >
            {t.label}
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: "rgba(0,0,0,0.2)" }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Rechercher par lot, organisateur, gagnant…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : error ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          <div className="text-3xl mb-2">🎁</div>
          <p className="text-sm">Aucun giveaway trouvé.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(g => (
            <div
              key={g._id}
              className="rounded-xl p-5 relative overflow-hidden"
              style={{
                background: "var(--card)",
                border: `1px solid ${g.ended ? "var(--border)" : "rgba(212,150,58,0.35)"}`,
              }}
            >
              {/* Status badge */}
              <div className="absolute top-3 right-3">
                {g.ended ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "rgba(100,100,120,0.3)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                    Terminé
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                    ● Actif
                  </span>
                )}
              </div>

              {/* Prize */}
              <div className="flex items-start gap-3 mb-3 pr-16">
                <span className="text-2xl">🎁</span>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm leading-tight">{g.prize}</h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    Par <span className="font-semibold">{g.host}</span>
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <div className="flex items-center justify-between">
                  <span>👥 Participants</span>
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>{(g.participants ?? 0).toLocaleString("fr-FR")}</span>
                </div>
                {!g.ended && (
                  <div className="flex items-center justify-between">
                    <span>⏳ Fin dans</span>
                    <span className="font-bold" style={{ color: "var(--primary)" }}>{timeLeft(g.endsAt)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>{g.ended ? "Terminé le" : "Fin le"}</span>
                  <span>{fmtDateShort(g.endsAt)}</span>
                </div>
                {g.ended && g.winnerTag && (
                  <div className="flex items-center justify-between">
                    <span>🏆 Gagnant</span>
                    <span className="font-bold" style={{ color: "#facc15" }}>{g.winnerTag}</span>
                  </div>
                )}
                {g.ended && !g.winnerTag && (
                  <div className="flex items-center justify-between">
                    <span>🏆 Gagnant</span>
                    <span style={{ color: "var(--muted-foreground)" }}>—</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>📅 Créé le</span>
                  <span>{fmtDate(g.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
