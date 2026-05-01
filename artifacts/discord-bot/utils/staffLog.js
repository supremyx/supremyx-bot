const { EmbedBuilder } = require('discord.js');

/**
 * Sends a log embed to the configured staff log channel.
 * Set LOG_CHANNEL_ID in your environment variables.
 */
async function staffLog(client, { action, details, author }) {
  const channelId = process.env.LOG_CHANNEL_ID;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const colors = {
    addmatch: 0x57F287,
    unregister: 0xED4245,
    resetmatch: 0xFEE75C
  };

  const icons = {
    addmatch: '🎯',
    unregister: '🗑️',
    resetmatch: '🔄'
  };

  const embed = new EmbedBuilder()
    .setTitle(`${icons[action] || '📋'} Action staff — ${action}`)
    .setDescription(details)
    .setColor(colors[action] || 0x5865F2)
    .setFooter({ text: `Effectué par ${author}` })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { staffLog };
