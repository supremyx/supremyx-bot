const DashboardConfig = require('../database/models/DashboardConfig');
const { buildDashboardEmbed } = require('../commands/dashboard');

let scheduledHour = null;

async function postDashboard(client, guild, channelId) {
  try {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;
    const embeds = await buildDashboardEmbed(guild, client);
    await channel.send({ embeds });
  } catch {}
}

async function checkAndPost(client) {
  const now = new Date();
  const currentHour = now.getUTCHours();

  try {
    const configs = await DashboardConfig.find({ autoEnabled: true, channelId: { $ne: '' } });
    for (const cfg of configs) {
      if (cfg.postHour !== currentHour) continue;
      const guild = client.guilds.cache.get(cfg.guildId);
      if (!guild) continue;
      await postDashboard(client, guild, cfg.channelId);
    }
  } catch {}
}

function startDashboardManager(client) {
  // Check every hour on the dot
  const msUntilNextHour = (60 - new Date().getMinutes()) * 60 * 1000 - new Date().getSeconds() * 1000;
  setTimeout(() => {
    checkAndPost(client);
    setInterval(() => checkAndPost(client), 60 * 60 * 1000);
  }, msUntilNextHour);
}

module.exports = { startDashboardManager, postDashboard };
