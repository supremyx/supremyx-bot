const MonitoringMetric = require('../database/models/MonitoringMetric');
const CommandStat      = require('../database/models/CommandStat');
const mongoose         = require('mongoose');

let _client = null;
let _started = false;

/**
 * Collect one metric snapshot and save it.
 */
async function collectMetric() {
  try {
    const mem         = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    const guildCount  = _client?.guilds.cache.size ?? 0;
    const wsLatency   = _client?.ws.ping ?? -1;
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Count commands used in the last 24h
    const since = new Date(Date.now() - 86400000);
    const commandCount24h = await CommandStat.countDocuments({ usedAt: { $gte: since } }).catch(() => 0);

    await MonitoringMetric.create({
      timestamp:        new Date(),
      memoryMB:         Math.round(mem.rss / 1024 / 1024),
      heapUsedMB:       Math.round(mem.heapUsed / 1024 / 1024),
      uptimeSeconds,
      guildCount,
      commandCount24h,
      wsLatency,
      mongoStatus,
    });
  } catch (err) {
    console.error('[monitoring] Erreur collecte métrique:', err.message);
  }
}

/**
 * Start collecting metrics every 5 minutes.
 */
function startMonitoring(client) {
  if (_started) return;
  _started = true;
  _client  = client;

  // First collection after 30s, then every 5 min
  setTimeout(async () => {
    await collectMetric();
    setInterval(collectMetric, 5 * 60 * 1000);
  }, 30_000);
}

module.exports = { startMonitoring };
