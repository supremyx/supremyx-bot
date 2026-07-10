const DashboardConfig = require('../database/models/DashboardConfig');
const { buildDashboardEmbed } = require('../commands/dashboard');

let scheduledHour = null;

async function postDashboard(client, guild, channelId) {
  try {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;
    const embeds = await buildDashboardEmbed(guild, client);
    await channel.send({ embeds });
  } catch (err) {
    console.error(`[dashboardManager] Erreur lors de la publication du dashboard (guild ${guild?.id}) :`, err);
  }
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
  } catch (err) {
    console.error('[dashboardManager] Erreur lors de la vérification des dashboards programmés :', err);
  }
}

function startDashboardManager(client) {
  // Check every hour on the dot
  const _now = new Date();
  const msUntilNextHour = (60 - _now.getMinutes()) * 60 * 1000 - _now.getSeconds() * 1000 - _now.getMilliseconds();
  setTimeout(() => {
    checkAndPost(client);
    setInterval(() => checkAndPost(client), 60 * 60 * 1000);
  }, msUntilNextHour);
}

module.exports = { startDashboardManager, postDashboard };
