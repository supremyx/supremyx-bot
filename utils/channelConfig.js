const Config = require('../database/models/Config');

let cached = { announceChannelId: null, logChannelId: null };

async function refreshChannelConfig() {
  try {
    const config = await Config.findOne();
    if (config) {
      cached.announceChannelId = config.announceChannelId || process.env.ANNOUNCE_CHANNEL_ID || null;
      cached.logChannelId = config.logChannelId || process.env.LOG_CHANNEL_ID || null;
    }
  } catch {
    // Silent fail — keep existing cache
  }
}

setInterval(refreshChannelConfig, 30 * 1000);
refreshChannelConfig();

function getAnnounceChannelId() {
  return cached.announceChannelId || process.env.ANNOUNCE_CHANNEL_ID || null;
}

function getLogChannelId() {
  return cached.logChannelId || process.env.LOG_CHANNEL_ID || null;
}

async function invalidateChannelCache() {
  await refreshChannelConfig();
}

module.exports = { getAnnounceChannelId, getLogChannelId, invalidateChannelCache };
