import { useEffect, useState, useCallback, useRef } from "react";
import { apiUrl } from "../lib/api";

interface AutopushStatus {
  lastAttempt: string;
  lastSuccess: boolean;
  commitsPushed: number;
  lastHash: string;
  lastMessage: string;
}

interface BotInstanceInfo {
  instanceId: string;
  pid: number;
  startedAt: string;
  heartbeat: string;
}

interface StatusData {
  status: string;
  bot: {
    online: boolean;
    tag: string | null;
    ping: number | null;
    guilds: number;
    uptimeSeconds: number;
  };
  mongo: {
    state: string;
    connected: boolean;
  };
  instances: BotInstanceInfo[];
  autopush: AutopushStatus | null;
  ts: string;
}

const REFRESH_INTERVAL = 15;

function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!d && !h) parts.push(`${s}s`);
  return parts.join(" ");
}

function fmtRelative(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return "à l'instant";
  if (diffSec < 60) return `il y a ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  return `il y a ${diffH}h`;
}

function StatusDot({ ok }: { ok: boolean | null }) {
  return (
    <span className="relative flex size-2.5">
      <span
        className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
          ok === null ? "" : ok ? "animate-ping bg-emerald-400" : "bg-red-400"
        }`}
      />
      <span
        className={`relative inline-flex size-2.5 rounded-full ${
          ok === null ? "bg-gray-500" : ok ? "bg-emerald-500" : "bg-red-500"
        }`}
      />
    </span>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-base">{icon}</span>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </span>
      <span
        className="text-sm font-semibold"
        style={{ color: valueColor ?? "var(--foreground)" }}
      >
        {value}
      </span>
    </div>
  );
}

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setCountdown(REFRESH_INTERVAL);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetch(apiUrl("/api/status"));
        if (!res.ok) throw new Error("bad status");
        const d = await res.json();
        setData(d);
        setLastRefresh(new Date());
        setError(null);
        startCountdown();
      } catch {
        setError("Impossible de charger le statut du bot.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [startCountdown],
  );

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), REFRESH_INTERVAL * 1000);
    return () => {
      clearInterval(id);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-lg">🩺 Statut du système</h2>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            Bot, base de données et auto-push GitHub · Rafraîchissement auto
            toutes les {REFRESH_INTERVAL}s
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {lastRefresh && (
            <span
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              {lastRefresh.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
          {!loading && !error && (
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(212,150,58,0.1)",
                color: "var(--primary)",
                border: "1px solid rgba(212,150,58,0.2)",
              }}
            >
              ⏱ {countdown}s
            </span>
          )}
          <button
            data-testid="button-refresh-status"
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            style={{
              background: "rgba(212,150,58,0.15)",
              color: "var(--primary)",
              border: "1px solid rgba(212,150,58,0.3)",
            }}
          >
            {refreshing ? "⏳" : "🔄"} Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div
          className="text-center py-16 animate-pulse"
          style={{ color: "var(--muted-foreground)" }}
        >
          Chargement…
        </div>
      ) : error ? (
        <div
          className="rounded-xl py-16 text-center"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      ) : data && (
        <>
          {/* Hero cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div
              data-testid="card-bot-status"
              className="flex flex-col items-center gap-2 rounded-xl p-4 text-center"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <StatusDot ok={data.bot.online} />
              <span
                className="text-sm font-bold"
                style={{ color: data.bot.online ? "#34d399" : "#f87171" }}
              >
                {data.bot.online ? "En ligne" : "Hors ligne"}
              </span>
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Bot Discord
              </span>
            </div>
            <div
              data-testid="card-mongo-status"
              className="flex flex-col items-center gap-2 rounded-xl p-4 text-center"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <StatusDot ok={data.mongo.connected} />
              <span
                className="text-sm font-bold"
                style={{ color: data.mongo.connected ? "#34d399" : "#f87171" }}
              >
                {data.mongo.state}
              </span>
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                MongoDB
              </span>
            </div>
            <div
              data-testid="card-uptime"
              className="flex flex-col items-center gap-2 rounded-xl p-4 text-center"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <span className="text-xl">⏳</span>
              <span className="text-sm font-bold" style={{ color: "#6366f1" }}>
                {fmtUptime(data.bot.uptimeSeconds)}
              </span>
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Uptime process
              </span>
            </div>
            <div
              data-testid="card-autopush"
              className="flex flex-col items-center gap-2 rounded-xl p-4 text-center"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <StatusDot ok={data.autopush ? data.autopush.lastSuccess : null} />
              <span
                className="text-sm font-bold"
                style={{
                  color: data.autopush
                    ? data.autopush.lastSuccess
                      ? "#34d399"
                      : "#f87171"
                    : "var(--muted-foreground)",
                }}
              >
                {data.autopush
                  ? data.autopush.lastSuccess
                    ? "À jour"
                    : "Échec"
                  : "Inconnu"}
              </span>
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Auto-push GitHub
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card title="Bot Discord" icon="🤖">
              <Row label="Tag" value={data.bot.tag ?? "—"} />
              <Row
                label="Ping WebSocket"
                value={data.bot.ping !== null ? `${data.bot.ping} ms` : "—"}
              />
              <Row label="Serveurs" value={data.bot.guilds} />
              <Row label="Uptime" value={fmtUptime(data.bot.uptimeSeconds)} />
            </Card>

            <Card title="Auto-push GitHub" icon="🔁">
              {data.autopush ? (
                <>
                  <Row
                    label="Dernière tentative"
                    value={fmtRelative(data.autopush.lastAttempt)}
                  />
                  <Row
                    label="Résultat"
                    value={data.autopush.lastSuccess ? "✅ Réussi" : "⚠️ Échec"}
                    valueColor={data.autopush.lastSuccess ? "#34d399" : "#f87171"}
                  />
                  <Row
                    label="Commits poussés"
                    value={data.autopush.commitsPushed}
                  />
                  <Row
                    label="Dernier commit"
                    value={
                      data.autopush.lastHash ? (
                        <span className="font-mono text-xs">
                          {data.autopush.lastHash}
                        </span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  {data.autopush.lastMessage && (
                    <p
                      className="text-xs mt-2 truncate"
                      style={{ color: "var(--muted-foreground)" }}
                      title={data.autopush.lastMessage}
                    >
                      {data.autopush.lastMessage}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-center py-4" style={{ color: "var(--muted-foreground)" }}>
                  Aucune donnée d'auto-push disponible pour le moment.
                </p>
              )}
            </Card>
          </div>

          <Card title="Instances du bot (base de données)" icon="🖥️">
            {data.instances.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--muted-foreground)" }}>
                Aucune instance active.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {data.instances.map((inst) => (
                  <div
                    key={inst.instanceId}
                    data-testid={`row-instance-${inst.instanceId}`}
                    className="flex items-center justify-between py-1.5"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <span className="font-mono text-xs">{inst.instanceId}</span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      PID {inst.pid}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      démarré {fmtRelative(inst.startedAt)}
                    </span>
                    <span className="text-xs" style={{ color: "#34d399" }}>
                      heartbeat {fmtRelative(inst.heartbeat)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {data.instances.length > 1 && (
              <p className="text-xs mt-3 font-semibold" style={{ color: "#f87171" }}>
                ⚠️ Plusieurs instances actives détectées — cela peut causer des réponses en double.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
