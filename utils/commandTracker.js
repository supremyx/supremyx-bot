const CommandStat = require('../models/CommandStat');

/**
 * Call this once in index.js — passively tracks every !command used.
 */
module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const command = message.content.trim().split(/\s+/)[0].toLowerCase();

    try {
      await CommandStat.create({
        command,
        userId:      message.author.id,
        username:    message.author.tag,
        channelId:   message.channel.id,
        channelName: message.channel.name || 'DM',
        guildId:     message.guild?.id || 'DM'
      });
    } catch (_) {
      // Silent — never crash the bot over tracking
    }
  });
};
