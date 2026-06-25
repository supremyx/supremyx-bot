const { EmbedBuilder } = require('discord.js');

let _interval = null;
const state = {
  startedAt:       Date.now(),
  lastPingMs:      0,
  memoryMB:        0,
  peakMemoryMB:    0,
  alertCount:      0,
  lastAlertAt:     null,
  status:          'ok',
  activeAlerts:    [],
  reconnectCount:  0,
};

function getMetrics() { return { ...state }; }

function uptimeMs() { return Date.now() - state.startedAt; }

function formatUptime(ms) {
  const s  = Math.floor(ms / 1000);
  const d  = Math.floor(s / 86400);
  const h  = Math.floor((s % 86400) / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${sc}s`);
  return parts.join(' ');
}

function getFormatted() {
  const mem = process.memoryUsage();
  return {
    uptime:   formatUptime(uptimeMs()),
    ping:     state.lastPingMs,
    memoryMB: Math.round(mem.heapUsed / 1024 / 1024),
    rssMemMB: Math.round(mem.rss / 1024 / 1024),
    status:   state.status,
    alerts:   state.activeAlerts,
  };
}

async function sendAlert(client, alerts) {
  const channelId = process.env.LOG_CHANNEL_ID;
  if (!channelId) return;
  const ch = client.channels.cache.get(channelId);
  if (!ch) return;

  state.alertCount++;
  state.lastAlertAt = new Date().toISOString();
  state.activeAlerts = alerts;
  state.status = 'degraded';

  const embed = new EmbedBuilder()
    .setTitle('🚨 Alerte surveillance bot')
    .setColor(0xED4245)
    .setDescription(alerts.join('\n'))
    .addFields(
      { name: '⏱️ Uptime',  value: formatUptime(uptimeMs()), inline: true },
      { name: '📡 Ping',    value: `${state.lastPingMs} ms`,  inline: true },
      { name: '🧠 Mémoire', value: `${state.memoryMB} MB`,    inline: true },
    )
    .setFooter({ text: `SUPREMYX Monitor • Alerte #${state.alertCount}` })
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch(() => {});
}

function startBotMonitor(client, intervalMs = 5 * 60 * 1000) {
  if (_interval) clearInterval(_interval);

  _interval = setInterval(async () => {
    const ping   = client.ws.ping;
    const mem    = process.memoryUsage();
    const memMB  = Math.round(mem.heapUsed / 1024 / 1024);

    state.lastPingMs = ping;
    state.memoryMB   = memMB;
    if (memMB > state.peakMemoryMB) state.peakMemoryMB = memMB;

    const alerts = [];
    if (ping > 2000)          alerts.push(`⚠️ Ping élevé : **${ping} ms**`);
    if (memMB > 450)          alerts.push(`⚠️ Mémoire élevée : **${memMB} MB**`);
    if (!client.isReady())    alerts.push('🔴 Client Discord non connecté');

    if (alerts.length > 0) {
      await sendAlert(client, alerts).catch(() => {});
    } else {
      state.activeAlerts = [];
      state.status = 'ok';
    }
  }, intervalMs);

  console.log('📡 Surveillance bot activée');
}

function stopBotMonitor() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

module.exports = { startBotMonitor, stopBotMonitor, getMetrics, getFormatted, formatUptime, uptimeMs };
