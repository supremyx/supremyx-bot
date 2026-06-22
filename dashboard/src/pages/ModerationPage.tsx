import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

interface Warning {
  _id: string;
  target: string;
  reason: string;
  warnedBy: string;
  createdAt: string;
}

interface Sanction {
  _id: string;
  userTag: string;
  type: "warn" | "mute" | "kick" | "ban";
  reason: string;
  duration: number | null;
  moderatorTag: string;
  autoEscalation: boolean;
  active: boolean;
  createdAt: string;
}

interface Blacklisted {
  _id: string;
  target: string;
  reason: string;
  addedBy: string;
  createdAt: string;
}

type Tab = "warns" | "sanctions" | "blacklist";

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TYPE_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  warn:  { bg: "rgba(250,204,21,0.15)", text: "#fde047", border: "rgba(250,204,21,0.3)", label: "⚠️ Avertissement" },
  mute:  { bg: "rgba(99,102,241,0.15)", text: "#a5b4fc", border: "rgba(99,102,241,0.3)", label: "🔇 Muet" },
  kick:  { bg: "rgba(249,115,22,0.15)", text: "#fdba74", border: "rgba(249,115,22,0.3)", label: "👢 Expulsion" },
  ban:   { bg: "rgba(239,68,68,0.15)",  text: "#fca5a5", border: "rgba(239,68,68,0.3)",  label: "🔨 Bannissement" },
};

export default function ModerationPage() {
  const [tab, setTab] = useState<Tab>("warns");
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [blacklist, setBlacklist] = useState<Blacklisted[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(apiUrl("/api/warnings")).then(r => r.json()),
      fetch(apiUrl("/api/sanctions")).then(r => r.json()),
      fetch(apiUrl("/api/blacklist")).then(r => r.json()),
    ]).then(([w, s, b]) => {
      setWarnings(w.warnings ?? []);
      setSanctions(s.sanctions ?? []);
      setBlacklist(b.blacklist ?? []);
      setLoading(false);
    }).catch(() => {
      setError("Impossible de charger les données de modération.");
      setLoading(false);
    });
  }, []);

  const q = search.trim().toLowerCase();

  const filteredWarns = warnings.filter(w =>
    !q || w.target.toLowerCase().includes(q) || w.reason.toLowerCase().includes(q) || w.warnedBy.toLowerCase().includes(q)
  );
  const filteredSanctions = sanctions.filter(s =>
    !q || s.userTag.toLowerCase().includes(q) || s.reason.toLowerCase().includes(q) || s.moderatorTag.toLowerCase().includes(q)
  );
  const filteredBlacklist = blacklist.filter(b =>
    !q || b.target.toLowerCase().includes(q) || b.reason.toLowerCase().includes(q)
  );

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "warns",     label: "⚠️ Avertissements", count: warnings.length },
    { key: "sanctions", label: "⚖️ Sanctions",       count: sanctions.length },
    { key: "blacklist", label: "🚫 Liste noire",       count: blacklist.length },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h2 className="font-bold text-lg">🛡️ Modération</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Avertissements, sanctions et blacklist du serveur
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
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
      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
      </div>

      {loading ? (
        <div className="text-center py-16 animate-pulse" style={{ color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : error ? (
        <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : (
        <>
          {/* Warnings */}
          {tab === "warns" && (
            filteredWarns.length === 0 ? (
              <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm">Aucun avertissement.</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                {filteredWarns.map((w, i) => (
                  <div key={w._id} className="px-5 py-3 flex items-start gap-3" style={{ borderBottom: i < filteredWarns.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span className="text-lg mt-0.5">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{w.target}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(250,204,21,0.15)", color: "#fde047", border: "1px solid rgba(250,204,21,0.3)" }}>
                          averti par {w.warnedBy}
                        </span>
                      </div>
                      <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>{w.reason}</p>
                      <p className="text-[11px] mt-1" style={{ color: "oklch(0.45 0 0)" }}>{fmtDate(w.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Sanctions */}
          {tab === "sanctions" && (
            filteredSanctions.length === 0 ? (
              <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm">Aucune sanction.</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                {filteredSanctions.map((s, i) => {
                  const style = TYPE_STYLE[s.type] ?? TYPE_STYLE.warn;
                  return (
                    <div key={s._id} className="px-5 py-3 flex items-start gap-3" style={{ borderBottom: i < filteredSanctions.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <span className="mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                        {style.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{s.userTag}</span>
                          {s.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}>En cours</span>}
                          {s.autoEscalation && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>Auto-escalade</span>}
                          {s.duration && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.duration} min</span>}
                        </div>
                        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>{s.reason}</p>
                        <p className="text-[11px] mt-1" style={{ color: "oklch(0.45 0 0)" }}>
                          Par {s.moderatorTag} · {fmtDate(s.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Blacklist */}
          {tab === "blacklist" && (
            filteredBlacklist.length === 0 ? (
              <div className="rounded-xl py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm">Liste noire vide.</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                {filteredBlacklist.map((b, i) => (
                  <div key={b._id} className="px-5 py-3 flex items-start gap-3" style={{ borderBottom: i < filteredBlacklist.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span className="text-lg mt-0.5">🚫</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-red-400">{b.target}</span>
                      <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>{b.reason}</p>
                      <p className="text-[11px] mt-1" style={{ color: "oklch(0.45 0 0)" }}>
                        Ajouté par {b.addedBy} · {fmtDate(b.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
