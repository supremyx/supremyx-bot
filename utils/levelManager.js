const XpEntry = require('../database/models/XpEntry');
const LevelConfig = require('../database/models/LevelConfig');
const { EmbedBuilder } = require('discord.js');

// In-memory cooldown: userId → timestamp of last XP gain
const xpCooldown = new Map();
const COOLDOWN_MS = 60 * 1000; // 1 minute between XP gains

function xpToLevel(xp) {
  return Math.floor(Math.sqrt(xp / 50));
}

function randomXp() {
  return Math.floor(Math.random() * 6) + 10; // 10-15 XP
}

async function startLevelManager(client) {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const now = Date.now();
    const cacheKey = `${guildId}:${userId}`;

    // Cooldown check
    const last = xpCooldown.get(cacheKey) || 0;
    if (now - last < COOLDOWN_MS) return;
    xpCooldown.set(cacheKey, now);

    // Check if levels enabled
    const config = await LevelConfig.findOne({ guildId }).catch(() => null);
    if (config && !config.enabled) return;

    const xpGain = randomXp();

    const entry = await XpEntry.findOneAndUpdate(
      { guildId, userId },
      {
        $inc: { xp: xpGain },
        $set: { username: message.author.username }
      },
      { upsert: true, new: true }
    ).catch(() => null);

    if (!entry) return;

    const newLevel = xpToLevel(entry.xp);
    if (newLevel > (entry.level || 0)) {
      // Level up!
      await XpEntry.findOneAndUpdate({ guildId, userId }, { level: newLevel });

      // Find where to announce
      let announceChannel = null;
      if (config?.channelId) {
        announceChannel = message.guild.channels.cache.get(config.channelId);
      }
      announceChannel = announceChannel || message.channel;

      const embed = new EmbedBuilder()
        .setTitle('📈 Level Up !')
        .setDescription(`Félicitations ${message.author} ! Tu passes au **niveau ${newLevel}** ! 🎉`)
        .setColor(0xFEE75C)
        .setThumbnail(message.author.displayAvatarURL())
        .setTimestamp();

      await announceChannel.send({ embeds: [embed] }).catch(() => {});
    }
  });
}

module.exports = { startLevelManager };
